import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Language Detection =====
function detectLanguage(text: string): string {
  if (!text) return "en";
  let hi = 0, te = 0, ta = 0, en = 0;
  for (const c of text) {
    if (/[\u0900-\u097F]/.test(c)) hi++;
    else if (/[\u0C00-\u0C7F]/.test(c)) te++;
    else if (/[\u0B80-\u0BFF]/.test(c)) ta++;
    else if (/[a-zA-Z]/.test(c)) en++;
  }
  const total = hi + te + ta + en;
  if (!total) return "en";
  if (hi / total > 0.3) return "hi";
  if (te / total > 0.3) return "te";
  if (ta / total > 0.3) return "ta";
  return "en";
}

// ===== Code-Mixed Translation =====
const CODE_MIXED: Record<string, string> = {
  bukhar: "fever", "sir dard": "headache", "pet dard": "abdominal pain",
  chakkar: "dizziness", khansi: "cough", ulti: "vomiting", dast: "diarrhea",
  "badan dard": "body pain", "seene mein dard": "chest pain",
  "gala kharab": "sore throat", "kamar dard": "back pain", thakan: "fatigue",
  "sans lene mein taklif": "shortness of breath", jukham: "cold",
};

function translateCodeMixed(text: string): string {
  let r = text.toLowerCase();
  for (const [p, e] of Object.entries(CODE_MIXED).sort(([a], [b]) => b.length - a.length)) {
    r = r.replace(new RegExp(p, "gi"), e);
  }
  return r;
}

// ===== Symptom Extraction =====
const SYMPTOM_LIST = [
  "fever","headache","cough","cold","body pain","chest pain","abdominal pain",
  "back pain","knee pain","joint pain","neck pain","sore throat","runny nose",
  "shortness of breath","difficulty breathing","dizziness","nausea","vomiting",
  "diarrhea","constipation","fatigue","weakness","loss of appetite","weight loss",
  "insomnia","palpitations","sweating","rash","itching","swelling","numbness",
  "tingling","blurred vision","ear pain","urinary burning","frequent urination",
  "wheezing","chills","night sweats","heartburn","bloating","stiff neck",
  "photophobia","confusion","fainting","dyspnea","diaphoresis","urticaria","edema",
];

const DURATION_RE = [
  /(?:since|for|from|past)\s+(\d+\s*(?:day|days|week|weeks|month|months|hour|hours|year|years))/i,
  /(\d+\s*(?:day|days|week|weeks|month|months|hour|hours|year|years))\s+(?:ago|back)/i,
  /(?:since\s+)?(?:yesterday|today|last\s+(?:night|week|month))/i,
];

const SEVERITY_MAP: Record<string, string> = {
  mild: "mild", slight: "mild", moderate: "moderate",
  severe: "severe", intense: "severe", unbearable: "critical", worst: "critical",
};

const ALLERGY_RE = /(?:allergic\s+to|allergy\s+to|cannot\s+take)\s+([\w\s,]+)/i;

function extractPhrases(text: string) {
  const lower = text.toLowerCase();
  const symptoms = SYMPTOM_LIST.filter(s => lower.includes(s));
  let duration = "";
  for (const re of DURATION_RE) { const m = lower.match(re); if (m) { duration = m[0]; break; } }
  let severity = "unknown";
  for (const [k, v] of Object.entries(SEVERITY_MAP)) { if (lower.includes(k)) { severity = v; break; } }
  const allergies: string[] = [];
  const am = lower.match(ALLERGY_RE);
  if (am?.[1]) allergies.push(...am[1].split(/[,&]/).map(a => a.trim()).filter(Boolean));
  const medications: string[] = [];
  const medRe = /(?:paracetamol|ibuprofen|aspirin|crocin|dolo|combiflam|metformin|atorvastatin|omeprazole|amlodipine|losartan)/gi;
  let mm; while ((mm = medRe.exec(lower))) medications.push(mm[0]);
  return { symptoms, duration, severity, allergies, medications };
}

// ===== Risk Flag Detection =====
interface RiskFlag { flag_id: string; condition: string; severity: string; trigger_symptoms: string[]; action: string; }

const RISK_RULES = [
  { id: "acs", condition: "Possible Acute Coronary Syndrome", severity: "critical",
    triggers: [["chest pain","sweating"],["chest pain","shortness of breath"],["chest pain","nausea"]],
    action: "Immediate ECG and troponin." },
  { id: "meningitis", condition: "Possible Meningitis", severity: "critical",
    triggers: [["fever","stiff neck"],["fever","headache","photophobia"]],
    action: "Urgent LP consideration. Empirical antibiotics." },
  { id: "pe", condition: "Possible Pulmonary Embolism", severity: "critical",
    triggers: [["dyspnea","chest pain"],["shortness of breath","chest pain"]],
    action: "Consider CTPA. D-dimer." },
  { id: "sepsis", condition: "Possible Sepsis", severity: "critical",
    triggers: [["fever","confusion","weakness"]],
    action: "Blood cultures, lactate. Sepsis-3 criteria." },
];

function detectRiskFlags(symptoms: string[], vitals?: any): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const set = new Set(symptoms.map(s => s.toLowerCase()));
  for (const rule of RISK_RULES) {
    for (const combo of rule.triggers) {
      if (combo.every(t => set.has(t))) {
        flags.push({ flag_id: rule.id, condition: rule.condition, severity: rule.severity, trigger_symptoms: combo, action: rule.action });
        break;
      }
    }
  }
  if (vitals?.temperature >= 39.5) flags.push({ flag_id: "high_fever", condition: "High Fever ≥39.5°C", severity: "high", trigger_symptoms: [], action: "Investigate source." });
  if (vitals?.spo2 != null && vitals.spo2 < 92) flags.push({ flag_id: "hypoxia", condition: "Hypoxia SpO₂<92%", severity: "critical", trigger_symptoms: [], action: "Supplemental O₂." });
  return flags;
}

// ===== Confidence Scoring =====
function computeConfidence(ctx: any): number {
  let score = 0;
  if (ctx.chief_complaint) score += 0.25;
  if (ctx.patient_age != null) score += 0.075;
  if (ctx.patient_sex) score += 0.075;
  score += Math.min((ctx.symptoms?.length || 0) / 3, 1) * 0.2;
  if (ctx.duration) score += 0.05;
  const vitalCount = ctx.vitals ? Object.values(ctx.vitals).filter((v: any) => v != null).length : 0;
  score += Math.min(vitalCount / 4, 1) * 0.15;
  if (ctx.medications?.length > 0) score += 0.05;
  if (ctx.allergies?.length > 0) score += 0.05;
  if (ctx.lab_results?.length > 0) score += 0.05;
  score += Math.min((ctx.input_sources?.length || 1) / 2, 1) * 0.05;
  return Math.round(score * 100) / 100;
}

// ===== Concept Mapping via DB =====
async function mapConcepts(supabaseClient: any, phrases: string[]) {
  const SYNONYMS: Record<string, string> = {
    "breathlessness": "dyspnea", "shortness of breath": "dyspnea",
    "difficulty breathing": "dyspnea", "heart attack": "myocardial infarction",
    "high blood pressure": "hypertension", "sugar": "diabetes mellitus",
    "loose motions": "diarrhea", "stomach pain": "abdominal pain",
    "tiredness": "fatigue", "body ache": "body pain", "burning urination": "dysuria",
  };

  const mapped = [];
  for (const p of phrases) {
    const lower = p.toLowerCase().trim();
    // Check DB first
    const { data } = await supabaseClient
      .from("symptom_language_map")
      .select("clinical_concept, snomed_id, confidence_score")
      .eq("phrase", lower)
      .limit(1);
    if (data?.length) {
      mapped.push({ original: p, concept: data[0].clinical_concept, snomed_id: data[0].snomed_id, confidence: data[0].confidence_score, source: "symptom_language_map" });
    } else if (SYNONYMS[lower]) {
      mapped.push({ original: p, concept: SYNONYMS[lower], snomed_id: null, confidence: 0.9, source: "synonym_fallback" });
    } else {
      mapped.push({ original: p, concept: lower, snomed_id: null, confidence: 0.5, source: "passthrough" });
    }
  }
  return mapped;
}

// ===== Main Handler =====
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const startTime = Date.now();
    const body = await req.json();
    const { visit_id, patient_id, clinic_id, raw_text, input_type = "form", structured_data, vitals, lab_results, patient_age, patient_sex, previous_conditions } = body;

    if (!visit_id || !patient_id || !clinic_id) {
      return new Response(JSON.stringify({ error: "visit_id, patient_id, clinic_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    // 1. Store raw input
    const inputText = raw_text || "";
    if (inputText) {
      await supabaseClient.from("intake_raw_inputs").insert({
        visit_id, clinic_id, input_type,
        raw_text: inputText,
        language: detectLanguage(inputText),
      });
    }

    // 2. Language processing
    const language = detectLanguage(inputText);
    let normalized = inputText.trim().replace(/\s+/g, " ");
    if (language !== "en") normalized = translateCodeMixed(normalized);

    // 3. Extraction
    const extraction = extractPhrases(normalized);

    // 4. Merge with structured data
    const merge = (a: string[], b?: string[]) => [...new Set([...(a || []), ...(b || [])].map(s => s.toLowerCase().trim()).filter(Boolean))];
    const symptoms = merge(extraction.symptoms, structured_data?.symptoms);
    const allergies = merge(extraction.allergies, structured_data?.allergies);
    const medications = merge(extraction.medications, structured_data?.medications);
    const chiefComplaint = structured_data?.chief_complaint || symptoms[0] || "";
    const duration = structured_data?.duration || extraction.duration || "";
    const severity = structured_data?.severity || extraction.severity || "unknown";

    // 5. Concept mapping
    const mappedSymptoms = await mapConcepts(supabaseClient, symptoms);

    // 6. Risk flags
    const riskFlags = detectRiskFlags(symptoms, vitals);

    // 7. Missing info
    const missingInfo: string[] = [];
    if (!patient_age) missingInfo.push("patient_age");
    if (!patient_sex) missingInfo.push("patient_sex");
    if (!chiefComplaint) missingInfo.push("chief_complaint");
    if (!vitals || Object.keys(vitals).length === 0) missingInfo.push("vitals");
    if (allergies.length === 0) missingInfo.push("allergy_status");

    // 8. Confidence
    const confidence = computeConfidence({
      chief_complaint: chiefComplaint, symptoms, duration, severity,
      vitals, allergies, medications, lab_results: lab_results || [],
      patient_age, patient_sex, input_sources: [input_type],
    });

    // 9. Build context object
    const contextObject = {
      visit_id, patient_id, clinic_id,
      chief_complaint: chiefComplaint,
      symptoms: mappedSymptoms,
      associated_symptoms: [],
      duration, severity,
      risk_factors: previous_conditions || [],
      allergies, current_medications: medications,
      previous_conditions: previous_conditions || [],
      vitals: vitals || {},
      lab_results: lab_results || [],
      risk_flags: riskFlags,
      missing_information: missingInfo,
      context_confidence: confidence,
      input_sources: [input_type],
      built_by: "pcie_v1",
    };

    // 10. Store in patient_context_objects
    const { data: stored, error: storeError } = await supabaseClient
      .from("patient_context_objects")
      .insert(contextObject)
      .select("id")
      .single();

    if (storeError) {
      console.error("[PCIE] Store error:", storeError);
    }

    // 11. Audit log
    const authHeader = req.headers.get("Authorization");
    let actorId = "system";
    if (authHeader) {
      try {
        const { data: { user } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        }).auth.getUser();
        if (user) actorId = user.id;
      } catch { /* use system */ }
    }

    await supabaseClient.from("audit_logs").insert({
      actor_id: actorId,
      clinic_id,
      event_type: "pcie_context_generated",
      target_type: "patient_context_objects",
      target_id: stored?.id || visit_id,
      metadata: {
        visit_id,
        patient_id,
        symptom_count: symptoms.length,
        risk_flag_count: riskFlags.length,
        confidence,
        processing_time_ms: Date.now() - startTime,
        language,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      context_id: stored?.id,
      context: contextObject,
      processing_time_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[PCIE] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
