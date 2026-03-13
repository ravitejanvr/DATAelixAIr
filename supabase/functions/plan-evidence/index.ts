import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Evidence Planning Engine
 *
 * Computes information gain for each candidate lab test to recommend
 * the most discriminative investigations. Uses diagnosis_lab_map and
 * disease_tests to identify which tests would most effectively
 * differentiate between competing diagnoses.
 *
 * Algorithm:
 *   For each candidate test T:
 *     - Count how many competing diagnoses T is associated with
 *     - Compute a discrimination score: tests that appear for some
 *       diagnoses but NOT others have higher discriminative power
 *     - Weight by test priority (stat > urgent > routine)
 *     - Rank by information gain
 *
 * Deterministic, graph-only — no LLM calls. Target: <300ms.
 */

interface PlannedTest {
  test_name: string;
  test_id: string | null;
  category: string;
  priority: string;
  information_gain: number;
  discrimination_score: number;
  differentiates_between: string[];
  supports_diagnoses: string[];
  rules_out_diagnoses: string[];
  clinical_rationale: string;
}

interface EvidencePlanResult {
  planned_tests: PlannedTest[];
  summary: {
    total_candidate_tests: number;
    high_value_tests: number;
    diagnoses_evaluated: number;
    max_information_gain: number;
  };
  execution_ms: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      candidate_diagnoses,
      patient_symptoms,
      existing_tests,
      patient_age,
      patient_sex,
    } = body;

    if (!candidate_diagnoses || !Array.isArray(candidate_diagnoses) || candidate_diagnoses.length === 0) {
      return new Response(
        JSON.stringify({ error: "candidate_diagnoses array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const diagnosisIds = candidate_diagnoses
      .map((d: any) => d.diagnosis_id)
      .filter(Boolean);

    const existingTestNames = new Set(
      (existing_tests || []).map((t: string) => t.toLowerCase().trim()),
    );

    // ══════════════════════════════════════════════
    // STEP 1: Fetch all lab tests mapped to candidate diagnoses
    // ══════════════════════════════════════════════
    const { data: labMappings, error: labErr } = await supabase
      .from("diagnosis_lab_map")
      .select("diagnosis_id, lab_test_id, priority, lab_tests(id, test_name, category)")
      .in("diagnosis_id", diagnosisIds);

    if (labErr) {
      console.error("[EvidencePlanning] Failed to fetch lab mappings:", labErr);
    }

    // Also fetch disease_tests for broader coverage
    const diagnosisNames = candidate_diagnoses.map((d: any) => d.diagnosis_name).filter(Boolean);
    const { data: diseaseTests, error: dtErr } = await supabase
      .from("disease_tests")
      .select("disease_name, test_name, test_category, diagnostic_strength")
      .in("disease_name", diagnosisNames);

    if (dtErr) {
      console.error("[EvidencePlanning] Failed to fetch disease_tests:", dtErr);
    }

    // ══════════════════════════════════════════════
    // STEP 2: Build test → diagnosis association map
    // ══════════════════════════════════════════════
    // Map: test_name → { diagnoses it applies to, priority, category }
    const testMap = new Map<string, {
      test_id: string | null;
      category: string;
      priority: string;
      associated_diagnoses: Set<string>;
      diagnostic_strength: string;
    }>();

    // From diagnosis_lab_map (structured graph)
    if (labMappings) {
      for (const row of labMappings) {
        const labTest = (row as any).lab_tests;
        if (!labTest?.test_name) continue;
        const testName = labTest.test_name.toLowerCase();

        if (!testMap.has(testName)) {
          testMap.set(testName, {
            test_id: labTest.id,
            category: labTest.category || "general",
            priority: row.priority || "routine",
            associated_diagnoses: new Set(),
            diagnostic_strength: "moderate",
          });
        }
        // Find the diagnosis name for this diagnosis_id
        const dx = candidate_diagnoses.find((d: any) => d.diagnosis_id === row.diagnosis_id);
        if (dx) {
          testMap.get(testName)!.associated_diagnoses.add(dx.diagnosis_name);
        }
        // Upgrade priority if higher
        const priorityRank: Record<string, number> = { stat: 3, urgent: 2, routine: 1 };
        const existing = testMap.get(testName)!;
        if ((priorityRank[row.priority] || 0) > (priorityRank[existing.priority] || 0)) {
          existing.priority = row.priority;
        }
      }
    }

    // From disease_tests (broader coverage)
    if (diseaseTests) {
      for (const row of diseaseTests) {
        const testName = row.test_name.toLowerCase();

        if (!testMap.has(testName)) {
          testMap.set(testName, {
            test_id: null,
            category: row.test_category || "general",
            priority: "routine",
            associated_diagnoses: new Set(),
            diagnostic_strength: row.diagnostic_strength || "moderate",
          });
        }
        testMap.get(testName)!.associated_diagnoses.add(row.disease_name);
      }
    }

    // ══════════════════════════════════════════════
    // STEP 3: Compute information gain for each test
    // ══════════════════════════════════════════════
    const totalDiagnoses = candidate_diagnoses.length;
    const plannedTests: PlannedTest[] = [];

    for (const [testName, info] of testMap.entries()) {
      // Skip tests already ordered
      if (existingTestNames.has(testName)) continue;

      const associatedCount = info.associated_diagnoses.size;
      const associatedNames = Array.from(info.associated_diagnoses);

      // Diagnoses NOT associated with this test
      const ruledOutDiagnoses = candidate_diagnoses
        .filter((d: any) => !info.associated_diagnoses.has(d.diagnosis_name))
        .map((d: any) => d.diagnosis_name);

      // Information gain: maximum when test applies to ~50% of diagnoses
      // (perfect split). Minimum when it applies to all or none.
      // Formula: entropy reduction approximation
      const p = associatedCount / totalDiagnoses;
      const entropyReduction = totalDiagnoses > 1
        ? -1 * (p * Math.log2(p + 0.001) + (1 - p) * Math.log2(1 - p + 0.001))
        : 0;

      // Discrimination score: how well does this test separate diagnoses?
      // Best when it uniquely identifies one diagnosis vs others
      const discriminationScore = totalDiagnoses > 1
        ? (ruledOutDiagnoses.length / (totalDiagnoses - 1)) * (associatedCount > 0 ? 1 : 0)
        : 0;

      // Priority weight
      const priorityWeight: Record<string, number> = { stat: 1.5, urgent: 1.2, routine: 1.0 };
      const pWeight = priorityWeight[info.priority] || 1.0;

      // Final information gain score (0 to 1)
      const informationGain = Math.min(1, Math.round(
        (entropyReduction * 0.6 + discriminationScore * 0.4) * pWeight * 100,
      ) / 100);

      // Build rationale
      let rationale = "";
      if (associatedCount === 1) {
        rationale = `Specific to ${associatedNames[0]}; a positive result strongly supports this diagnosis while a negative result helps rule it out.`;
      } else if (associatedCount > 1 && ruledOutDiagnoses.length > 0) {
        rationale = `Differentiates between ${associatedNames.join(", ")} (expected positive) vs ${ruledOutDiagnoses.slice(0, 2).join(", ")} (expected negative).`;
      } else if (associatedCount === totalDiagnoses) {
        rationale = `Common to all differential diagnoses — useful for baseline assessment but low discriminative value.`;
      } else {
        rationale = `Associated with ${associatedNames.join(", ")}.`;
      }

      plannedTests.push({
        test_name: testName,
        test_id: info.test_id,
        category: info.category,
        priority: info.priority,
        information_gain: informationGain,
        discrimination_score: Math.round(discriminationScore * 100) / 100,
        differentiates_between: associatedCount < totalDiagnoses && associatedCount > 0
          ? [...associatedNames, ...ruledOutDiagnoses.slice(0, 2)]
          : [],
        supports_diagnoses: associatedNames,
        rules_out_diagnoses: ruledOutDiagnoses,
        clinical_rationale: rationale,
      });
    }

    // Sort by information gain descending
    plannedTests.sort((a, b) => b.information_gain - a.information_gain);

    // Limit to top 10 most valuable tests
    const topTests = plannedTests.slice(0, 10);

    const execution_ms = Date.now() - start;
    const highValueTests = topTests.filter((t) => t.information_gain >= 0.5).length;

    console.log(
      `[EvidencePlanning] Planned ${topTests.length} tests from ${testMap.size} candidates in ${execution_ms}ms. ` +
      `High-value: ${highValueTests}. Diagnoses evaluated: ${totalDiagnoses}.`,
    );

    const result: EvidencePlanResult = {
      planned_tests: topTests,
      summary: {
        total_candidate_tests: testMap.size,
        high_value_tests: highValueTests,
        diagnoses_evaluated: totalDiagnoses,
        max_information_gain: topTests.length > 0 ? topTests[0].information_gain : 0,
      },
      execution_ms,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[EvidencePlanning] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
