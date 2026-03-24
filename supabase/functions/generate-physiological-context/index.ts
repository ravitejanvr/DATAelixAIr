import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════
// INLINE TERMINOLOGY NORMALIZER
// Resolves synonyms → canonical symptoms before physiology lookup.
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
  "no appetite": "loss of appetite",
  "not hungry": "loss of appetite",
  "poor appetite": "loss of appetite",
  "decreased appetite": "loss of appetite",
  "blood in stool": "bloody stool",
  "rectal bleeding": "bloody stool",
  "heart racing": "palpitations",
  "heart pounding": "palpitations",
  "irregular heartbeat": "palpitations",
  "chest tightness": "chest pain",
  "chest pressure": "chest pain",
  "chest discomfort": "chest pain",
  "heavy sweating": "diaphoresis",
  "profuse sweating": "diaphoresis",
  "cold sweats": "diaphoresis",
  "swollen legs": "edema",
  "swollen feet": "edema",
  "head pain": "headache",
  "migraine": "headache",
  "giddiness": "dizziness",
  "lightheadedness": "dizziness",
  "vertigo": "dizziness",
  "room spinning": "dizziness",
  "passed out": "syncope",
  "fainted": "syncope",
  "stiff neck": "neck stiffness",
  "neck rigidity": "neck stiffness",
  "sensitivity to light": "photophobia",
  "light sensitivity": "photophobia",
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
  "burning when peeing": "dysuria",
  "peeing a lot": "polyuria",
  "frequent urination": "polyuria",
  "blood in urine": "hematuria",
  "side pain": "flank pain",
  "kidney area pain": "flank pain",
  "skin rash": "rash",
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
 * Physiological State Engine (v3 — with Terminology Normalization)
 *
 * v3: Adds inline terminology normalization before symptom lookup.
 * Ensures "stomach pain" → "abdominal pain" before graph queries.
 *
 * Pipeline: symptoms → NORMALIZE → symptom_physiology_map → physiological_states
 *           → anatomical_systems + vitals modifiers → filtered & ranked summary
 */

// ── Organ System Detection ──

const SYMPTOM_SYSTEM_MAP: Record<string, string> = {
  "nausea": "gastrointestinal",
  "vomiting": "gastrointestinal",
  "diarrhea": "gastrointestinal",
  "abdominal pain": "gastrointestinal",
  "abdominal cramps": "gastrointestinal",
  "loss of appetite": "gastrointestinal",
  "bloating": "gastrointestinal",
  "constipation": "gastrointestinal",
  "dehydration": "gastrointestinal",
  "cough": "respiratory",
  "productive cough": "respiratory",
  "dry cough": "respiratory",
  "dyspnea": "respiratory",
  "wheezing": "respiratory",
  "tachypnea": "respiratory",
  "hemoptysis": "respiratory",
  "chest pain": "cardiovascular",
  "palpitations": "cardiovascular",
  "diaphoresis": "cardiovascular",
  "edema": "cardiovascular",
  "orthopnea": "cardiovascular",
  "headache": "neurological",
  "dizziness": "neurological",
  "confusion": "neurological",
  "seizure": "neurological",
  "neck stiffness": "neurological",
  "photophobia": "neurological",
  "syncope": "neurological",
  "fever": "infectious",
  "mild fever": "infectious",
  "chills": "infectious",
  "night sweats": "infectious",
  "rash": "dermatological",
  "itching": "dermatological",
  "joint pain": "musculoskeletal",
  "back pain": "musculoskeletal",
  "muscle pain": "musculoskeletal",
  "body aches": "musculoskeletal",
  "dysuria": "genitourinary",
  "polyuria": "genitourinary",
  "hematuria": "genitourinary",
  "flank pain": "genitourinary",
  "fatigue": "general",
  "malaise": "general",
  "weight loss": "general",
  "rebound tenderness": "gastrointestinal",
  "right lower quadrant pain": "gastrointestinal",
  "right lower quadrant abdominal pain": "gastrointestinal",
};
function detectDominantSystems(symptoms: string[]): string[] {
  const counts: Record<string, number> = {};
  for (const s of symptoms) {
    const lower = s.toLowerCase().trim();
    for (const [keyword, system] of Object.entries(SYMPTOM_SYSTEM_MAP)) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        counts[system] = (counts[system] || 0) + 1;
      }
    }
  }
  // Return systems with ≥2 symptom matches, sorted by count desc
  const sorted = Object.entries(counts)
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1]);
  // Primary system + secondary if close
  const result: string[] = [];
  if (sorted.length > 0) result.push(sorted[0][0]);
  if (sorted.length > 1 && sorted[1][1] >= 2) result.push(sorted[1][0]);
  // Always include "infectious" if fever is present (it co-occurs with any system)
  if (!result.includes("infectious") && symptoms.some(s => s.toLowerCase().includes("fever"))) {
    result.push("infectious");
  }
  return result;
}

// ── Max active states ──
const MAX_PHYSIOLOGY_STATES = 6;

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
    // Check if this is a service_role JWT by decoding the payload
    let isServiceRole = false;
    try {
      const payloadB64 = token.split(".")[1];
      if (payloadB64) {
        const payload = JSON.parse(atob(payloadB64));
        isServiceRole = payload.role === "service_role";
      }
    } catch (_) { /* not a valid JWT, will fail user auth below */ }
    
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
      lab_indicators = [],
      visit_id = null,
      clinic_id = null,
    } = body;

    if (!symptoms.length) {
      return new Response(JSON.stringify({
        physiological_states: [],
        affected_systems: [],
        candidate_diagnosis_ids: [],
        execution_ms: Date.now() - start,
        source: "physiological_engine_v2",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedSymptoms = normalizeSymptomList(symptoms);

    // Detect dominant organ systems from symptom cluster
    const dominantSystems = detectDominantSystems(normalizedSymptoms);

    // ═══════════════════════════════════════════════════
    // STAGE 1: Resolve symptom IDs (exact + fuzzy)
    // ═══════════════════════════════════════════════════
    const { data: exactMatches } = await supabase
      .from("symptoms")
      .select("id, symptom_name")
      .in("symptom_name", normalizedSymptoms);

    const matchedIds = new Set((exactMatches || []).map((s: any) => s.id));
    const matchedNames = new Set((exactMatches || []).map((s: any) => s.symptom_name));
    const unmatched = normalizedSymptoms.filter((s: string) => !matchedNames.has(s));

    // Fuzzy for unmatched
    if (unmatched.length > 0) {
      const fuzzyPromises = unmatched.map((s: string) =>
        supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
      );
      const fuzzyResults = await Promise.all(fuzzyPromises);
      for (const res of fuzzyResults) {
        for (const s of res.data || []) {
          matchedIds.add(s.id);
        }
      }
    }

    const symptomIds = Array.from(matchedIds);
    if (symptomIds.length === 0) {
      return new Response(JSON.stringify({
        physiological_states: [],
        affected_systems: [],
        candidate_diagnosis_ids: [],
        unmatched_symptoms: normalizedSymptoms,
        execution_ms: Date.now() - start,
        source: "physiological_engine_v2",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // STAGE 2: Query symptom → physiological state mappings
    // ═══════════════════════════════════════════════════
    const { data: physioLinks } = await supabase
      .from("symptom_physiology_map")
      .select("confidence_score, symptom_id, physiological_states(id, state_name, description, system_id, anatomical_systems(id, system_name, description))")
      .in("symptom_id", symptomIds);

    // Aggregate: for each physiological state, collect contributing symptoms and max confidence
    interface StateEntry {
      state_id: string;
      state_name: string;
      description: string;
      system_name: string;
      system_id: string;
      contributing_symptoms: Set<string>;
      confidence_scores: number[];
    }

    const stateMap = new Map<string, StateEntry>();

    for (const link of physioLinks || []) {
      const ps = (link as any).physiological_states;
      if (!ps) continue;
      const sys = ps.anatomical_systems;
      const existing = stateMap.get(ps.id);
      if (existing) {
        existing.contributing_symptoms.add(link.symptom_id);
        existing.confidence_scores.push(Number(link.confidence_score));
      } else {
        stateMap.set(ps.id, {
          state_id: ps.id,
          state_name: ps.state_name,
          description: ps.description,
          system_name: sys?.system_name || "unknown",
          system_id: sys?.id || "",
          contributing_symptoms: new Set([link.symptom_id]),
          confidence_scores: [Number(link.confidence_score)],
        });
      }
    }

    // ═══════════════════════════════════════════════════
    // STAGE 3: Rank and FILTER physiological states
    // ═══════════════════════════════════════════════════
    const allStates = Array.from(stateMap.values()).map(entry => {
      const avgConf = entry.confidence_scores.reduce((a, b) => a + b, 0) / entry.confidence_scores.length;
      const coverageBonus = Math.min(entry.contributing_symptoms.size / symptomIds.length, 1);
      let confidence = avgConf * (0.6 + 0.4 * coverageBonus);

      // Vitals modifiers
      if (vitals.temperature && vitals.temperature > 38.5 && entry.state_name === "immune_activation") confidence *= 1.3;
      if (vitals.temperature && vitals.temperature > 38.0 && entry.state_name === "respiratory_inflammation") confidence *= 1.2;
      if (vitals.spo2 && vitals.spo2 < 94 && (entry.state_name === "respiratory_inflammation" || entry.state_name === "bronchospasm")) confidence *= 1.4;
      if (vitals.pulse && vitals.pulse > 100 && entry.state_name === "cardiac_ischemia") confidence *= 1.3;
      if (vitals.bp_systolic && vitals.bp_systolic > 180 && entry.state_name === "vascular_inflammation") confidence *= 1.3;

      // ── ORGAN SYSTEM RELEVANCE FILTER ──
      // Demote states whose organ system doesn't match the dominant symptom cluster
      const stateSystem = (entry.system_name || "").toLowerCase();
      const isRelevant = dominantSystems.length === 0 ||
        dominantSystems.some(ds => stateSystem.includes(ds) || ds.includes(stateSystem)) ||
        stateSystem === "immune" || // immune is always relevant
        stateSystem === "general";

      if (!isRelevant) {
        // Penalize irrelevant system states heavily
        confidence *= 0.3;
      }

      confidence = Math.min(confidence, 1.0);

      return {
        state: entry.state_name,
        state_id: entry.state_id,
        description: entry.description,
        confidence: Math.round(confidence * 100) / 100,
        system: entry.system_name,
        system_id: entry.system_id,
        contributing_symptom_count: entry.contributing_symptoms.size,
        is_relevant: isRelevant,
        evidence: {
          symptom_matches: entry.contributing_symptoms.size,
          avg_map_confidence: Math.round(avgConf * 100) / 100,
          vitals_modified: false,
        },
      };
    });

    // Sort by confidence descending
    allStates.sort((a, b) => b.confidence - a.confidence);

    // Apply MAX_PHYSIOLOGY_STATES cap — keep only top N
    const rankedStates = allStates.slice(0, MAX_PHYSIOLOGY_STATES);

    // ═══════════════════════════════════════════════════
    // STAGE 4: Identify affected organ systems
    // ═══════════════════════════════════════════════════
    const systemSet = new Map<string, { system_name: string; max_confidence: number; state_count: number }>();
    for (const s of rankedStates) {
      const existing = systemSet.get(s.system);
      if (existing) {
        existing.max_confidence = Math.max(existing.max_confidence, s.confidence);
        existing.state_count++;
      } else {
        systemSet.set(s.system, { system_name: s.system, max_confidence: s.confidence, state_count: 1 });
      }
    }
    const affectedSystems = Array.from(systemSet.values()).sort((a, b) => b.max_confidence - a.max_confidence);

    // ═══════════════════════════════════════════════════
    // STAGE 5: Get candidate diagnosis IDs via physiology_diagnosis_map
    // ═══════════════════════════════════════════════════
    const stateIds = rankedStates.map(s => s.state_id);
    let candidateDiagnosisIds: string[] = [];

    if (stateIds.length > 0) {
      const { data: diagLinks } = await supabase
        .from("physiology_diagnosis_map")
        .select("diagnosis_id, relevance_score, physiological_state_id")
        .in("physiological_state_id", stateIds)
        .order("relevance_score", { ascending: false });

      const diagIdSet = new Map<string, number>();
      for (const link of diagLinks || []) {
        const existing = diagIdSet.get(link.diagnosis_id);
        if (!existing || Number(link.relevance_score) > existing) {
          diagIdSet.set(link.diagnosis_id, Number(link.relevance_score));
        }
      }
      candidateDiagnosisIds = Array.from(diagIdSet.keys());
    }

    const totalMs = Date.now() - start;

    // Monitor (non-blocking)
    supabase.from("monitoring_events").insert({
      event_type: "physiological_engine_executed",
      agent_name: "physiological-engine",
      clinic_id: clinic_id || null,
      success: true,
      duration_ms: totalMs,
      metadata: {
        version: "v2_filtered",
        visit_id,
        symptoms_input: normalizedSymptoms,
        symptoms_matched: symptomIds.length,
        dominant_systems: dominantSystems,
        states_before_filter: allStates.length,
        states_after_filter: rankedStates.length,
        systems_affected: affectedSystems.length,
        candidate_diagnoses: candidateDiagnosisIds.length,
      },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({
      physiological_states: rankedStates,
      affected_systems: affectedSystems,
      candidate_diagnosis_ids: candidateDiagnosisIds,
      matched_symptom_count: symptomIds.length,
      dominant_organ_systems: dominantSystems,
      states_before_filter: allStates.length,
      unmatched_symptoms: normalizedSymptoms.filter(
        (s: string) => !(exactMatches || []).some((m: any) => m.symptom_name === s)
      ),
      execution_ms: totalMs,
      source: "physiological_engine_v2",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("physiological-engine error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
