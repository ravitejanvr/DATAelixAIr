import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════
// INLINE TERMINOLOGY NORMALIZER
// Resolves synonyms → canonical symptoms before graph lookups.
// ══════════════════════════════════════════════════════════════
const SYNONYM_MAP: Record<string, string> = {
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
  "body pain": "body aches",
  "generalized pain": "body aches",
  "muscle ache": "muscle pain",
  "myalgia": "muscle pain",
  "joint ache": "joint pain",
  "arthralgia": "joint pain",
  "low back pain": "back pain",
  "lower back pain": "back pain",
  "lumbar pain": "back pain",
  "painful urination": "dysuria",
  "burning urination": "dysuria",
  "urinary burning": "dysuria",
  "burning when peeing": "dysuria",
  "peeing a lot": "polyuria",
  "frequent urination": "polyuria",
  "blood in urine": "hematuria",
  "side pain": "flank pain",
  "kidney area pain": "flank pain",
  "excessive thirst": "polydipsia",
  "skin rash": "rash",
  "eruption": "rash",
  "hives": "rash",
  "pruritus": "itching",
  "itchy skin": "itching",
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
  "sweating at night": "night sweats",
  "lost weight": "weight loss",
  "losing weight": "weight loss",
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

function normalizeSymptomList(symptoms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of symptoms) {
    const n = normalizeSymptom(s);
    if (!seen.has(n)) { seen.add(n); result.push(n); }
  }
  return result;
}

/**
 * Load Reasoning Context — Single Batch Graph Data Loader
 *
 * v2: Adds terminology normalization before graph lookups
 * and uses symptom_likelihoods (5000+ edges) as primary source.
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

    const body = await req.json();
    const { symptoms = [] } = body;

    if (!symptoms.length) {
      return new Response(JSON.stringify({ error: "symptoms[] is required" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize symptoms before graph lookup
    const rawSymptoms = symptoms.map((s: string) => s.toLowerCase().trim());
    const normalizedSymptoms = normalizeSymptomList(rawSymptoms);

    // ── SINGLE BATCH: All graph data in parallel ──
    const [
      symptomRes,
      dangerousRes,
      priorsRes,
    ] = await Promise.all([
      supabase.from("symptoms").select("id, symptom_name").in("symptom_name", normalizedSymptoms),
      supabase.from("dangerous_diagnoses")
        .select("*, diagnoses(id, diagnosis_name, icd10_code, category)")
        .eq("must_not_miss", true)
        .order("priority", { ascending: true }),
      supabase.from("disease_priors")
        .select("diagnosis_id, base_prevalence, age_modifier, sex_modifier, region_modifier, diagnoses(diagnosis_name)")
        .limit(1000),
    ]);

    const matchedSymptoms = symptomRes.data || [];
    const symptomIds = matchedSymptoms.map((s: any) => s.id);

    // Fuzzy match unmatched symptoms (try both normalized and raw)
    const matchedNames = new Set(matchedSymptoms.map((s: any) => s.symptom_name));
    const unmatched = normalizedSymptoms.filter((s: string) => !matchedNames.has(s));
    const rawUnmatched = rawSymptoms.filter((s: string) => !matchedNames.has(s) && !normalizedSymptoms.includes(s));
    const allUnmatched = [...new Set([...unmatched, ...rawUnmatched])];
    
    if (allUnmatched.length > 0) {
      const fuzzyPromises = allUnmatched.map((s: string) =>
        supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
      );
      const fuzzyResults = await Promise.all(fuzzyPromises);
      for (const res of fuzzyResults) {
        for (const s of res.data || []) {
          if (!symptomIds.includes(s.id)) {
            symptomIds.push(s.id);
            matchedSymptoms.push(s);
          }
        }
      }
    }

    // Now load symptom-dependent data
    const [likelihoodRes, physMapRes, physDiagRes] = await Promise.all([
      symptomIds.length > 0
        ? supabase.from("symptom_likelihoods")
            .select("symptom_id, diagnosis_id, likelihood_value, diagnoses(id, diagnosis_name, category, icd10_code)")
            .in("symptom_id", symptomIds)
            .order("likelihood_value", { ascending: false })
        : Promise.resolve({ data: [] }),
      symptomIds.length > 0
        ? supabase.from("symptom_physiology_map")
            .select("symptom_id, physiological_state_id, confidence, physiological_states(id, state_name, description, anatomical_systems(system_name))")
            .in("symptom_id", symptomIds)
        : Promise.resolve({ data: [] }),
      supabase.from("physiology_diagnosis_map")
        .select("physiological_state_id, diagnosis_id, confidence_score, physiological_states(state_name), diagnoses(id, diagnosis_name, category)")
        .limit(2000),
    ]);

    const executionMs = Date.now() - start;

    return new Response(JSON.stringify({
      matched_symptoms: matchedSymptoms,
      unmatched_symptoms: allUnmatched.filter(u => !matchedSymptoms.some((m: any) => m.symptom_name === u)),
      normalization_applied: rawSymptoms.filter((r: string, i: number) => r !== normalizedSymptoms[i]),
      symptom_likelihoods: likelihoodRes.data || [],
      disease_priors: priorsRes.data || [],
      dangerous_diagnoses: dangerousRes.data || [],
      symptom_physiology_map: physMapRes.data || [],
      physiology_diagnosis_map: physDiagRes.data || [],
      execution_ms: executionMs,
      source: "load-reasoning-context-v2",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[load-reasoning-context] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
