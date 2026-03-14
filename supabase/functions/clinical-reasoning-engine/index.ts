import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ══════════════════════════════════════════════════════════════
// INLINE TERMINOLOGY NORMALIZER
// Must be kept in-sync with ddx-engine normalizer.
// ══════════════════════════════════════════════════════════════
const SYNONYM_MAP: Record<string, string> = {
  "cough with sputum": "productive cough", "cough with phlegm": "productive cough",
  "phlegmy cough": "productive cough", "wet cough": "productive cough",
  "nonproductive cough": "dry cough",
  "shortness of breath": "dyspnea", "breathlessness": "dyspnea",
  "difficulty breathing": "dyspnea", "breathing difficulty": "dyspnea",
  "can't breathe": "dyspnea", "labored breathing": "dyspnea", "sob": "dyspnea",
  "rhinorrhea": "runny nose", "nasal discharge": "runny nose",
  "stuffy nose": "nasal congestion", "blocked nose": "nasal congestion",
  "sinus pressure": "facial pain", "sinus pain": "facial pain",
  "coughing up blood": "hemoptysis", "blood in sputum": "hemoptysis",
  "stomach pain": "abdominal pain", "belly pain": "abdominal pain",
  "tummy pain": "abdominal pain", "stomach ache": "abdominal pain",
  "abdominal discomfort": "abdominal pain",
  "stomach cramps": "abdominal cramps", "belly cramps": "abdominal cramps",
  "throwing up": "vomiting", "puking": "vomiting", "emesis": "vomiting",
  "feeling sick": "nausea", "queasy": "nausea",
  "loose stools": "diarrhea", "loose motions": "diarrhea",
  "watery stools": "diarrhea", "frequent stools": "diarrhea",
  "acid reflux": "heartburn", "acidity": "heartburn",
  "burning in stomach": "epigastric pain", "upper stomach pain": "epigastric pain",
  "gas": "bloating", "flatulence": "bloating", "indigestion": "bloating",
  "no appetite": "loss of appetite", "not hungry": "loss of appetite",
  "poor appetite": "loss of appetite", "decreased appetite": "loss of appetite",
  "blood in stool": "bloody stool", "rectal bleeding": "bloody stool",
  "heart racing": "palpitations", "heart pounding": "palpitations",
  "irregular heartbeat": "palpitations",
  "fast heart": "tachycardia", "rapid pulse": "tachycardia",
  "chest tightness": "chest pain", "chest pressure": "chest pain",
  "chest discomfort": "chest pain",
  "heavy sweating": "diaphoresis", "profuse sweating": "diaphoresis",
  "cold sweats": "diaphoresis",
  "swollen legs": "edema", "swollen feet": "edema", "ankle swelling": "edema",
  "leg swelling": "edema", "fluid retention": "edema",
  "cannot lie flat": "orthopnea", "wakes up breathless": "orthopnea",
  "head pain": "headache", "migraine": "headache",
  "giddiness": "dizziness", "lightheadedness": "dizziness",
  "vertigo": "dizziness", "room spinning": "dizziness",
  "passed out": "syncope", "fainted": "syncope", "fainting": "syncope",
  "loss of consciousness": "syncope",
  "stiff neck": "neck stiffness", "neck rigidity": "neck stiffness",
  "sensitivity to light": "photophobia", "light sensitivity": "photophobia",
  "can't see clearly": "blurred vision", "vision blurry": "blurred vision",
  "double vision": "blurred vision",
  "pins and needles": "tingling", "prickling": "tingling",
  "weakness in arm": "weakness", "weakness in leg": "weakness",
  "general weakness": "weakness", "body weakness": "weakness",
  "slurred speech": "speech difficulty", "difficulty speaking": "speech difficulty",
  "body pain": "body aches", "generalized pain": "body aches",
  "muscle ache": "muscle pain", "myalgia": "muscle pain",
  "joint ache": "joint pain", "arthralgia": "joint pain",
  "low back pain": "back pain", "lower back pain": "back pain",
  "lumbar pain": "back pain",
  "painful urination": "dysuria", "burning urination": "dysuria",
  "urinary burning": "dysuria", "burning when peeing": "dysuria",
  "peeing a lot": "polyuria", "frequent urination": "polyuria",
  "blood in urine": "hematuria",
  "side pain": "flank pain", "kidney area pain": "flank pain",
  "excessive thirst": "polydipsia", "always thirsty": "polydipsia",
  "skin rash": "rash", "eruption": "rash", "hives": "rash",
  "pruritus": "itching", "itchy skin": "itching",
  "tiredness": "fatigue", "exhaustion": "fatigue", "no energy": "fatigue",
  "lethargic": "fatigue", "lethargy": "fatigue", "feeling tired": "fatigue",
  "low grade fever": "mild fever", "slight fever": "mild fever",
  "high fever": "fever", "temperature": "fever", "febrile": "fever", "pyrexia": "fever",
  "rigor": "chills", "shivering": "chills",
  "unable to sleep": "insomnia", "sweating at night": "night sweats",
  "lost weight": "weight loss", "losing weight": "weight loss",
  "feeling unwell": "malaise", "generally unwell": "malaise",
  "dehydrated": "dehydration", "dry mouth": "dehydration",
};

function normalizeSymptom(s: string): string {
  const lower = s.toLowerCase().trim();
  return SYNONYM_MAP[lower] || lower;
}

function normalizeSymptomList(symptoms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of symptoms) {
    const n = normalizeSymptom(s);
    if (!seen.has(n)) { seen.add(n); result.push(n); }
  }
  return result;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Hybrid Clinical Reasoning Engine
 * 
 * Combines three reasoning paradigms:
 *   1. Symbolic  — Knowledge graph rule-based traversal
 *   2. Probabilistic — Bayesian scoring for diagnosis ranking
 *   3. Neural — LLM for summarization, interpretation, explanation
 * 
 * Weighted fusion produces a unified clinical reasoning output.
 */

// ── Weight configuration ──
const WEIGHTS = {
  symbolic: 0.35,    // Knowledge graph deterministic traversal
  probabilistic: 0.40, // Bayesian DDX scoring
  neural: 0.25,      // LLM reasoning & explanation
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      symptoms = [],
      vitals = {},
      patient_age,
      patient_sex,
      weight_kg,
      medical_history = [],
      current_medications = [],
      allergies = [],
      risk_factors = [],
      chief_complaint = "",
      visit_id,
      clinic_id,
    } = body;

    if (symptoms.length === 0 && !chief_complaint) {
      return new Response(JSON.stringify({ error: "symptoms or chief_complaint required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allSymptoms = [...new Set([...symptoms, ...(chief_complaint ? [chief_complaint] : [])])];
    const stageLatencies: Record<string, number> = {};

    // ══════════════════════════════════════════════════════
    // PARADIGM 1: SYMBOLIC REASONING (Knowledge Graph)
    // Rule-based deterministic traversal
    // ══════════════════════════════════════════════════════
    const symbolicStart = Date.now();

    // 1a: Resolve symptoms
    const { data: symptomRows } = await sb
      .from("symptoms")
      .select("id, symptom_name")
      .or(allSymptoms.map(s => `symptom_name.ilike.%${s.replace(/'/g, "''")}%`).join(","));

    const matchedSymptomIds = (symptomRows || []).map((s: any) => s.id);
    const matchedSymptomNames = (symptomRows || []).map((s: any) => s.symptom_name);
    const unmatchedSymptoms = allSymptoms.filter(
      s => !matchedSymptomNames.some((m: string) => m.toLowerCase().includes(s.toLowerCase()))
    );

    // 1b: Symptom → Diagnosis traversal
    let symbolicDiagnoses: any[] = [];
    if (matchedSymptomIds.length > 0) {
      const { data: maps } = await sb
        .from("symptom_diagnosis_map")
        .select("diagnosis_id, confidence, diagnoses(id, diagnosis_name, category, icd10_code)")
        .in("symptom_id", matchedSymptomIds);

      // Aggregate by diagnosis
      const diagMap = new Map<string, any>();
      for (const m of (maps || [])) {
        const d = (m as any).diagnoses;
        if (!d) continue;
        if (!diagMap.has(d.id)) {
          diagMap.set(d.id, {
            diagnosis_id: d.id,
            diagnosis_name: d.diagnosis_name,
            category: d.category,
            icd10_code: d.icd10_code,
            symptom_hits: 0,
            total_confidence: 0,
            supporting_symptoms: [],
          });
        }
        const entry = diagMap.get(d.id);
        entry.symptom_hits++;
        entry.total_confidence += (m.confidence || 0.5);
        entry.supporting_symptoms.push(matchedSymptomNames.find((_: any, i: number) =>
          matchedSymptomIds[i] === (maps || [])[0]?.diagnosis_id // approximate
        ) || "symptom");
      }

      symbolicDiagnoses = Array.from(diagMap.values()).map(d => ({
        ...d,
        coverage: d.symptom_hits / matchedSymptomIds.length,
        avg_confidence: d.total_confidence / d.symptom_hits,
        symbolic_score: (d.symptom_hits / matchedSymptomIds.length) * (d.total_confidence / d.symptom_hits),
      }));
      symbolicDiagnoses.sort((a: any, b: any) => b.symbolic_score - a.symbolic_score);
    }

    // 1c: Fetch dangerous diagnoses for symptom triggers
    let dangerousDiagnoses: any[] = [];
    if (allSymptoms.length > 0) {
      const { data: dangerous } = await sb
        .from("dangerous_diagnoses")
        .select("*, diagnoses(diagnosis_name, icd10_code)")
        .eq("must_not_miss", true)
        .or(allSymptoms.map(s => `trigger_symptom.ilike.%${s.replace(/'/g, "''")}%`).join(","));

      dangerousDiagnoses = (dangerous || []).map((d: any) => ({
        diagnosis_id: d.diagnosis_id,
        diagnosis_name: d.diagnosis_name || (d as any).diagnoses?.diagnosis_name || "",
        severity_level: d.severity_level,
        emergency_protocol: d.emergency_protocol,
        trigger_symptom: d.trigger_symptom,
        must_not_miss: true,
      }));
    }

    // 1d: Get labs and drugs for top diagnoses
    const topDiagIds = symbolicDiagnoses.slice(0, 5).map(d => d.diagnosis_id);
    let symbolicLabs: any[] = [];
    let symbolicDrugs: any[] = [];
    let symbolicGuidelines: any[] = [];

    if (topDiagIds.length > 0) {
      const [labResult, drugResult, guidelineResult] = await Promise.all([
        sb.from("diagnosis_lab_map")
          .select("priority, lab_tests(id, test_name, category)")
          .in("diagnosis_id", topDiagIds),
        sb.from("diagnosis_drug_map")
          .select("line_of_treatment, generic_name, diagnosis_id, drug_master(drug_class, max_daily_dose_mg, pregnancy_category)")
          .in("diagnosis_id", topDiagIds),
        sb.from("guideline_rules")
          .select("recommendation, evidence_level, treatment_generic_name, guideline_authorities(authority_name, priority, country)")
          .in("diagnosis_id", topDiagIds),
      ]);

      symbolicLabs = (labResult.data || []).map((l: any) => ({
        test_name: (l as any).lab_tests?.test_name || "",
        category: (l as any).lab_tests?.category || "",
        priority: l.priority,
        source: "symbolic",
      }));

      symbolicDrugs = (drugResult.data || []).map((d: any) => ({
        generic_name: d.generic_name,
        drug_class: (d as any).drug_master?.drug_class || "",
        line_of_treatment: d.line_of_treatment,
        for_diagnosis: symbolicDiagnoses.find((sd: any) => sd.diagnosis_id === d.diagnosis_id)?.diagnosis_name || "",
        max_daily_dose_mg: (d as any).drug_master?.max_daily_dose_mg,
        pregnancy_category: (d as any).drug_master?.pregnancy_category,
        source: "symbolic",
      }));

      symbolicGuidelines = (guidelineResult.data || []).map((g: any) => ({
        authority: (g as any).guideline_authorities?.authority_name || "Unknown",
        authority_priority: (g as any).guideline_authorities?.priority ?? 10,
        recommendation: g.recommendation,
        evidence_level: g.evidence_level,
        treatment: g.treatment_generic_name,
        country: (g as any).guideline_authorities?.country || "global",
        source: "symbolic",
      }));
      symbolicGuidelines.sort((a: any, b: any) => a.authority_priority - b.authority_priority);
    }

    stageLatencies.symbolic = Date.now() - symbolicStart;

    // ══════════════════════════════════════════════════════
    // PARADIGM 2: PROBABILISTIC REASONING (Bayesian)
    // P(D|S) ∝ P(D) × ∏ P(Si|D) × modifiers
    // ══════════════════════════════════════════════════════
    const bayesStart = Date.now();

    // Category-based priors
    const CATEGORY_PRIORS: Record<string, number> = {
      infectious: 0.25, respiratory: 0.15, cardiovascular: 0.08,
      neurological: 0.08, gastrointestinal: 0.12, musculoskeletal: 0.10,
      dermatological: 0.08, endocrine: 0.05, psychiatric: 0.04,
      hematological: 0.03, renal: 0.02,
    };

    const bayesianDiagnoses = symbolicDiagnoses.map(d => {
      const prior = CATEGORY_PRIORS[d.category?.toLowerCase()] || 0.05;

      // Likelihood: symptom coverage × average confidence
      const likelihood = d.coverage * d.avg_confidence;

      // Vital modifiers
      let vitalModifier = 1.0;
      const temp = parseFloat(vitals?.temperature);
      const spo2 = parseFloat(vitals?.spo2);
      const pulse = parseFloat(vitals?.pulse);

      if (!isNaN(temp) && temp > 38.5) {
        if (d.category?.toLowerCase() === "infectious") vitalModifier *= 1.3;
      }
      if (!isNaN(spo2) && spo2 < 94) {
        if (["respiratory", "cardiovascular"].includes(d.category?.toLowerCase())) vitalModifier *= 1.4;
      }
      if (!isNaN(pulse) && pulse > 100) {
        if (["cardiovascular", "infectious"].includes(d.category?.toLowerCase())) vitalModifier *= 1.2;
      }

      // Age modifier
      let ageModifier = 1.0;
      if (patient_age) {
        if (patient_age < 5 && d.category?.toLowerCase() === "infectious") ageModifier = 1.3;
        if (patient_age > 60 && d.category?.toLowerCase() === "cardiovascular") ageModifier = 1.4;
      }

      // Risk factor modifier
      let riskModifier = 1.0;
      for (const rf of risk_factors) {
        const rfLower = rf.toLowerCase();
        if (rfLower.includes("diabet") && d.category?.toLowerCase() === "endocrine") riskModifier *= 1.3;
        if (rfLower.includes("smok") && d.category?.toLowerCase() === "respiratory") riskModifier *= 1.3;
        if (rfLower.includes("hypertens") && d.category?.toLowerCase() === "cardiovascular") riskModifier *= 1.3;
      }

      const posterior = prior * likelihood * vitalModifier * ageModifier * riskModifier;

      return {
        ...d,
        prior,
        likelihood,
        vital_modifier: vitalModifier,
        age_modifier: ageModifier,
        risk_modifier: riskModifier,
        posterior,
      };
    });

    // Normalize to probabilities
    const totalPosterior = bayesianDiagnoses.reduce((s, d) => s + d.posterior, 0) || 1;
    for (const d of bayesianDiagnoses) {
      d.probability = Math.round((d.posterior / totalPosterior) * 100);
    }
    bayesianDiagnoses.sort((a: any, b: any) => b.probability - a.probability);

    stageLatencies.probabilistic = Date.now() - bayesStart;

    // ══════════════════════════════════════════════════════
    // PARADIGM 3: NEURAL REASONING (LLM)
    // Summarization, interpretation, clinical explanation
    // ══════════════════════════════════════════════════════
    const neuralStart = Date.now();

    const topSymbolic = symbolicDiagnoses.slice(0, 5).map(d => d.diagnosis_name).join(", ");
    const topBayesian = bayesianDiagnoses.slice(0, 5).map(d => `${d.diagnosis_name} (${d.probability}%)`).join(", ");
    const dangerList = dangerousDiagnoses.map(d => d.diagnosis_name).join(", ");

    const neuralResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.15,
        messages: [
          {
            role: "system",
            content: `You are a clinical reasoning assistant for DATAelixAIr. You receive structured outputs from a knowledge graph (symbolic reasoning) and Bayesian probability model (probabilistic reasoning). Your task is to:
1. Synthesize findings into a coherent clinical explanation
2. Identify any reasoning conflicts between paradigms
3. Provide clinical judgment on ambiguous cases
4. Flag safety concerns
5. Suggest next steps

Be concise, evidence-based, and always prioritize patient safety. Never make final diagnoses — provide differential reasoning for clinician review.`,
          },
          {
            role: "user",
            content: `Patient: ${patient_age || "unknown"} yo ${patient_sex || "unknown"}
Chief complaint: ${chief_complaint || allSymptoms[0] || "unknown"}
Symptoms: ${allSymptoms.join(", ")}
Vitals: ${JSON.stringify(vitals)}
Medical history: ${medical_history.join(", ") || "none reported"}
Current medications: ${current_medications.join(", ") || "none"}
Allergies: ${allergies.join(", ") || "NKDA"}
Risk factors: ${risk_factors.join(", ") || "none"}

SYMBOLIC (Knowledge Graph) top diagnoses: ${topSymbolic || "none found"}
PROBABILISTIC (Bayesian) top diagnoses: ${topBayesian || "none scored"}
DANGEROUS (Must-not-miss): ${dangerList || "none triggered"}

Guideline recommendations: ${symbolicGuidelines.slice(0, 3).map(g => `${g.authority}: ${g.recommendation}`).join("; ") || "none"}

Provide hybrid clinical reasoning output.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "clinical_reasoning_output",
            description: "Produce structured hybrid clinical reasoning",
            parameters: {
              type: "object",
              properties: {
                reasoning_summary: {
                  type: "string",
                  description: "2-4 sentence clinical reasoning narrative explaining the differential"
                },
                paradigm_agreement: {
                  type: "string",
                  enum: ["strong_agreement", "moderate_agreement", "divergent"],
                  description: "How well symbolic and probabilistic paradigms agree"
                },
                confidence_assessment: {
                  type: "string",
                  enum: ["high", "moderate", "low", "very_low"],
                  description: "Overall reasoning confidence"
                },
                safety_alerts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      alert_type: { type: "string", enum: ["critical", "warning", "info"] },
                      message: { type: "string" },
                    },
                    required: ["alert_type", "message"],
                    additionalProperties: false,
                  },
                  description: "Safety concerns identified during reasoning"
                },
                neural_diagnoses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      diagnosis: { type: "string" },
                      confidence: { type: "number" },
                      reasoning: { type: "string" },
                      recommended_tests: { type: "array", items: { type: "string" } },
                      treatment_considerations: { type: "array", items: { type: "string" } },
                    },
                    required: ["diagnosis", "confidence", "reasoning"],
                    additionalProperties: false,
                  }
                },
                key_differentiators: {
                  type: "array",
                  items: { type: "string" },
                  description: "Tests or findings that would differentiate between top diagnoses"
                },
                reasoning_explanation: {
                  type: "string",
                  description: "Detailed multi-paragraph clinical reasoning explanation for the clinician"
                },
              },
              required: ["reasoning_summary", "paradigm_agreement", "confidence_assessment", "safety_alerts", "neural_diagnoses", "key_differentiators", "reasoning_explanation"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "clinical_reasoning_output" } },
      }),
    });

    if (!neuralResponse.ok) {
      if (neuralResponse.status === 429) throw new Error("Rate limit exceeded");
      if (neuralResponse.status === 402) throw new Error("AI credits required");
      throw new Error(`AI gateway error: ${neuralResponse.status}`);
    }

    const neuralData = await neuralResponse.json();
    const toolCall = neuralData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured neural output");

    const neural = JSON.parse(toolCall.function.arguments);
    stageLatencies.neural = Date.now() - neuralStart;

    // ══════════════════════════════════════════════════════
    // FUSION: Weighted combination of all paradigms
    // ══════════════════════════════════════════════════════
    const fusionStart = Date.now();

    // Build unified diagnosis list with weighted scores
    const diagnosisMap = new Map<string, any>();

    // Add symbolic diagnoses
    for (const d of symbolicDiagnoses.slice(0, 8)) {
      diagnosisMap.set(d.diagnosis_name.toLowerCase(), {
        diagnosis_name: d.diagnosis_name,
        diagnosis_id: d.diagnosis_id,
        icd10_code: d.icd10_code,
        category: d.category,
        symbolic_score: d.symbolic_score,
        probabilistic_score: 0,
        neural_score: 0,
        supporting_symptoms: d.supporting_symptoms,
        must_not_miss: false,
        recommended_tests: [],
        treatment_options: [],
        reasoning: "",
      });
    }

    // Merge probabilistic scores
    for (const d of bayesianDiagnoses.slice(0, 8)) {
      const key = d.diagnosis_name.toLowerCase();
      if (diagnosisMap.has(key)) {
        diagnosisMap.get(key).probabilistic_score = d.probability / 100;
      } else {
        diagnosisMap.set(key, {
          diagnosis_name: d.diagnosis_name,
          diagnosis_id: d.diagnosis_id,
          icd10_code: d.icd10_code,
          category: d.category,
          symbolic_score: 0,
          probabilistic_score: d.probability / 100,
          neural_score: 0,
          supporting_symptoms: d.supporting_symptoms || [],
          must_not_miss: false,
          recommended_tests: [],
          treatment_options: [],
          reasoning: "",
        });
      }
    }

    // Merge neural diagnoses
    for (const nd of (neural.neural_diagnoses || [])) {
      const key = nd.diagnosis.toLowerCase();
      if (diagnosisMap.has(key)) {
        const entry = diagnosisMap.get(key);
        entry.neural_score = nd.confidence || 0;
        entry.reasoning = nd.reasoning || "";
        entry.recommended_tests = [...new Set([...entry.recommended_tests, ...(nd.recommended_tests || [])])];
        entry.treatment_options = nd.treatment_considerations || [];
      } else {
        diagnosisMap.set(key, {
          diagnosis_name: nd.diagnosis,
          diagnosis_id: null,
          icd10_code: null,
          category: "unknown",
          symbolic_score: 0,
          probabilistic_score: 0,
          neural_score: nd.confidence || 0,
          supporting_symptoms: [],
          must_not_miss: false,
          recommended_tests: nd.recommended_tests || [],
          treatment_options: nd.treatment_considerations || [],
          reasoning: nd.reasoning || "",
        });
      }
    }

    // Inject dangerous diagnoses
    for (const dd of dangerousDiagnoses) {
      const key = dd.diagnosis_name.toLowerCase();
      if (diagnosisMap.has(key)) {
        diagnosisMap.get(key).must_not_miss = true;
        diagnosisMap.get(key).emergency_protocol = dd.emergency_protocol;
        diagnosisMap.get(key).severity_level = dd.severity_level;
      } else {
        diagnosisMap.set(key, {
          diagnosis_name: dd.diagnosis_name,
          diagnosis_id: dd.diagnosis_id,
          icd10_code: null,
          category: "dangerous",
          symbolic_score: 0.05,
          probabilistic_score: 0.05,
          neural_score: 0.05,
          supporting_symptoms: [dd.trigger_symptom],
          must_not_miss: true,
          emergency_protocol: dd.emergency_protocol,
          severity_level: dd.severity_level,
          recommended_tests: [],
          treatment_options: [],
          reasoning: `Must-not-miss: ${dd.emergency_protocol || "Immediate clinical evaluation required."}`,
        });
      }
    }

    // Calculate weighted fusion scores
    const fusedDiagnoses = Array.from(diagnosisMap.values()).map(d => {
      const fusedScore = (
        d.symbolic_score * WEIGHTS.symbolic +
        d.probabilistic_score * WEIGHTS.probabilistic +
        d.neural_score * WEIGHTS.neural
      );

      // Must-not-miss floor: minimum 5% even if low scores
      const finalScore = d.must_not_miss ? Math.max(fusedScore, 0.05) : fusedScore;

      return {
        ...d,
        fused_score: Math.round(finalScore * 1000) / 1000,
        fused_probability: 0, // will normalize below
        paradigm_sources: [
          d.symbolic_score > 0 ? "symbolic" : null,
          d.probabilistic_score > 0 ? "probabilistic" : null,
          d.neural_score > 0 ? "neural" : null,
        ].filter(Boolean),
      };
    });

    // Normalize to probability %
    const totalFused = fusedDiagnoses.reduce((s, d) => s + d.fused_score, 0) || 1;
    for (const d of fusedDiagnoses) {
      d.fused_probability = Math.round((d.fused_score / totalFused) * 100);
    }

    // Sort: must-not-miss first, then by fused probability
    fusedDiagnoses.sort((a, b) => {
      if (a.must_not_miss && !b.must_not_miss) return -1;
      if (!a.must_not_miss && b.must_not_miss) return 1;
      return b.fused_probability - a.fused_probability;
    });

    // Merge labs from all paradigms
    const allLabs = [...symbolicLabs];
    for (const nd of (neural.neural_diagnoses || [])) {
      for (const t of (nd.recommended_tests || [])) {
        if (!allLabs.some(l => l.test_name.toLowerCase() === t.toLowerCase())) {
          allLabs.push({ test_name: t, category: "suggested", priority: "recommended", source: "neural" });
        }
      }
    }
    // Add key differentiators as labs
    for (const kd of (neural.key_differentiators || [])) {
      if (!allLabs.some(l => l.test_name.toLowerCase() === kd.toLowerCase())) {
        allLabs.push({ test_name: kd, category: "differentiator", priority: "high", source: "neural" });
      }
    }

    // Safety alerts from all paradigms
    const safetyAlerts = [
      ...(neural.safety_alerts || []),
      ...dangerousDiagnoses.map(d => ({
        alert_type: "critical",
        message: `Must-not-miss: ${d.diagnosis_name} — ${d.emergency_protocol || "Immediate evaluation required"}`,
      })),
    ];

    // Check allergy conflicts with suggested drugs
    for (const drug of symbolicDrugs) {
      for (const allergy of allergies) {
        if (drug.generic_name.toLowerCase().includes(allergy.toLowerCase()) ||
            allergy.toLowerCase().includes(drug.generic_name.toLowerCase())) {
          safetyAlerts.push({
            alert_type: "critical",
            message: `Allergy conflict: ${drug.generic_name} — patient reports allergy to ${allergy}`,
          });
        }
      }
    }

    stageLatencies.fusion = Date.now() - fusionStart;
    stageLatencies.total = Date.now() - startMs;

    // Log to monitoring
    try {
      await sb.from("monitoring_events").insert({
        event_type: "hybrid_reasoning_complete",
        agent_name: "clinical-reasoning-engine",
        duration_ms: stageLatencies.total,
        success: true,
        metadata: {
          visit_id,
          clinic_id,
          symptom_count: allSymptoms.length,
          matched_symptoms: matchedSymptomNames.length,
          symbolic_diagnoses: symbolicDiagnoses.length,
          bayesian_diagnoses: bayesianDiagnoses.length,
          neural_diagnoses: (neural.neural_diagnoses || []).length,
          fused_diagnoses: fusedDiagnoses.length,
          dangerous_count: dangerousDiagnoses.length,
          safety_alerts: safetyAlerts.length,
          paradigm_agreement: neural.paradigm_agreement,
          confidence: neural.confidence_assessment,
          stage_latencies: stageLatencies,
        },
      });
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({
      // ── Unified output ──
      differential_diagnoses: fusedDiagnoses.slice(0, 8),
      recommended_tests: allLabs.slice(0, 12),
      treatment_options: symbolicDrugs.slice(0, 10),
      guideline_references: symbolicGuidelines.slice(0, 6),
      safety_alerts: safetyAlerts,

      // ── Reasoning metadata ──
      reasoning_summary: neural.reasoning_summary,
      reasoning_explanation: neural.reasoning_explanation,
      paradigm_agreement: neural.paradigm_agreement,
      confidence_assessment: neural.confidence_assessment,
      key_differentiators: neural.key_differentiators || [],

      // ── Per-paradigm details ──
      paradigm_details: {
        symbolic: {
          diagnoses_found: symbolicDiagnoses.length,
          symptoms_matched: matchedSymptomNames.length,
          symptoms_unmatched: unmatchedSymptoms.length,
          labs_found: symbolicLabs.length,
          drugs_found: symbolicDrugs.length,
          guidelines_found: symbolicGuidelines.length,
        },
        probabilistic: {
          diagnoses_scored: bayesianDiagnoses.length,
          top_probability: bayesianDiagnoses[0]?.probability || 0,
          priors_used: Object.keys(CATEGORY_PRIORS).length,
        },
        neural: {
          diagnoses_generated: (neural.neural_diagnoses || []).length,
          safety_alerts_generated: (neural.safety_alerts || []).length,
        },
      },
      weights: WEIGHTS,
      dangerous_diagnoses: dangerousDiagnoses,
      matched_symptoms: matchedSymptomNames,
      unmatched_symptoms: unmatchedSymptoms,
      stage_latencies: stageLatencies,
      total_ms: stageLatencies.total,
      disclaimer: "Hybrid reasoning output for clinician review. Not a final diagnosis.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("clinical-reasoning-engine error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("credits") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
