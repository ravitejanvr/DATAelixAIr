/**
 * Causal Reasoning Engine — Edge Function
 *
 * Builds structured causal pathways from the knowledge graph:
 *   1. Symptom → Physiological Mechanism → Disease (causal chains)
 *   2. Convergent pathway detection (multiple symptoms sharing mechanisms)
 *   3. Counterfactual analysis (critical vs. supporting symptoms per disease)
 *   4. Causal conflict detection (symptoms that contradict a disease pathway)
 *
 * Graph-only, deterministic — no LLM. Target: <300ms.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CausalInput {
  symptoms: string[];
  candidate_diagnoses?: Array<{
    diagnosis_id: string;
    diagnosis_name: string;
    probability: number;
    must_not_miss?: boolean;
  }>;
  patient_age?: number | null;
  patient_sex?: string | null;
}

interface CausalChain {
  symptom: string;
  mechanism: string;
  organ_system: string;
  disease: string;
  chain_confidence: number;
  chain_string: string;
}

interface ConvergentPathway {
  mechanism: string;
  organ_system: string;
  contributing_symptoms: string[];
  linked_diseases: string[];
  convergence_strength: number;
}

interface CounterfactualInsight {
  diagnosis: string;
  critical_symptoms: string[];
  supporting_symptoms: string[];
  missing_expected_symptoms: string[];
  counterfactual_fragility: number; // 0-1, higher = more dependent on few symptoms
}

interface CausalConflict {
  diagnosis: string;
  conflicting_symptom: string;
  expected_mechanism: string;
  actual_mechanism: string;
  conflict_severity: "low" | "moderate" | "high";
  explanation: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = performance.now();

  try {
    const input: CausalInput = await req.json();
    const { symptoms, candidate_diagnoses } = input;

    if (!symptoms || symptoms.length === 0) {
      return new Response(
        JSON.stringify({ error: "No symptoms provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const lowerSymptoms = symptoms.map((s) => s.toLowerCase().trim());

    // Parallel graph queries
    const [physiologyRes, physioDiagRes, likelihoodRes] = await Promise.all([
      // Symptom → Physiology mapping
      supabase
        .from("symptom_physiology_map")
        .select("symptom, physiology_process, organ_system, confidence")
        .in("symptom", lowerSymptoms),

      // Physiology → Disease mapping
      supabase
        .from("physiology_diagnosis_map")
        .select("physiology_process, disease_name, confidence_score, organ_system"),

      // Symptom likelihoods for counterfactual analysis
      candidate_diagnoses && candidate_diagnoses.length > 0
        ? supabase
            .from("symptom_likelihoods")
            .select("diagnosis_id, symptom_name, likelihood")
            .in(
              "diagnosis_id",
              candidate_diagnoses.map((d) => d.diagnosis_id).filter(Boolean),
            )
        : Promise.resolve({ data: [], error: null }),
    ]);

    const physiologyMap = physiologyRes.data || [];
    const physioDiagMap = physioDiagRes.data || [];
    const likelihoodData = likelihoodRes.data || [];

    // ── 1. Build Causal Chains ──
    const causalChains: CausalChain[] = [];
    const mechanismToSymptoms = new Map<string, Set<string>>();
    const mechanismToOrganSystem = new Map<string, string>();

    for (const pm of physiologyMap) {
      const mechanism = pm.physiology_process;
      const symptom = pm.symptom;

      // Track convergence
      if (!mechanismToSymptoms.has(mechanism)) {
        mechanismToSymptoms.set(mechanism, new Set());
      }
      mechanismToSymptoms.get(mechanism)!.add(symptom);
      mechanismToOrganSystem.set(mechanism, pm.organ_system);

      // Find diseases linked through this mechanism
      const linkedDiseases = physioDiagMap.filter(
        (pd) => pd.physiology_process.toLowerCase() === mechanism.toLowerCase(),
      );

      for (const ld of linkedDiseases) {
        const chainConf = Math.round((pm.confidence || 0.5) * (ld.confidence_score || 0.5) * 100) / 100;
        causalChains.push({
          symptom,
          mechanism,
          organ_system: pm.organ_system,
          disease: ld.disease_name,
          chain_confidence: chainConf,
          chain_string: `${symptom} → [${mechanism}] → ${ld.disease_name}`,
        });
      }
    }

    // ── 2. Convergent Pathway Detection ──
    const convergentPathways: ConvergentPathway[] = [];
    for (const [mechanism, symptomSet] of mechanismToSymptoms.entries()) {
      if (symptomSet.size >= 2) {
        const linkedDiseases = [
          ...new Set(
            physioDiagMap
              .filter((pd) => pd.physiology_process.toLowerCase() === mechanism.toLowerCase())
              .map((pd) => pd.disease_name),
          ),
        ];

        if (linkedDiseases.length > 0) {
          convergentPathways.push({
            mechanism,
            organ_system: mechanismToOrganSystem.get(mechanism) || "unknown",
            contributing_symptoms: [...symptomSet],
            linked_diseases: linkedDiseases,
            convergence_strength: Math.min(1.0, symptomSet.size * 0.3),
          });
        }
      }
    }

    // Sort by convergence strength
    convergentPathways.sort((a, b) => b.convergence_strength - a.convergence_strength);

    // ── 3. Counterfactual Analysis ──
    const counterfactuals: CounterfactualInsight[] = [];
    if (candidate_diagnoses && candidate_diagnoses.length > 0) {
      // Build likelihood lookup: diagnosis_id → symptom_name → likelihood
      const likelihoodMap = new Map<string, Map<string, number>>();
      for (const l of likelihoodData) {
        if (!likelihoodMap.has(l.diagnosis_id)) {
          likelihoodMap.set(l.diagnosis_id, new Map());
        }
        likelihoodMap.get(l.diagnosis_id)!.set(l.symptom_name.toLowerCase(), l.likelihood);
      }

      for (const dx of candidate_diagnoses.slice(0, 8)) {
        const dxLikelihoods = likelihoodMap.get(dx.diagnosis_id);
        if (!dxLikelihoods || dxLikelihoods.size === 0) continue;

        const critical: string[] = [];
        const supporting: string[] = [];
        const missing: string[] = [];

        // Classify patient symptoms by their importance to this diagnosis
        for (const s of lowerSymptoms) {
          const likelihood = dxLikelihoods.get(s);
          if (likelihood !== undefined) {
            if (likelihood >= 0.7) {
              critical.push(s);
            } else if (likelihood >= 0.3) {
              supporting.push(s);
            }
          }
        }

        // Find expected symptoms the patient doesn't have
        for (const [symptomName, likelihood] of dxLikelihoods.entries()) {
          if (likelihood >= 0.6 && !lowerSymptoms.includes(symptomName)) {
            missing.push(symptomName);
          }
        }

        // Fragility: high if diagnosis depends on very few critical symptoms
        const totalMatched = critical.length + supporting.length;
        const fragility = totalMatched > 0
          ? Math.min(1.0, Math.round((1 - (critical.length / Math.max(totalMatched, 3))) * 100) / 100)
          : 1.0;

        counterfactuals.push({
          diagnosis: dx.diagnosis_name,
          critical_symptoms: critical,
          supporting_symptoms: supporting,
          missing_expected_symptoms: missing,
          counterfactual_fragility: fragility,
        });
      }
    }

    // ── 4. Causal Conflict Detection ──
    const causalConflicts: CausalConflict[] = [];
    if (candidate_diagnoses && candidate_diagnoses.length > 0) {
      // Build disease → expected mechanisms map from causal chains
      const diseaseMechanisms = new Map<string, Set<string>>();
      for (const chain of causalChains) {
        const key = chain.disease.toLowerCase();
        if (!diseaseMechanisms.has(key)) {
          diseaseMechanisms.set(key, new Set());
        }
        diseaseMechanisms.get(key)!.add(chain.mechanism);
      }

      // Check for symptoms that activate mechanisms inconsistent with the diagnosis
      for (const dx of candidate_diagnoses.slice(0, 6)) {
        const expectedMechanisms = diseaseMechanisms.get(dx.diagnosis_name.toLowerCase());
        if (!expectedMechanisms) continue;

        for (const pm of physiologyMap) {
          // If a patient symptom activates a mechanism NOT in this disease's pathway
          // and that mechanism belongs to a different organ system
          const diseaseOrganSystems = new Set(
            causalChains
              .filter((c) => c.disease.toLowerCase() === dx.diagnosis_name.toLowerCase())
              .map((c) => c.organ_system),
          );

          if (
            !expectedMechanisms.has(pm.physiology_process) &&
            !diseaseOrganSystems.has(pm.organ_system) &&
            (pm.confidence || 0.5) >= 0.5
          ) {
            causalConflicts.push({
              diagnosis: dx.diagnosis_name,
              conflicting_symptom: pm.symptom,
              expected_mechanism: [...expectedMechanisms][0] || "unknown",
              actual_mechanism: pm.physiology_process,
              conflict_severity:
                (pm.confidence || 0.5) >= 0.8 ? "high" : (pm.confidence || 0.5) >= 0.5 ? "moderate" : "low",
              explanation: `${pm.symptom} activates ${pm.physiology_process} (${pm.organ_system}), which is outside the expected causal pathway for ${dx.diagnosis_name}`,
            });
          }
        }
      }

      // Deduplicate and limit
      const seen = new Set<string>();
      const uniqueConflicts: CausalConflict[] = [];
      for (const c of causalConflicts) {
        const key = `${c.diagnosis}|${c.conflicting_symptom}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConflicts.push(c);
        }
      }
      causalConflicts.length = 0;
      causalConflicts.push(...uniqueConflicts.slice(0, 10));
    }

    const executionMs = Math.round(performance.now() - start);

    const result = {
      causal_chains: causalChains.sort((a, b) => b.chain_confidence - a.chain_confidence).slice(0, 30),
      convergent_pathways: convergentPathways.slice(0, 10),
      counterfactuals: counterfactuals,
      causal_conflicts: causalConflicts,
      summary: {
        total_chains: causalChains.length,
        convergent_pathways_detected: convergentPathways.length,
        counterfactuals_analyzed: counterfactuals.length,
        causal_conflicts_detected: causalConflicts.length,
        unique_mechanisms: mechanismToSymptoms.size,
        unique_organ_systems: [...new Set(causalChains.map((c) => c.organ_system))].length,
      },
      execution_ms: executionMs,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[CausalReasoning] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
