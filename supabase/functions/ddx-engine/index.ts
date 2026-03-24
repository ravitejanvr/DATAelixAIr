import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════
// INLINE TERMINOLOGY NORMALIZER
// Mirrors src/services/context_engine/terminology_normalizer.ts
// Must be kept in-sync. Resolves synonyms → canonical symptoms
// so graph lookups always hit the correct symptom rows.
// ══════════════════════════════════════════════════════════════
const SYNONYM_MAP: Record<string, string> = {
  // Respiratory
  "cough with sputum": "productive cough",
  "cough with phlegm": "productive cough",
  "phlegmy cough": "productive cough",
  "wet cough": "productive cough",
  "nonproductive cough": "dry cough",
  "shortness of breath": "dyspnea",
  "breathlessness": "dyspnea",
  "difficulty breathing": "dyspnea",
  "breathing difficulty": "dyspnea",
  "can't breathe": "dyspnea",
  "labored breathing": "dyspnea",
  "sob": "dyspnea",
  "rhinorrhea": "runny nose",
  "nasal discharge": "runny nose",
  "stuffy nose": "nasal congestion",
  "blocked nose": "nasal congestion",
  "nose block": "nasal congestion",
  "sinus pressure": "facial pain",
  "sinus pain": "facial pain",
  "coughing up blood": "hemoptysis",
  "blood in sputum": "hemoptysis",
  // GI
  "stomach pain": "abdominal pain",
  "belly pain": "abdominal pain",
  "tummy pain": "abdominal pain",
  "stomach ache": "abdominal pain",
  "abdominal discomfort": "abdominal pain",
  "stomach cramps": "abdominal cramps",
  "belly cramps": "abdominal cramps",
  "throwing up": "vomiting",
  "puking": "vomiting",
  "emesis": "vomiting",
  "feeling sick": "nausea",
  "queasy": "nausea",
  "loose stools": "diarrhea",
  "loose motions": "diarrhea",
  "watery stools": "diarrhea",
  "frequent stools": "diarrhea",
  "acid reflux": "heartburn",
  "acidity": "heartburn",
  "burning in stomach": "epigastric pain",
  "upper stomach pain": "epigastric pain",
  "gas": "bloating",
  "flatulence": "bloating",
  "indigestion": "bloating",
  "no appetite": "loss of appetite",
  "not hungry": "loss of appetite",
  "poor appetite": "loss of appetite",
  "decreased appetite": "loss of appetite",
  "blood in stool": "bloody stool",
  "rectal bleeding": "bloody stool",
  "passing blood": "bloody stool",
  // Cardiovascular
  "heart racing": "palpitations",
  "heart pounding": "palpitations",
  "irregular heartbeat": "palpitations",
  "fast heart": "tachycardia",
  "rapid pulse": "tachycardia",
  "chest tightness": "chest pain",
  "chest pressure": "chest pain",
  "chest discomfort": "chest pain",
  "heavy sweating": "diaphoresis",
  "profuse sweating": "diaphoresis",
  "cold sweats": "diaphoresis",
  "swollen legs": "edema",
  "swollen feet": "edema",
  "ankle swelling": "edema",
  "leg swelling": "edema",
  "fluid retention": "edema",
  "cannot lie flat": "orthopnea",
  "wakes up breathless": "orthopnea",
  // Neurological
  "head pain": "headache",
  "migraine": "headache",
  "giddiness": "dizziness",
  "lightheadedness": "dizziness",
  "vertigo": "dizziness",
  "room spinning": "dizziness",
  "passed out": "syncope",
  "fainted": "syncope",
  "fainting": "syncope",
  "loss of consciousness": "syncope",
  "stiff neck": "neck stiffness",
  "neck rigidity": "neck stiffness",
  "sensitivity to light": "photophobia",
  "light sensitivity": "photophobia",
  "can't see clearly": "blurred vision",
  "vision blurry": "blurred vision",
  "double vision": "blurred vision",
  "pins and needles": "tingling",
  "prickling": "tingling",
  "weakness in arm": "weakness",
  "weakness in leg": "weakness",
  "general weakness": "weakness",
  "body weakness": "weakness",
  "slurred speech": "speech difficulty",
  "difficulty speaking": "speech difficulty",
  "cannot speak": "speech difficulty",
  // Musculoskeletal
  "body pain": "body aches",
  "generalized pain": "body aches",
  "all over pain": "body aches",
  "muscle ache": "muscle pain",
  "myalgia": "muscle pain",
  "muscle soreness": "muscle pain",
  "joint ache": "joint pain",
  "arthralgia": "joint pain",
  "knee pain": "joint pain",
  "hip pain": "joint pain",
  "shoulder pain": "joint pain",
  "low back pain": "back pain",
  "lower back pain": "back pain",
  "lumbar pain": "back pain",
  "lbp": "back pain",
  // Genitourinary
  "painful urination": "dysuria",
  "burning urination": "dysuria",
  "urinary burning": "dysuria",
  "burning when peeing": "dysuria",
  "peeing a lot": "polyuria",
  "frequent urination": "polyuria",
  "urinary frequency": "polyuria",
  "blood in urine": "hematuria",
  "side pain": "flank pain",
  "kidney area pain": "flank pain",
  "excessive thirst": "polydipsia",
  "always thirsty": "polydipsia",
  // Dermatological
  "skin rash": "rash",
  "eruption": "rash",
  "skin lesion": "rash",
  "hives": "rash",
  "pruritus": "itching",
  "scratching": "itching",
  "itchy skin": "itching",
  // General/Constitutional
  "tiredness": "fatigue",
  "exhaustion": "fatigue",
  "no energy": "fatigue",
  "lethargic": "fatigue",
  "lethargy": "fatigue",
  "feeling tired": "fatigue",
  "low grade fever": "mild fever",
  "slight fever": "mild fever",
  "high fever": "fever",
  "temperature": "fever",
  "febrile": "fever",
  "pyrexia": "fever",
  "rigor": "chills",
  "shivering": "chills",
  "cold feeling": "chills",
  "unable to sleep": "insomnia",
  "sleep problems": "insomnia",
  "sweating at night": "night sweats",
  "nocturnal sweating": "night sweats",
  "lost weight": "weight loss",
  "losing weight": "weight loss",
  "unintentional weight loss": "weight loss",
  "gained weight": "weight gain",
  "putting on weight": "weight gain",
  "feeling unwell": "malaise",
  "generally unwell": "malaise",
  "not feeling well": "malaise",
  "dehydrated": "dehydration",
  "dry mouth": "dehydration",
};

function normalizeSymptom(s: string): string {
  const lower = s.toLowerCase().trim();
  return SYNONYM_MAP[lower] || lower;
}

function normalizeSymptoms(symptoms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of symptoms) {
    const n = normalizeSymptom(s);
    if (!seen.has(n)) { seen.add(n); result.push(n); }
  }
  return result;
}

/**
 * DDX Engine v5 — Bayesian Differential Diagnosis
 *
 * KEY FIX (v5): Uses `symptom_likelihoods` table (5000+ edges)
 * instead of `symptom_diagnosis_map` (152 edges).
 * 
 * Pipeline: Normalize → symptom resolution → graph traversal → Bayesian scoring
 *           → dangerous dx injection → labs/meds/guidelines → output
 *
 * P(D|S) ∝ P(S|D) × P(D) × modifiers(age, vitals, history, risk)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth — accept both user tokens and service role key (for inter-function calls)
    const token = authHeader.replace("Bearer ", "").trim();
    let isServiceRole = false;
    try {
      const payloadB64 = token.split(".")[1];
      if (payloadB64) {
        const payload = JSON.parse(atob(payloadB64));
        isServiceRole = payload.role === "service_role";
      }
    } catch (_) { /* not a valid JWT */ }
    
    if (!isServiceRole) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const {
      symptoms = [],
      vitals = {},
      age = null,
      sex = null,
      weight_kg = null,
      medical_history = [],
      current_medications = [],
      allergies = [],
      risk_factors = [],
      visit_id = null,
      clinic_id = null,
      cco_id = null,
      physiological_context = null,
    } = body;

    const physioFilter = physiological_context?.candidate_diagnosis_ids || [];

    if (!symptoms.length) {
      return new Response(JSON.stringify({ error: "symptoms[] is required" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // STAGE 0: TERMINOLOGY NORMALIZATION
    // ═══════════════════════════════════════════════════
    const rawSymptoms = (symptoms || []).map((s: any) => String(s || "").toLowerCase().trim()).filter(Boolean);
    const normalizedSymptoms = normalizeSymptoms(rawSymptoms);
    const allergiesLower = (allergies || []).map((a: any) => String(a || "").toLowerCase()).filter(Boolean);
    const historyLower = (medical_history || []).map((h: any) => String(h || "").toLowerCase()).filter(Boolean);

    // ═══════════════════════════════════════════════════
    // STAGE 1: SYMPTOM RESOLUTION (exact + fuzzy)
    // ═══════════════════════════════════════════════════
    const stageStart1 = Date.now();

    const { data: exactMatches } = await supabase
      .from("symptoms")
      .select("id, symptom_name")
      .in("symptom_name", normalizedSymptoms);

    const matchedIds = new Set((exactMatches || []).map((s: any) => s.id));
    const matchedNames = new Set((exactMatches || []).map((s: any) => s.symptom_name));
    const unmatched = normalizedSymptoms.filter((s: string) => !matchedNames.has(s));

    // Also try raw (pre-normalization) names for fuzzy
    const rawUnmatched = rawSymptoms.filter((s: string) => !matchedNames.has(s) && !normalizedSymptoms.includes(s));
    const allUnmatched = [...new Set([...unmatched, ...rawUnmatched])];

    // Fuzzy for unmatched
    let fuzzyMatches: any[] = [];
    if (allUnmatched.length > 0) {
      const fuzzyPromises = allUnmatched.map(s =>
        supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
      );
      const fuzzyResults = await Promise.all(fuzzyPromises);
      for (const res of fuzzyResults) {
        for (const s of res.data || []) {
          if (!matchedIds.has(s.id)) { matchedIds.add(s.id); fuzzyMatches.push(s); }
        }
      }
    }

    const allMatchedSymptoms = [...(exactMatches || []), ...fuzzyMatches];
    const symptomIds = Array.from(matchedIds);
    const stage1Ms = Date.now() - stageStart1;

    // Graph miss
    if (symptomIds.length === 0) {
      await logEvent(supabase, "graph_miss", clinic_id, visit_id, normalizedSymptoms, Date.now() - start);
      return respond({
        differential_diagnoses: [],
        recommended_labs: [],
        suggested_medications: [],
        guideline_recommendations: [],
        dangerous_diagnoses: [],
        matched_symptoms: [],
        unmatched_symptoms: normalizedSymptoms,
        dangerous_diagnoses_injected: 0,
        must_not_miss_count: 0,
        execution_ms: Date.now() - start,
        stage_latencies: { symptom_resolution: stage1Ms },
        bayesian_model: true,
        source: "ddx_engine_v5",
        graph_miss: true,
      });
    }

    // ═══════════════════════════════════════════════════
    // STAGE 2: GRAPH TRAVERSAL + BAYESIAN SCORING
    // Uses symptom_likelihoods (5000+ edges) instead of
    // symptom_diagnosis_map (152 edges)
    // ═══════════════════════════════════════════════════
    const stageStart2 = Date.now();

    const [likelihoodRes, dangerousRes, suppressionRes] = await Promise.all([
      supabase
        .from("symptom_likelihoods")
        .select("symptom_id, diagnosis_id, likelihood_value, diagnoses!inner(id, diagnosis_name, category, icd10_code, is_active)")
        .in("symptom_id", symptomIds)
        .eq("diagnoses.is_active", true)
        .order("likelihood_value", { ascending: false }),
      supabase
        .from("dangerous_diagnoses")
        .select("*, diagnoses(id, diagnosis_name, icd10_code, category)")
        .eq("must_not_miss", true)
        .order("priority", { ascending: true }),
      supabase
        .from("diagnosis_suppression_rules")
        .select("dominant_diagnosis_id, suppressed_diagnosis_id, suppression_factor, requires_absence_of"),
    ]);

    // Build symptom→diagnosis association matrix
    interface DiagEntry {
      diagnosis: any;
      symptom_scores: Map<string, number>;
      symptom_names: string[];
    }

    const diagMap = new Map<string, DiagEntry>();

    for (const link of likelihoodRes.data || []) {
      const d = (link as any).diagnoses;
      if (!d) continue;
      const existing = diagMap.get(d.id);
      const symName = allMatchedSymptoms.find((s: any) => s.id === link.symptom_id)?.symptom_name || "";
      if (existing) {
        if (!existing.symptom_scores.has(link.symptom_id)) {
          existing.symptom_scores.set(link.symptom_id, link.likelihood_value);
          if (symName) existing.symptom_names.push(symName);
        }
      } else {
        const scores = new Map<string, number>();
        scores.set(link.symptom_id, link.likelihood_value);
        diagMap.set(d.id, {
          diagnosis: d,
          symptom_scores: scores,
          symptom_names: symName ? [symName] : [],
        });
      }
    }

    // ── Bayesian-Inspired Scoring ──
    // Score = prior × Σ P(Sᵢ|D) × coverage² × modifiers
    // Uses ADDITIVE likelihood (sum) instead of multiplicative (product)
    // because without P(¬S|D), products penalize more matches.
    const CATEGORY_PRIORS: Record<string, number> = {
      infectious: 0.25,
      respiratory: 0.20,
      gastrointestinal: 0.12,
      gastroenterology: 0.10,
      cardiovascular: 0.08,
      neurological: 0.06,
      endocrine: 0.05,
      musculoskeletal: 0.05,
      dermatological: 0.04,
      psychiatric: 0.03,
      pediatric: 0.03,
      geriatric: 0.03,
      oncological: 0.02,
      hematological: 0.02,
      hematologic: 0.02,
      autoimmune: 0.02,
      rheumatological: 0.02,
      gynecological: 0.03,
      metabolic: 0.02,
      environmental: 0.01,
    };

    const DEFAULT_PRIOR = 0.05;
    const MIN_SCORE_THRESHOLD = 5;

    // Organ System Map
    const ORGAN_SYSTEM_MAP: Record<string, string[]> = {
      respiratory: ["cough", "dyspnea", "wheezing", "sputum", "chest tightness", "hemoptysis", "productive cough", "tachypnea", "dry cough"],
      cardiovascular: ["chest pain", "palpitations", "syncope", "edema", "diaphoresis", "orthopnea", "near-syncope"],
      gastrointestinal: ["nausea", "vomiting", "diarrhea", "abdominal pain", "abdominal cramps", "constipation", "bloating", "loss of appetite", "heartburn", "epigastric pain"],
      neurological: ["headache", "severe headache", "dizziness", "confusion", "seizure", "weakness", "numbness", "photophobia", "neck stiffness", "blurred vision"],
      dermatological: ["rash", "itching", "urticaria"],
      infectious: ["fever", "chills", "fatigue", "malaise", "body aches", "mild fever", "night sweats", "dehydration"],
      musculoskeletal: ["joint pain", "back pain", "muscle pain", "stiffness"],
      genitourinary: ["dysuria", "polyuria", "hematuria", "flank pain", "polydipsia"],
    };

    const totalSymptomCount = normalizedSymptoms.length;
    const isPediatric = age != null && age < 18;
    const isElderly = age != null && age > 65;

    // ══════════════════════════════════════════════════════
    // PATTERN INFERENCE LAYER (Phase 5)
    // Detects clinical patterns from multi-signal evidence
    // and assigns pattern-level boosts to matching diagnoses
    // ══════════════════════════════════════════════════════
    const symSetP = new Set(normalizedSymptoms);
    const detectedPatterns: Array<{ pattern: string; confidence: number; boostDiagnoses: string[]; boost: number }> = [];

    // Pattern 1: Cardiac ischemia pattern
    const cardiacSignals = [symSetP.has("chest pain"), symSetP.has("diaphoresis"), symSetP.has("dyspnea"),
      symSetP.has("palpitations"), symSetP.has("orthopnea"), symSetP.has("syncope"),
      age != null && age > 50, vitals.pulse && vitals.pulse > 100].filter(Boolean).length;
    if (cardiacSignals >= 3) {
      detectedPatterns.push({ pattern: "cardiac_ischemia", confidence: Math.min(0.9, cardiacSignals * 0.15),
        boostDiagnoses: ["infarction", "angina", "coronary", "heart failure"], boost: 1.8 + cardiacSignals * 0.15 });
    }

    // Pattern 2: Embolic event pattern
    const embolicSignals = [symSetP.has("dyspnea"), symSetP.has("chest pain"), symSetP.has("hemoptysis"),
      symSetP.has("tachycardia") || (vitals.pulse && vitals.pulse > 110),
      vitals.spo2 && vitals.spo2 < 94, symSetP.has("leg swelling") || symSetP.has("calf pain")].filter(Boolean).length;
    if (embolicSignals >= 3) {
      detectedPatterns.push({ pattern: "embolic_event", confidence: Math.min(0.85, embolicSignals * 0.18),
        boostDiagnoses: ["embolism", "thrombosis", "dvt"], boost: 2.0 });
    }

    // Pattern 3: Infection/Sepsis pattern
    const infectionSignals = [(symSetP.has("fever") || symSetP.has("mild fever") || symSetP.has("chills")),
      (vitals.temperature && vitals.temperature > 38.5), symSetP.has("confusion"),
      (vitals.pulse && vitals.pulse > 100), (vitals.bp_systolic && vitals.bp_systolic < 100),
      symSetP.has("fatigue") || symSetP.has("malaise")].filter(Boolean).length;
    if (infectionSignals >= 3) {
      detectedPatterns.push({ pattern: "systemic_infection", confidence: Math.min(0.9, infectionSignals * 0.17),
        boostDiagnoses: ["sepsis", "pneumonia", "meningitis", "pyelonephritis", "endocarditis"], boost: 1.8 });
    }

    // Pattern 4: GI inflammation pattern
    const giSignals = [symSetP.has("abdominal pain") || symSetP.has("epigastric pain"),
      symSetP.has("nausea") || symSetP.has("vomiting"), symSetP.has("fever") || symSetP.has("mild fever"),
      symSetP.has("loss of appetite"), symSetP.has("diarrhea") || symSetP.has("bloating")].filter(Boolean).length;
    if (giSignals >= 3) {
      detectedPatterns.push({ pattern: "gi_inflammation", confidence: Math.min(0.85, giSignals * 0.18),
        boostDiagnoses: ["appendicitis", "cholecystitis", "pancreatitis", "gastroenteritis", "colitis", "diverticulitis"], boost: 1.6 });
    }

    // Pattern 5: Neurological deficit pattern
    const neuroSignals = [symSetP.has("weakness"), symSetP.has("speech difficulty"),
      symSetP.has("blurred vision") || symSetP.has("double vision"), symSetP.has("numbness"),
      symSetP.has("confusion"), symSetP.has("headache") || symSetP.has("severe headache"),
      vitals.bp_systolic && vitals.bp_systolic > 180].filter(Boolean).length;
    if (neuroSignals >= 3) {
      detectedPatterns.push({ pattern: "neurological_deficit", confidence: Math.min(0.85, neuroSignals * 0.17),
        boostDiagnoses: ["stroke", "hemorrhage", "transient ischemic", "encephalitis"], boost: 2.0 });
    }

    // Pattern 6: Meningeal pattern
    const meningealSignals = [symSetP.has("headache") || symSetP.has("severe headache"),
      symSetP.has("neck stiffness"), symSetP.has("photophobia"),
      symSetP.has("fever") || symSetP.has("mild fever"), symSetP.has("vomiting")].filter(Boolean).length;
    if (meningealSignals >= 3) {
      detectedPatterns.push({ pattern: "meningeal_irritation", confidence: Math.min(0.9, meningealSignals * 0.2),
        boostDiagnoses: ["meningitis", "subarachnoid"], boost: 2.5 });
    }

    // Pattern 7: Endocrine metabolic pattern
    const endoSignals = [symSetP.has("polyuria"), symSetP.has("polydipsia"),
      symSetP.has("weight loss") || symSetP.has("weight gain"),
      symSetP.has("fatigue"), symSetP.has("blurred vision")].filter(Boolean).length;
    if (endoSignals >= 3) {
      detectedPatterns.push({ pattern: "endocrine_metabolic", confidence: Math.min(0.85, endoSignals * 0.18),
        boostDiagnoses: ["diabetes", "hypothyroid", "hyperthyroid", "ketoacidosis", "addison"], boost: 2.0 });
    }

    // Pattern 8: Tropical fever pattern (important for India market)
    const tropicalSignals = [(symSetP.has("fever") || symSetP.has("mild fever")),
      (vitals.temperature && vitals.temperature > 39.0),
      symSetP.has("body aches") || symSetP.has("muscle pain"),
      symSetP.has("headache"), symSetP.has("rash"),
      symSetP.has("joint pain"), symSetP.has("chills")].filter(Boolean).length;
    if (tropicalSignals >= 4) {
      detectedPatterns.push({ pattern: "tropical_fever", confidence: Math.min(0.85, tropicalSignals * 0.15),
        boostDiagnoses: ["dengue", "malaria", "typhoid", "chikungunya", "leptospirosis"], boost: 2.0 });
    }

    // ══════════════════════════════════════════════════════
    // COMMON CONDITION PRIORS (Phase 5 - Incomplete fix)
    // For single/few-symptom presentations, boost the most
    // epidemiologically likely diagnoses
    // ══════════════════════════════════════════════════════
    const COMMON_CONDITION_BOOSTS: Record<string, string[]> = {
      "headache": ["tension headache", "migraine"],
      "severe headache": ["migraine", "tension headache"],
      "fatigue": ["iron deficiency anemia", "hypothyroidism", "type 2 diabetes mellitus"],
      "fever": ["viral upper respiratory infection", "influenza", "dengue fever", "malaria"],
      "mild fever": ["viral upper respiratory infection", "urinary tract infection"],
      "dry cough": ["acute bronchitis", "viral upper respiratory infection", "allergic rhinitis"],
      "productive cough": ["acute bronchitis", "community acquired pneumonia"],
      "cough": ["acute bronchitis", "viral upper respiratory infection"],
      "abdominal pain": ["irritable bowel syndrome", "peptic ulcer disease", "acute gastroenteritis"],
      "chest pain": ["costochondritis", "gastroesophageal reflux disease", "musculoskeletal chest pain"],
      "back pain": ["lumbar strain", "sciatica", "musculoskeletal pain"],
      "joint pain": ["osteoarthritis", "gout", "rheumatoid arthritis"],
      "dizziness": ["benign positional vertigo", "vasovagal syncope", "anemia"],
      "dyspnea": ["asthma exacerbation", "anxiety", "anemia"],
      "nausea": ["acute gastroenteritis", "peptic ulcer disease"],
      "diarrhea": ["acute gastroenteritis", "irritable bowel syndrome"],
      "rash": ["allergic dermatitis", "viral exanthem", "urticaria"],
      "dysuria": ["urinary tract infection", "cystitis"],
      "syncope": ["vasovagal syncope", "cardiac syncope", "orthostatic hypotension"],
      "palpitations": ["anxiety", "atrial fibrillation", "supraventricular tachycardia"],
      "insomnia": ["generalized anxiety disorder", "major depressive disorder"],
      "bloating": ["irritable bowel syndrome", "functional dyspepsia"],
      "constipation": ["irritable bowel syndrome", "hypothyroidism"],
      "runny nose": ["allergic rhinitis", "viral upper respiratory infection"],
      "nasal congestion": ["allergic rhinitis", "acute sinusitis"],
      "weight loss": ["hyperthyroidism", "type 2 diabetes mellitus", "tuberculosis"],
      "weight gain": ["hypothyroidism", "cushings syndrome"],
      "flank pain": ["nephrolithiasis", "pyelonephritis"],
      "hematuria": ["nephrolithiasis", "urinary tract infection"],
    };
    const isIncomplete = totalSymptomCount <= 2;

    const bayesianScores: Array<{
      diagnosis_id: string;
      diagnosis_name: string;
      icd10_code: string | null;
      category: string;
      probability: number;
      posterior: number;
      prior: number;
      likelihood: number;
      symptom_coverage: number;
      supporting_symptoms: string[];
      contradicting_factors: string[];
      must_not_miss: boolean;
      emergency_protocol?: string;
      guideline_source?: string;
      severity_level?: string;
    }> = [];

    for (const [diagId, entry] of diagMap) {
      const d = entry.diagnosis;
      const diagName = (d.diagnosis_name || "").toLowerCase();
      const category = (d.category || "").toLowerCase();

      // P(D) — prior
      let prior = CATEGORY_PRIORS[category] || DEFAULT_PRIOR;

      // Age-adjusted priors
      if (isPediatric && category === "pediatric") prior *= 2.0;
      if (isElderly && (diagName.includes("infarction") || diagName.includes("stroke") || diagName.includes("pneumonia"))) prior *= 1.8;
      if (isPediatric && (diagName.includes("infarction") || diagName.includes("stroke"))) prior *= 0.1;

      // Sex-adjusted
      if (sex === "male" && diagName.includes("ectopic pregnancy")) prior = 0;
      if (sex === "female" && diagName.includes("prostate")) prior = 0;

      // History-adjusted
      if (historyLower.some(h => diagName.includes(h))) prior *= 1.5;

      // ── COMMON CONDITION PRIOR BOOST (Phase 5 - Incomplete) ──
      // For single/few-symptom cases, boost epidemiologically common diagnoses
      if (isIncomplete) {
        for (const sym of normalizedSymptoms) {
          const commonDx = COMMON_CONDITION_BOOSTS[sym] || [];
          if (commonDx.some(cd => diagName.includes(cd.toLowerCase()) || cd.toLowerCase().includes(diagName))) {
            prior *= 3.0; // Strong boost for common conditions in incomplete presentations
            break;
          }
        }
      }

      // ── PATTERN INFERENCE BOOST (Phase 5) ──
      // Apply detected pattern boosts to matching diagnoses
      let patternBoost = 1.0;
      for (const pat of detectedPatterns) {
        if (pat.boostDiagnoses.some(bd => diagName.includes(bd))) {
          patternBoost *= pat.boost;
        }
      }

      // Σ P(Sᵢ|D) — ADDITIVE likelihood (rewards more matches)
      let likelihoodSum = 0;
      for (const [, score] of entry.symptom_scores) {
        likelihoodSum += Math.max(0.01, Math.min(0.99, score));
      }

      // Coverage = fraction of patient symptoms explained by this diagnosis
      const coverage = entry.symptom_scores.size / totalSymptomCount;
      // Coverage bonus: quadratic to strongly reward high-coverage diagnoses
      const coverageBonus = Math.pow(coverage, 1.5);

      // Vital sign modifiers
      let vitalModifier = 1.0;
      if (vitals.spo2 && vitals.spo2 < 94 && (diagName.includes("pneumonia") || diagName.includes("embolism") || diagName.includes("respiratory"))) {
        vitalModifier *= 1.6;
      }
      if (vitals.temperature && vitals.temperature > 38.5 && (diagName.includes("infection") || diagName.includes("sepsis") || diagName.includes("dengue") || diagName.includes("malaria"))) {
        vitalModifier *= 1.4;
      }
      if (vitals.pulse && vitals.pulse > 100 && (diagName.includes("infarction") || diagName.includes("embolism") || diagName.includes("sepsis"))) {
        vitalModifier *= 1.3;
      }
      if (vitals.bp_systolic && vitals.bp_systolic > 180 && diagName.includes("hypertensive")) {
        vitalModifier *= 1.5;
      }

      // Risk factor modifier
      let riskModifier = 1.0;
      for (const rf of risk_factors) {
        if (diagName.includes(rf.toLowerCase())) riskModifier *= 1.3;
      }

      // ── CONDITIONAL LIKELIHOOD: SYMPTOM COMBINATION BOOSTERS (Phase 4) ──
      // High-value multi-symptom patterns that boost specific diagnoses
      // Only 25 carefully selected combinations to avoid overfitting
      let combinationBoost = 1.0;
      const symSet4 = new Set(normalizedSymptoms);

      // --- Cardiac ---
      // chest pain + diaphoresis + age>50 → MI
      if (diagName.includes("infarction") && symSet4.has("chest pain") && symSet4.has("diaphoresis") && age && age > 50) combinationBoost *= 2.5;
      // chest pain + diaphoresis (any age) → MI
      if (diagName.includes("infarction") && symSet4.has("chest pain") && symSet4.has("diaphoresis") && combinationBoost < 2.0) combinationBoost *= 2.0;
      // chest pain + dyspnea + fatigue + age>55 → angina
      if ((diagName.includes("angina") || diagName.includes("ischemia")) && symSet4.has("chest pain") && symSet4.has("dyspnea") && age && age > 55) combinationBoost *= 2.0;
      // dyspnea + edema + orthopnea → CHF
      if (diagName.includes("heart failure") && symSet4.has("dyspnea") && symSet4.has("edema")) combinationBoost *= 2.2;
      // palpitations + dizziness + dyspnea → AFib
      if ((diagName.includes("fibrillation") || diagName.includes("afib")) && symSet4.has("palpitations") && symSet4.has("dizziness")) combinationBoost *= 2.5;

      // --- Pulmonary ---
      // dyspnea + chest pain + tachycardia/hemoptysis → PE
      if (diagName.includes("pulmonary embolism") && symSet4.has("dyspnea") && (symSet4.has("chest pain") || symSet4.has("hemoptysis"))) combinationBoost *= 2.0;
      // dyspnea + wheezing + chest tightness → Asthma
      if ((diagName.includes("asthma") || diagName.includes("bronchospasm")) && symSet4.has("dyspnea") && symSet4.has("wheezing")) combinationBoost *= 2.2;
      // dyspnea + cough + fatigue → COPD
      if ((diagName.includes("copd") || diagName.includes("chronic obstructive")) && symSet4.has("dyspnea") && (symSet4.has("dry cough") || symSet4.has("productive cough"))) combinationBoost *= 2.0;
      // fever + cough + dyspnea → Pneumonia
      if (diagName.includes("pneumonia") && (symSet4.has("fever") || symSet4.has("mild fever")) && (symSet4.has("productive cough") || symSet4.has("dry cough"))) combinationBoost *= 2.2;

      // --- Neuro ---
      // headache + neck stiffness + fever → Meningitis
      if (diagName.includes("meningitis") && symSet4.has("headache") && symSet4.has("neck stiffness") && (symSet4.has("fever") || symSet4.has("mild fever"))) combinationBoost *= 3.0;
      // headache + photophobia + nausea → Migraine
      if (diagName.includes("migraine") && (symSet4.has("headache") || symSet4.has("severe headache")) && symSet4.has("photophobia")) combinationBoost *= 2.5;
      // weakness + speech difficulty → Stroke
      if (diagName.includes("stroke") && symSet4.has("weakness") && symSet4.has("speech difficulty")) combinationBoost *= 2.5;

      // --- GI ---
      // abdominal pain + nausea + loss of appetite → Appendicitis
      if (diagName.includes("appendicitis") && symSet4.has("abdominal pain") && symSet4.has("nausea") && symSet4.has("loss of appetite")) combinationBoost *= 2.0;
      // abdominal pain + nausea + fever → Cholecystitis
      if (diagName.includes("cholecystitis") && symSet4.has("abdominal pain") && symSet4.has("nausea") && (symSet4.has("fever") || symSet4.has("mild fever"))) combinationBoost *= 2.2;
      // epigastric pain + vomiting + back pain → Pancreatitis
      if (diagName.includes("pancreatitis") && symSet4.has("epigastric pain") && symSet4.has("vomiting")) combinationBoost *= 2.5;
      // diarrhea + vomiting + abdominal cramps → Gastroenteritis
      if (diagName.includes("gastroenteritis") && symSet4.has("diarrhea") && (symSet4.has("vomiting") || symSet4.has("nausea"))) combinationBoost *= 2.2;
      // heartburn + bloating + chest pain → GERD
      if ((diagName.includes("gastroesophageal") || diagName.includes("gerd") || diagName.includes("reflux")) && symSet4.has("heartburn")) combinationBoost *= 2.5;
      // bloating + diarrhea + weight loss → Celiac
      if (diagName.includes("celiac") && symSet4.has("bloating") && symSet4.has("diarrhea")) combinationBoost *= 2.5;

      // --- Infectious ---
      // fever + headache + body aches + rash → Dengue
      if (diagName.includes("dengue") && (symSet4.has("fever") || symSet4.has("mild fever")) && symSet4.has("body aches") && symSet4.has("rash")) combinationBoost *= 2.5;
      // fever + chills + headache + body aches → Malaria
      if (diagName.includes("malaria") && (symSet4.has("fever") || symSet4.has("mild fever")) && symSet4.has("chills") && symSet4.has("body aches")) combinationBoost *= 2.5;
      // fever + abdominal pain + diarrhea + headache → Typhoid
      if (diagName.includes("typhoid") && (symSet4.has("fever") || symSet4.has("mild fever")) && symSet4.has("abdominal pain") && symSet4.has("diarrhea")) combinationBoost *= 2.5;
      // productive cough + night sweats + weight loss → TB
      if (diagName.includes("tuberculosis") && symSet4.has("productive cough") && symSet4.has("night sweats") && symSet4.has("weight loss")) combinationBoost *= 3.0;
      // fever + confusion + tachycardia → Sepsis
      if (diagName.includes("sepsis") && (symSet4.has("fever") || symSet4.has("mild fever")) && symSet4.has("confusion")) combinationBoost *= 2.5;

      // --- Endocrine ---
      // polyuria + polydipsia + weight loss → Diabetes
      if (diagName.includes("diabetes") && symSet4.has("polyuria") && symSet4.has("polydipsia")) combinationBoost *= 2.5;
      // weight loss + palpitations + tremor → Hyperthyroidism
      if (diagName.includes("hyperthyroid") && symSet4.has("weight loss") && symSet4.has("palpitations")) combinationBoost *= 2.5;
      // fatigue + weight gain + constipation → Hypothyroidism
      if (diagName.includes("hypothyroid") && symSet4.has("fatigue") && symSet4.has("weight gain")) combinationBoost *= 2.5;

      // --- Musculoskeletal/Other ---
      // dysuria + polyuria + fever → UTI/Pyelonephritis
      if ((diagName.includes("urinary tract") || diagName.includes("cystitis") || diagName.includes("pyelonephritis")) && symSet4.has("dysuria") && symSet4.has("polyuria")) combinationBoost *= 2.0;
      // flank pain + hematuria + nausea → Nephrolithiasis
      if ((diagName.includes("nephrolithiasis") || diagName.includes("kidney stone") || diagName.includes("renal calc")) && symSet4.has("flank pain") && symSet4.has("hematuria")) combinationBoost *= 2.5;

      // Score = prior × likelihoodSum × coverageBonus × modifiers × combinationBoost × patternBoost
      const rawPosterior = prior * likelihoodSum * coverageBonus * vitalModifier * riskModifier * combinationBoost * patternBoost;

      // ── NEGATIVE EVIDENCE MODELING (Phase 3) ──
      // Penalize diagnoses when expected key symptoms are ABSENT
      // Penalty is moderate (0.3–0.6 multiplier), never eliminates
      const contradicting: string[] = [];
      let negativeEvidencePenalty = 1.0;

      const symSet = new Set(normalizedSymptoms);
      const hasFever = symSet.has("fever") || symSet.has("mild fever") || symSet.has("chills");
      const hasChestPain = symSet.has("chest pain");
      const hasDyspnea = symSet.has("dyspnea");
      const hasHeadache = symSet.has("headache") || symSet.has("severe headache");
      const hasAbdPain = symSet.has("abdominal pain") || symSet.has("epigastric pain");
      const hasNausea = symSet.has("nausea") || symSet.has("vomiting");
      const hasDiarrhea = symSet.has("diarrhea");
      const hasCough = symSet.has("cough") || symSet.has("productive cough") || symSet.has("dry cough");
      const hasRash = symSet.has("rash") || symSet.has("itching") || symSet.has("urticaria");
      const hasWeakness = symSet.has("weakness") || symSet.has("fatigue");
      const hasSyncope = symSet.has("syncope") || symSet.has("dizziness");
      const hasNeckStiff = symSet.has("neck stiffness");
      const hasPhotophobia = symSet.has("photophobia");
      const hasDysuria = symSet.has("dysuria");
      const hasJointPain = symSet.has("joint pain");
      const hasDiaphoresis = symSet.has("diaphoresis");
      const hasEdema = symSet.has("edema");
      const hasWeightLoss = symSet.has("weight loss");
      const hasPalpitations = symSet.has("palpitations");
      const hasBlurredVision = symSet.has("blurred vision");
      const highTemp = vitals.temperature && vitals.temperature > 38.5;
      const normalTemp = vitals.temperature && vitals.temperature < 37.5;
      const normalBP = vitals.bp_systolic && vitals.bp_systolic < 140;
      const normalHR = vitals.pulse && vitals.pulse < 100;
      const normalSpo2 = vitals.spo2 && vitals.spo2 > 95;

      // ── Infection / Sepsis: expect fever ──
      if ((diagName.includes("sepsis") || diagName.includes("meningitis") || diagName.includes("endocarditis") ||
           diagName.includes("abscess") || diagName.includes("pyelonephritis") || diagName.includes("cellulitis") ||
           diagName.includes("osteomyelitis")) && !hasFever && !highTemp) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no fever/chills — expected for infectious process");
      }

      // ── Pneumonia: expect fever + cough ──
      if (diagName.includes("pneumonia") && !hasFever && !hasCough) {
        negativeEvidencePenalty *= 0.4;
        contradicting.push("no fever or cough — expected for pneumonia");
      }

      // ── MI/ACS: expect chest pain or diaphoresis ──
      if ((diagName.includes("infarction") || diagName.includes("acute coronary")) && !hasChestPain && !hasDiaphoresis) {
        negativeEvidencePenalty *= 0.4;
        contradicting.push("no chest pain or diaphoresis — expected for ACS/MI");
      }

      // ── Cardiac ischemia: penalize if normal vitals + no exertional link ──
      if ((diagName.includes("angina") || diagName.includes("ischemia")) && !hasChestPain) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no chest pain — expected for cardiac ischemia");
      }

      // ── PE: expect dyspnea or chest pain ──
      if (diagName.includes("pulmonary embolism") && !hasDyspnea && !hasChestPain) {
        negativeEvidencePenalty *= 0.4;
        contradicting.push("no dyspnea or chest pain — expected for PE");
      }

      // ── Meningitis: expect neck stiffness or photophobia ──
      if (diagName.includes("meningitis") && !hasNeckStiff && !hasPhotophobia) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no neck stiffness or photophobia — expected for meningitis");
      }

      // ── Heart failure: expect dyspnea or edema ──
      if ((diagName.includes("heart failure") || diagName.includes("chf")) && !hasDyspnea && !hasEdema) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no dyspnea or edema — expected for heart failure");
      }

      // ── Appendicitis: expect abdominal pain ──
      if (diagName.includes("appendicitis") && !hasAbdPain) {
        negativeEvidencePenalty *= 0.4;
        contradicting.push("no abdominal pain — expected for appendicitis");
      }

      // ── Cholecystitis: expect abdominal pain + nausea ──
      if (diagName.includes("cholecystitis") && !hasAbdPain) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no abdominal pain — expected for cholecystitis");
      }

      // ── UTI: expect dysuria ──
      if ((diagName.includes("urinary tract infection") || diagName.includes("cystitis")) && !hasDysuria) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no dysuria — expected for UTI");
      }

      // ── Gastroenteritis: expect diarrhea or vomiting ──
      if (diagName.includes("gastroenteritis") && !hasDiarrhea && !hasNausea) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no diarrhea or vomiting — expected for gastroenteritis");
      }

      // ── Stroke: expect weakness or speech difficulty ──
      if (diagName.includes("stroke") && !hasWeakness && !symSet.has("speech difficulty")) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no focal weakness or speech difficulty — expected for stroke");
      }

      // ── Hyperthyroidism: expect weight loss + palpitations ──
      if (diagName.includes("hyperthyroid") && !hasWeightLoss && !hasPalpitations) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no weight loss or palpitations — expected for hyperthyroidism");
      }

      // ── Hypothyroidism: expect weight gain + fatigue ──
      if (diagName.includes("hypothyroid") && !symSet.has("weight gain") && !hasWeakness) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no weight gain or fatigue — expected for hypothyroidism");
      }

      // ── Diabetes: expect polyuria/polydipsia ──
      if (diagName.includes("diabetes") && !symSet.has("polyuria") && !symSet.has("polydipsia")) {
        negativeEvidencePenalty *= 0.6;
        contradicting.push("no polyuria/polydipsia — expected for diabetes");
      }

      // ── GERD: expect heartburn ──
      if ((diagName.includes("gastroesophageal") || diagName.includes("gerd")) && !symSet.has("heartburn")) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no heartburn — expected for GERD");
      }

      // ── Migraine: expect headache ──
      if (diagName.includes("migraine") && !hasHeadache) {
        negativeEvidencePenalty *= 0.3;
        contradicting.push("no headache — expected for migraine");
      }

      // ── Rheumatoid conditions: expect joint pain ──
      if ((diagName.includes("rheumatoid") || diagName.includes("lupus") || diagName.includes("gout")) && !hasJointPain) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("no joint pain — expected for rheumatic condition");
      }

      // ── Vital-sign negative evidence ──
      if (normalTemp && (diagName.includes("sepsis") || diagName.includes("malaria") || diagName.includes("dengue"))) {
        negativeEvidencePenalty *= 0.5;
        contradicting.push("normal temperature — argues against severe infection");
      }
      if (normalBP && diagName.includes("hypertensive")) {
        negativeEvidencePenalty *= 0.3;
        contradicting.push("normal blood pressure — argues against hypertensive crisis");
      }
      if (normalHR && normalSpo2 && (diagName.includes("embolism") || diagName.includes("sepsis"))) {
        negativeEvidencePenalty *= 0.6;
        contradicting.push("normal HR and SpO2 — lower probability of PE/sepsis");
      }

      // Clamp penalty floor at 0.15 (never fully eliminate)
      negativeEvidencePenalty = Math.max(0.15, negativeEvidencePenalty);

      // Apply penalty to posterior
      const adjustedPosterior = rawPosterior * negativeEvidencePenalty;

      if (isPediatric && (diagName.includes("infarction") || diagName.includes("copd"))) contradicting.push("unlikely in pediatric age");
      if (sex === "male" && diagName.includes("ectopic")) contradicting.push("not applicable to male patients");

      bayesianScores.push({
        diagnosis_id: diagId,
        diagnosis_name: d.diagnosis_name,
        icd10_code: d.icd10_code,
        category: d.category,
        probability: 0,
        posterior: adjustedPosterior,
        prior,
        likelihood: likelihoodSum,
        symptom_coverage: coverage,
        supporting_symptoms: entry.symptom_names,
        contradicting_factors: contradicting,
        must_not_miss: false,
      });
    }

    // ══════════════════════════════════════════════════════
    // PHASE 6: DIAGNOSTIC COMPETITION LAYER
    // Apply suppression on RAW posteriors before normalization
    // for maximum discriminative effect
    // ══════════════════════════════════════════════════════

    // 6A: DB-driven suppression rules (on raw posteriors)
    const suppressionRules = suppressionRes.data || [];
    if (suppressionRules.length > 0) {
      const posteriorById: Record<string, any> = {};
      for (const d of bayesianScores) posteriorById[d.diagnosis_id] = d;

      for (const rule of suppressionRules) {
        const dominant = posteriorById[rule.dominant_diagnosis_id];
        const suppressed = posteriorById[rule.suppressed_diagnosis_id];
        if (!dominant || !suppressed) continue;
        // Activate if dominant has higher posterior than suppressed
        if (dominant.posterior <= suppressed.posterior * 0.5) continue;

        // Check if cancellation symptoms are present
        const cancelSymptoms = (rule.requires_absence_of || []) as string[];
        if (cancelSymptoms.length > 0) {
          const matchedNamesLower = allMatchedSymptoms.map((s: any) => s.symptom_name.toLowerCase());
          const normalizedLower = normalizedSymptoms.map(s => s.toLowerCase());
          const allNames = [...matchedNamesLower, ...normalizedLower];
          const hasCancelSymptom = cancelSymptoms.some((cs: string) =>
            allNames.some((ns: string) => ns.includes(cs) || cs.includes(ns))
          );
          if (hasCancelSymptom) continue;
        }

        const factor = parseFloat(rule.suppression_factor) || 0.3;
        suppressed.posterior *= factor;
        suppressed.contradicting_factors.push(`suppressed by ${dominant.diagnosis_name} (competition rule)`);
      }
    }

    // 6B: Inline diagnostic competition (name-based, for pairs not in DB)
    // Each rule: [dominantPattern, suppressedPattern, factor, cancelSymptoms[]]
    const INLINE_COMPETITIONS: Array<{
      dominant: string; suppressed: string; factor: number;
      cancelSymptoms: string[]; description: string;
    }> = [
      // Headache differentials
      { dominant: "tension headache", suppressed: "subarachnoid", factor: 0.3,
        cancelSymptoms: ["worst headache", "sudden onset", "thunderclap", "neck stiffness", "syncope"],
        description: "Tension headache suppresses SAH without red flags" },
      { dominant: "tension headache", suppressed: "brain tumor", factor: 0.25,
        cancelSymptoms: ["seizure", "progressive", "morning headache", "papilledema", "weight loss"],
        description: "Tension headache suppresses brain tumor without progression" },
      // GI differentials
      { dominant: "acute gastroenteritis", suppressed: "inflammatory bowel", factor: 0.35,
        cancelSymptoms: ["bloody stool", "weight loss", "chronic", "joint pain"],
        description: "Gastroenteritis suppresses IBD without alarm features" },
      { dominant: "acute gastroenteritis", suppressed: "appendicitis", factor: 0.5,
        cancelSymptoms: ["rebound tenderness", "right lower quadrant", "migration of pain", "loss of appetite"],
        description: "Gastroenteritis suppresses appendicitis without localizing signs" },
      { dominant: "irritable bowel syndrome", suppressed: "colorectal cancer", factor: 0.25,
        cancelSymptoms: ["bloody stool", "weight loss", "anemia", "iron deficiency", "family history"],
        description: "IBS suppresses CRC without alarm features" },
      // Respiratory differentials
      { dominant: "viral upper respiratory infection", suppressed: "pneumonia", factor: 0.4,
        cancelSymptoms: ["high fever", "dyspnea", "hypoxia", "crackles", "chest pain"],
        description: "Viral URI suppresses pneumonia without consolidation signs" },
      { dominant: "allergic rhinitis", suppressed: "sinusitis", factor: 0.5,
        cancelSymptoms: ["purulent", "facial pain", "persistent", "unilateral"],
        description: "Allergic rhinitis suppresses sinusitis without purulent features" },
      // Cardiac differentials  
      { dominant: "costochondritis", suppressed: "myocardial infarction", factor: 0.3,
        cancelSymptoms: ["diaphoresis", "radiation", "dyspnea", "nausea"],
        description: "Costochondritis suppresses MI without cardiac red flags" },
      { dominant: "anxiety", suppressed: "atrial fibrillation", factor: 0.4,
        cancelSymptoms: ["irregular pulse", "age over 60", "syncope", "dyspnea on exertion"],
        description: "Anxiety suppresses AFib without arrhythmia signs" },
      // Musculoskeletal differentials
      { dominant: "lumbar strain", suppressed: "cauda equina", factor: 0.2,
        cancelSymptoms: ["urinary retention", "saddle anesthesia", "bilateral weakness", "bowel incontinence"],
        description: "Lumbar strain suppresses cauda equina without neuro deficits" },
      { dominant: "osteoarthritis", suppressed: "septic arthritis", factor: 0.35,
        cancelSymptoms: ["fever", "acute onset", "erythema", "warmth", "single joint swelling"],
        description: "OA suppresses septic arthritis without infection signs" },
      // Endocrine
      { dominant: "type 2 diabetes mellitus", suppressed: "diabetic ketoacidosis", factor: 0.3,
        cancelSymptoms: ["vomiting", "confusion", "fruity breath", "tachypnea", "dehydration"],
        description: "T2DM suppresses DKA without acute metabolic derangement" },
      // Infectious  
      { dominant: "dengue fever", suppressed: "malaria", factor: 0.5,
        cancelSymptoms: ["cyclical fever", "rigors", "splenomegaly"],
        description: "Dengue suppresses malaria without cyclical pattern" },
      { dominant: "malaria", suppressed: "dengue fever", factor: 0.5,
        cancelSymptoms: ["rash", "retroorbital pain", "thrombocytopenia"],
        description: "Malaria suppresses dengue without rash/retroorbital pain" },
    ];

    const symSetComp = new Set(normalizedSymptoms);
    for (const rule of INLINE_COMPETITIONS) {
      // Find dominant and suppressed candidates
      const dominantCandidates = bayesianScores.filter(d => d.diagnosis_name.toLowerCase().includes(rule.dominant));
      const suppressedCandidates = bayesianScores.filter(d => d.diagnosis_name.toLowerCase().includes(rule.suppressed));
      
      if (dominantCandidates.length === 0 || suppressedCandidates.length === 0) continue;
      
      const dominant = dominantCandidates[0];
      if (dominant.posterior <= 0) continue;

      // Check cancel symptoms
      const hasCancelSymptom = rule.cancelSymptoms.some(cs =>
        normalizedSymptoms.some(ns => ns.includes(cs) || cs.includes(ns)) ||
        historyLower.some(h => h.includes(cs) || cs.includes(h))
      );
      if (hasCancelSymptom) continue;

      for (const suppressed of suppressedCandidates) {
        if (suppressed.diagnosis_id === dominant.diagnosis_id) continue;
        suppressed.posterior *= rule.factor;
        suppressed.contradicting_factors.push(`suppressed by ${dominant.diagnosis_name}: ${rule.description}`);
      }
    }

    // 6C: Proximity-based competition — when two similar diagnoses are close,
    // boost the one with better symptom coverage
    const sortedForProximity = [...bayesianScores].sort((a, b) => b.posterior - a.posterior);
    for (let i = 0; i < sortedForProximity.length - 1; i++) {
      const a = sortedForProximity[i];
      const b = sortedForProximity[i + 1];
      if (a.posterior <= 0 || b.posterior <= 0) continue;
      const ratio = b.posterior / a.posterior;
      // If within 30% of each other, apply coverage-based discrimination
      if (ratio > 0.7 && ratio < 1.0) {
        if (a.symptom_coverage > b.symptom_coverage * 1.3) {
          // A explains significantly more symptoms → penalize B
          b.posterior *= 0.7;
          b.contradicting_factors.push(`lower symptom coverage vs ${a.diagnosis_name}`);
        } else if (b.symptom_coverage > a.symptom_coverage * 1.3) {
          a.posterior *= 0.7;
          a.contradicting_factors.push(`lower symptom coverage vs ${b.diagnosis_name}`);
        }
      }
    }

    // Now normalize posteriors to sum to ~100
    const totalPosterior = bayesianScores.reduce((s, d) => s + d.posterior, 0) || 1;
    for (const d of bayesianScores) {
      d.probability = Math.round((d.posterior / totalPosterior) * 100);
    }

    // ── Organ System Bonus ──
    const stage2Ms = Date.now() - stageStart2;

    // ═══════════════════════════════════════════════════
    // STAGE 3: DANGEROUS DIAGNOSIS INJECTION
    // Normalize trigger terms before matching
    // ═══════════════════════════════════════════════════
    const stageStart3 = Date.now();
    let dangerousInjected = 0;
    const dangerousDiagnosisDetails: any[] = [];

    for (const row of dangerousRes.data || []) {
      const triggerRaw = row.trigger_symptom.toLowerCase();
      const triggerNormalized = normalizeSymptom(triggerRaw);
      // Match if any normalized input symptom matches the normalized trigger
      const matched = normalizedSymptoms.some((s: string) =>
        s === triggerNormalized || s.includes(triggerNormalized) || triggerNormalized.includes(s) ||
        s === triggerRaw || s.includes(triggerRaw) || triggerRaw.includes(s)
      );
      if (!matched) continue;

      const diagInfo = (row as any).diagnoses;
      if (!diagInfo) continue;

      const existingIdx = bayesianScores.findIndex(d => d.diagnosis_id === diagInfo.id);
      if (existingIdx >= 0) {
        bayesianScores[existingIdx].must_not_miss = true;
        bayesianScores[existingIdx].emergency_protocol = row.emergency_protocol;
        bayesianScores[existingIdx].guideline_source = row.guideline_source;
        bayesianScores[existingIdx].severity_level = row.severity_level;
        if (bayesianScores[existingIdx].probability < 5) {
          bayesianScores[existingIdx].probability = 5;
        }
      } else {
        bayesianScores.push({
          diagnosis_id: diagInfo.id,
          diagnosis_name: diagInfo.diagnosis_name,
          icd10_code: diagInfo.icd10_code,
          category: diagInfo.category,
          probability: 5,
          posterior: 0,
          prior: 0,
          likelihood: 0,
          symptom_coverage: 0,
          supporting_symptoms: [row.trigger_symptom],
          contradicting_factors: [],
          must_not_miss: true,
          emergency_protocol: row.emergency_protocol,
          guideline_source: row.guideline_source,
          severity_level: row.severity_level,
        });
        dangerousInjected++;
      }

      if (!dangerousDiagnosisDetails.find((d: any) => d.diagnosis_id === diagInfo.id)) {
        dangerousDiagnosisDetails.push({
          diagnosis_id: diagInfo.id,
          diagnosis_name: row.diagnosis_name || diagInfo.diagnosis_name,
          severity_level: row.severity_level,
          must_not_miss: true,
          emergency_protocol: row.emergency_protocol,
          guideline_source: row.guideline_source,
          trigger_symptom: row.trigger_symptom,
        });
      }
    }

    // Physiology context boost
    if (physioFilter.length > 0) {
      for (const d of bayesianScores) {
        if (physioFilter.includes(d.diagnosis_id)) {
          d.probability = Math.min(100, Math.round(d.probability * 1.2));
        }
      }
      bayesianScores.sort((a, b) => b.probability - a.probability);
    }

    // Final selection: top 6 by probability + up to 3 must-not-miss
    const aboveThreshold = bayesianScores.filter(d => !d.must_not_miss && d.probability >= MIN_SCORE_THRESHOLD);
    const belowThreshold = bayesianScores.filter(d => !d.must_not_miss && d.probability < MIN_SCORE_THRESHOLD);
    const topByProb = aboveThreshold.slice(0, 6);
    while (topByProb.length < 5 && belowThreshold.length > 0) {
      topByProb.push(belowThreshold.shift()!);
    }
    const mustNotMiss = bayesianScores.filter(d => d.must_not_miss).slice(0, 3);
    const finalDifferential = [...topByProb, ...mustNotMiss]
      .filter((d, i, arr) => arr.findIndex(x => x.diagnosis_id === d.diagnosis_id) === i) // dedup
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10);

    const diagnosisIds = finalDifferential.map(d => d.diagnosis_id);
    const stage3Ms = Date.now() - stageStart3;

    // ═══════════════════════════════════════════════════
    // STAGE 4: PARALLEL — labs, meds, guidelines
    // ═══════════════════════════════════════════════════
    const stageStart4 = Date.now();

    const [labLinksRes, drugLinksRes, guidelineRulesRes, guidelineMapRes] = await Promise.all([
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_lab_map").select("priority, diagnosis_id, lab_tests(id, test_name, category)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_drug_map").select("generic_name, line_of_treatment, diagnosis_id").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      diagnosisIds.length > 0
        ? supabase.from("guideline_rules").select("recommendation, evidence_level, treatment_generic_name, diagnosis_id, guideline_authorities(authority_name, priority)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_guideline_map").select("relevance_score, recommendation_summary, diagnosis_id, guideline_registry(id, title, organization, tier, guideline_url)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Labs
    const labMap = new Map<string, { test: any; diagnoses: string[]; priority: string }>();
    for (const link of labLinksRes.data || []) {
      const lt = (link as any).lab_tests;
      if (!lt) continue;
      const diagName = finalDifferential.find(d => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "";
      const existing = labMap.get(lt.id);
      if (existing) {
        if (!existing.diagnoses.includes(diagName)) existing.diagnoses.push(diagName);
        if (link.priority === "high" || link.priority === "required") existing.priority = link.priority;
      } else {
        labMap.set(lt.id, { test: lt, diagnoses: [diagName], priority: link.priority });
      }
    }
    const recommendedLabs = Array.from(labMap.values())
      .sort((a, b) => {
        const prio: Record<string, number> = { required: 0, high: 1, recommended: 2, optional: 3 };
        if ((prio[a.priority] ?? 4) !== (prio[b.priority] ?? 4)) return (prio[a.priority] ?? 4) - (prio[b.priority] ?? 4);
        return b.diagnoses.length - a.diagnoses.length;
      })
      .map(e => ({ test_name: e.test.test_name, category: e.test.category, priority: e.priority, differentiates: e.diagnoses }));

    // Medications
    const genericNames = [...new Set((drugLinksRes.data || []).map((d: any) => d.generic_name))];
    let drugDetails: any[] = [];
    let contraindications: any[] = [];
    let interactions: any[] = [];

    if (genericNames.length > 0) {
      const [detailRes, interRes] = await Promise.all([
        supabase.from("drug_master").select("id, generic_name, drug_class, max_daily_dose_mg, pregnancy_category").in("generic_name", genericNames),
        (() => {
          const allDrugs = [...genericNames, ...current_medications.map((m: string) => m.toLowerCase())];
          if (allDrugs.length < 2) return Promise.resolve({ data: [] });
          return supabase.from("drug_interactions").select("drug_a, drug_b, severity, interaction_description, recommended_action")
            .or(allDrugs.map(n => `drug_a.ilike.%${n}%`).join(",") + "," + allDrugs.map(n => `drug_b.ilike.%${n}%`).join(","));
        })(),
      ]);
      drugDetails = detailRes.data || [];
      interactions = interRes.data || [];

      const drugIds = drugDetails.map((d: any) => d.id);
      if (drugIds.length > 0) {
        const { data } = await supabase.from("drug_contraindication_map")
          .select("drug_id, condition_id, severity, notes, diagnoses(diagnosis_name)")
          .in("drug_id", drugIds);
        contraindications = data || [];
      }
    }

    const drugDetailMap = new Map(drugDetails.map((d: any) => [d.generic_name, d]));

    const suggestedMedications = (drugLinksRes.data || []).map((link: any) => {
      const detail = drugDetailMap.get(link.generic_name);
      const diagName = finalDifferential.find(d => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "";
      const isAllergyConflict = allergiesLower.some(a => link.generic_name.toLowerCase().includes(a) || a.includes(link.generic_name.toLowerCase()));
      const contraHits = contraindications.filter((c: any) => c.drug_id === detail?.id && historyLower.some(h => (c as any).diagnoses?.diagnosis_name?.toLowerCase()?.includes(h)));
      const interHits = interactions.filter((i: any) => i.drug_a.toLowerCase().includes(link.generic_name.toLowerCase()) || i.drug_b.toLowerCase().includes(link.generic_name.toLowerCase()));

      return {
        generic_name: link.generic_name,
        drug_class: detail?.drug_class || "",
        line_of_treatment: link.line_of_treatment,
        for_diagnosis: diagName,
        safe: !isAllergyConflict && contraHits.length === 0,
        allergy_conflict: isAllergyConflict,
        contraindications: contraHits.map((c: any) => ({ condition: (c as any).diagnoses?.diagnosis_name, severity: c.severity })),
        interactions: interHits.map((i: any) => ({
          with_drug: i.drug_a.toLowerCase() === link.generic_name.toLowerCase() ? i.drug_b : i.drug_a,
          severity: i.severity,
          description: i.interaction_description,
        })),
      };
    }).sort((a: any, b: any) => (a.safe === b.safe ? 0 : a.safe ? -1 : 1));

    // Guidelines
    const guidelineRecommendations: any[] = [];
    for (const r of guidelineRulesRes.data || []) {
      const auth = (r as any).guideline_authorities;
      guidelineRecommendations.push({
        guideline_name: auth?.authority_name || "Unknown",
        authority: auth?.authority_name || "Unknown",
        authority_priority: auth?.priority ?? 10,
        recommendation: r.recommendation,
        evidence_level: r.evidence_level,
        treatment: r.treatment_generic_name,
        source: "guideline_rules",
        for_diagnosis: finalDifferential.find(d => d.diagnosis_id === r.diagnosis_id)?.diagnosis_name || "",
      });
    }
    for (const link of guidelineMapRes.data || []) {
      const g = (link as any).guideline_registry;
      if (!g) continue;
      guidelineRecommendations.push({
        guideline_name: g.title,
        authority: g.organization,
        authority_priority: g.tier ?? 5,
        recommendation: link.recommendation_summary || "",
        evidence_level: "",
        treatment: "",
        source: "diagnosis_guideline_map",
        guideline_url: g.guideline_url,
        for_diagnosis: finalDifferential.find(d => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "",
      });
    }
    guidelineRecommendations.sort((a, b) => a.authority_priority - b.authority_priority);

    const stage4Ms = Date.now() - stageStart4;

    // ═══════════════════════════════════════════════════
    // STAGE 5: PERSIST + MONITOR
    // ═══════════════════════════════════════════════════
    if (visit_id) {
      const inserts = finalDifferential.map(dx => ({
        visit_id,
        hypothesis: {
          diagnosis: dx.diagnosis_name,
          probability: dx.probability,
          prior: dx.prior,
          likelihood: dx.likelihood,
          supporting_symptoms: dx.supporting_symptoms,
          contradicting_factors: dx.contradicting_factors,
          must_not_miss: dx.must_not_miss,
          icd10_code: dx.icd10_code,
          source: "ddx_engine_v5",
          bayesian: true,
        },
        confidence_score: dx.probability / 100,
        evidence_sources: dx.supporting_symptoms || [],
      }));
      supabase.from("diagnostic_hypotheses").insert(inserts).then(() => {}).catch(() => {});
    }

    const totalMs = Date.now() - start;

    // Monitor (non-blocking)
    supabase.from("monitoring_events").insert({
      event_type: "ddx_engine_executed",
      agent_name: "ddx-engine",
      clinic_id: clinic_id || null,
      success: true,
      duration_ms: totalMs,
      metadata: {
        version: "v5_terminology_fix",
        visit_id,
        cco_id,
        symptoms_raw: rawSymptoms,
        symptoms_normalized: normalizedSymptoms,
        symptoms_matched: symptomIds.length,
        candidates_from_graph: diagMap.size,
        diagnoses_returned: finalDifferential.length,
        dangerous_injected: dangerousInjected,
        labs_recommended: recommendedLabs.length,
        medications_suggested: suggestedMedications.length,
        guidelines_matched: guidelineRecommendations.length,
        top_diagnosis: finalDifferential[0]?.diagnosis_name || null,
        top_probability: finalDifferential[0]?.probability || 0,
        stage_latencies: {
          symptom_resolution: stage1Ms,
          bayesian_scoring: stage2Ms,
          dangerous_injection: stage3Ms,
          enrichment: stage4Ms,
        },
      },
    }).then(() => {}).catch(() => {});

    // Reasoning traces
    const reasoning_traces = finalDifferential.map(d => {
      const entry = diagMap.get(d.diagnosis_id);
      const symptomEvidence = entry
        ? Array.from(entry.symptom_scores.entries()).map(([sid, score]) => {
            const symName = allMatchedSymptoms.find((s: any) => s.id === sid)?.symptom_name || sid;
            return { symptom: symName, weight: score };
          })
        : [];
      const organBonus = activeSystems.includes((d.category || "").toLowerCase());
      return {
        diagnosis: d.diagnosis_name,
        diagnosis_id: d.diagnosis_id,
        total_score: d.probability,
        prior: Math.round(d.prior * 1000) / 1000,
        likelihood: Math.round(d.likelihood * 1000) / 1000,
        symptom_coverage: Math.round(d.symptom_coverage * 100),
        symptom_evidence: symptomEvidence,
        organ_system_bonus: organBonus,
        must_not_miss: d.must_not_miss,
        contradicting_factors: d.contradicting_factors,
        confidence: Math.round(d.probability) / 100,
      };
    });

    return respond({
      differential_diagnoses: finalDifferential.map(d => ({
        diagnosis_id: d.diagnosis_id,
        diagnosis_name: d.diagnosis_name,
        icd10_code: d.icd10_code,
        category: d.category,
        probability: d.probability,
        supporting_symptoms: d.supporting_symptoms,
        contradicting_factors: d.contradicting_factors,
        symptom_coverage: `${Math.round(d.symptom_coverage * 100)}%`,
        must_not_miss: d.must_not_miss,
        ...(d.emergency_protocol ? { emergency_protocol: d.emergency_protocol } : {}),
        ...(d.severity_level ? { severity_level: d.severity_level } : {}),
        ...(d.guideline_source ? { guideline_source: d.guideline_source } : {}),
      })),
      recommended_labs: recommendedLabs,
      suggested_medications: suggestedMedications,
      guideline_recommendations: guidelineRecommendations,
      dangerous_diagnoses: dangerousDiagnosisDetails,
      matched_symptoms: allMatchedSymptoms.map((s: any) => s.symptom_name),
      unmatched_symptoms: normalizedSymptoms.filter(s => !allMatchedSymptoms.some((ms: any) => ms.symptom_name === s || ms.symptom_name.includes(s))),
      normalization_applied: rawSymptoms.filter((r: string, i: number) => r !== normalizedSymptoms[i]),
      candidates_before_filter: diagMap.size,
      dangerous_diagnoses_injected: dangerousInjected,
      must_not_miss_count: dangerousDiagnosisDetails.length,
      organ_systems_active: activeSystems,
      reasoning_traces,
      score_threshold_applied: MIN_SCORE_THRESHOLD,
      execution_ms: totalMs,
      stage_latencies: {
        symptom_resolution: stage1Ms,
        bayesian_scoring: stage2Ms,
        dangerous_injection: stage3Ms,
        enrichment: stage4Ms,
      },
      bayesian_model: true,
      source: "ddx_engine_v5_terminology_fix",
      graph_miss: false,
    });
  } catch (err: any) {
    console.error("ddx-engine error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logEvent(supabase: any, eventType: string, clinicId: string | null, visitId: string | null, symptoms: string[], durationMs: number) {
  try {
    await supabase.from("monitoring_events").insert({
      event_type: eventType,
      agent_name: "ddx-engine",
      clinic_id: clinicId || null,
      success: false,
      duration_ms: durationMs,
      metadata: { symptoms_input: symptoms, visit_id: visitId, reason: "no_symptom_match" },
    });
  } catch { /* non-blocking */ }
}
