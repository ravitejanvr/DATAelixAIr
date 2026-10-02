import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateMustNotMiss, toClinicalSafetyShape } from "../_shared/must_not_miss.ts";
import { checkContextCompleteness } from "../_shared/context_completeness.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";

interface NormalizedDrug {
  original_name: string;
  rxnorm_id: string | null;
  canonical_name: string | null;
  confidence_level: "high" | "moderate" | "low";
  warning: string | null;
}

interface InteractionFlag {
  interaction_warning: boolean;
  severity: "mild" | "moderate" | "severe";
  drug_a: string;
  drug_b: string;
  description: string;
}

interface AllergyFlag {
  medication: string;
  allergy: string;
  severity: "high";
  message: string;
}

interface DoseWarning {
  medication: string;
  issue: string;
  message: string;
}


// --- RxNorm normalization ---
async function normalizeDrug(name: string): Promise<NormalizedDrug> {
  const trimmed = name.trim();
  if (!trimmed) return { original_name: name, rxnorm_id: null, canonical_name: null, confidence_level: "low", warning: "Empty medication name" };

  try {
    const res = await fetch(`${RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(trimmed)}&search=1`);
    if (!res.ok) throw new Error(`RxNorm API error: ${res.status}`);
    const data = await res.json();
    const rxcui = data?.idGroup?.rxnormId?.[0];

    if (!rxcui) {
      const approxRes = await fetch(`${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(trimmed)}&maxEntries=1`);
      if (approxRes.ok) {
        const approxData = await approxRes.json();
        const candidate = approxData?.approximateGroup?.candidate?.[0];
        if (candidate?.rxcui) {
          const propRes = await fetch(`${RXNORM_BASE}/rxcui/${candidate.rxcui}/properties.json`);
          const propData = propRes.ok ? await propRes.json() : null;
          const canonicalName = propData?.properties?.name || candidate.name || trimmed;
          return {
            original_name: trimmed, rxnorm_id: candidate.rxcui, canonical_name: canonicalName,
            confidence_level: parseInt(candidate.score) > 50 ? "moderate" : "low",
            warning: parseInt(candidate.score) <= 50 ? "Low confidence match — please verify medication name." : null,
          };
        }
      }
      return { original_name: trimmed, rxnorm_id: null, canonical_name: null, confidence_level: "low", warning: "Unrecognized medication — please verify spelling." };
    }

    const propRes = await fetch(`${RXNORM_BASE}/rxcui/${rxcui}/properties.json`);
    const propData = propRes.ok ? await propRes.json() : null;
    const canonicalName = propData?.properties?.name || trimmed;
    return { original_name: trimmed, rxnorm_id: rxcui, canonical_name: canonicalName, confidence_level: "high", warning: null };
  } catch (e) {
    console.error(`RxNorm lookup failed for "${trimmed}":`, e);
    return { original_name: trimmed, rxnorm_id: null, canonical_name: null, confidence_level: "low", warning: "RxNorm lookup failed — please verify medication manually." };
  }
}

// --- Drug interactions via RxNav ---
async function checkInteractions(normalizedDrugs: NormalizedDrug[]): Promise<InteractionFlag[]> {
  const rxcuis = normalizedDrugs.filter(d => d.rxnorm_id).map(d => d.rxnorm_id!);
  if (rxcuis.length < 2) return [];
  const flags: InteractionFlag[] = [];
  try {
    const res = await fetch(`${RXNORM_BASE}/interaction/list.json?rxcuis=${rxcuis.join("+")}`);
    if (!res.ok) return [];
    const data = await res.json();
    const pairs = data?.fullInteractionTypeGroup?.[0]?.fullInteractionType || [];
    for (const pair of pairs) {
      const desc = pair.interactionPair?.[0];
      if (!desc) continue;
      const severity_raw = (desc.severity || "").toLowerCase();
      let severity: "mild" | "moderate" | "severe" = "mild";
      if (severity_raw.includes("high") || severity_raw.includes("severe") || severity_raw.includes("serious")) severity = "severe";
      else if (severity_raw.includes("moderate") || severity_raw.includes("significant")) severity = "moderate";
      const drugNames = pair.minConcept?.map((c: any) => c.name) || [];
      flags.push({ interaction_warning: true, severity, drug_a: drugNames[0] || "Unknown", drug_b: drugNames[1] || "Unknown", description: desc.description || "Potential interaction detected." });
    }
  } catch (e) { console.error("Interaction check failed:", e); }
  return flags;
}

// --- Allergy detection ---
function checkAllergies(medications: string[], allergies: string[]): AllergyFlag[] {
  if (!medications.length || !allergies.length) return [];
  const flags: AllergyFlag[] = [];
  const allergyLower = allergies.map(a => a.toLowerCase().trim()).filter(Boolean);
  for (const med of medications) {
    const medLower = med.toLowerCase().trim();
    for (const allergy of allergyLower) {
      if (medLower.includes(allergy) || allergy.includes(medLower)) {
        flags.push({ medication: med, allergy, severity: "high", message: `⚠ Medication "${med}" conflicts with documented allergy "${allergy}".` });
      }
    }
  }
  const classMap: Record<string, string[]> = {
    penicillin: ["amoxicillin", "ampicillin", "piperacillin", "augmentin"],
    sulfa: ["sulfamethoxazole", "trimethoprim", "bactrim", "cotrimoxazole"],
    nsaid: ["ibuprofen", "naproxen", "diclofenac", "aspirin", "piroxicam", "indomethacin"],
    cephalosporin: ["cephalexin", "cefazolin", "ceftriaxone", "cefuroxime"],
  };
  for (const med of medications) {
    const medLower = med.toLowerCase().trim();
    for (const allergy of allergyLower) {
      for (const [allergyClass, members] of Object.entries(classMap)) {
        if (allergy.includes(allergyClass) && members.some(m => medLower.includes(m))) {
          if (!flags.some(f => f.medication.toLowerCase() === medLower && f.allergy === allergy)) {
            flags.push({ medication: med, allergy, severity: "high", message: `⚠ Medication "${med}" belongs to ${allergyClass} class — conflicts with documented allergy "${allergy}".` });
          }
        }
        if (members.some(m => allergy.includes(m)) && medLower.includes(allergyClass)) {
          if (!flags.some(f => f.medication.toLowerCase() === medLower && f.allergy === allergy)) {
            flags.push({ medication: med, allergy, severity: "high", message: `⚠ Medication "${med}" conflicts with documented allergy "${allergy}".` });
          }
        }
      }
    }
  }
  return flags;
}

// --- Dose sanity checks ---
function checkDoseSanity(medications: string[]): DoseWarning[] {
  const warnings: DoseWarning[] = [];
  const seen = new Set<string>();
  for (const med of medications) {
    const medLower = med.toLowerCase().trim();
    if (!medLower) continue;
    const baseName = medLower.split(/\s+/)[0];
    if (seen.has(baseName)) {
      warnings.push({ medication: med, issue: "duplicate", message: `Duplicate entry for "${baseName}". Verify if intentional.` });
    }
    seen.add(baseName);
    const hasUnit = /\d+\s*(mg|ml|mcg|g|iu|unit|%|tablet|cap)/i.test(med);
    const hasNumber = /\d/.test(med);
    if (hasNumber && !hasUnit) {
      warnings.push({ medication: med, issue: "missing_unit", message: `Dosage unit not clearly specified in "${med}". Consider adding mg/ml/mcg.` });
    }
    const doseMatch = med.match(/(\d+)\s*(mg|g)/i);
    if (doseMatch) {
      const value = parseInt(doseMatch[1]);
      const unit = doseMatch[2].toLowerCase();
      if ((unit === "mg" && value > 2000) || (unit === "g" && value > 5)) {
        warnings.push({ medication: med, issue: "high_dosage", message: `Unusually high dose detected: ${value}${unit} for "${med}". Verify if correct.` });
      }
    }
    const hasFrequency = /(once|twice|thrice|daily|bid|tid|qid|od|bd|hs|prn|stat|sos|q\d+h|every|morning|night|evening)/i.test(med);
    if (!hasFrequency && medLower.length > 3) {
      warnings.push({ medication: med, issue: "missing_frequency", message: `Frequency not specified in "${med}". Consider adding OD/BD/TID or timing.` });
    }
  }
  return warnings;
}

// --- Dangerous vitals detection ---
// --- Vitals dangers + emergency patterns ---
// Both come from the shared must-not-miss evaluator (ROADMAP items 9/10) —
// the same rules V4's analyzeSafety and O1's context-engine risk flags use.
// Do not add detection logic here; add it to _shared/must_not_miss.ts.

// --- Audit logging helper ---
async function logSafetyAudit(
  actor_id: string | null,
  safetyResults: any,
  contextCompleteness: any,
) {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const totalFlags = (safetyResults.interaction_flags?.length || 0) +
      (safetyResults.allergy_flags?.length || 0) +
      (safetyResults.dose_warnings?.length || 0) +
      (safetyResults.vitals_dangers?.length || 0) +
      (safetyResults.emergency_patterns?.length || 0);

    if (totalFlags > 0 || !contextCompleteness.context_complete) {
      await supabase.from("audit_logs").insert({
        actor_id: actor_id || "00000000-0000-0000-0000-000000000000",
        event_type: "safety_controller_flags",
        target_type: "safety_check",
        metadata: {
          total_flags: totalFlags,
          interaction_count: safetyResults.interaction_flags?.length || 0,
          allergy_count: safetyResults.allergy_flags?.length || 0,
          dose_warning_count: safetyResults.dose_warnings?.length || 0,
          vitals_danger_count: safetyResults.vitals_dangers?.length || 0,
          emergency_pattern_count: safetyResults.emergency_patterns?.length || 0,
          emergency_patterns: safetyResults.emergency_patterns?.map((p: any) => p.pattern) || [],
          must_not_miss_ruleset: safetyResults.must_not_miss?.ruleset_version ?? null,
          must_not_miss_escalations: (safetyResults.must_not_miss?.triggers || [])
            .filter((t: any) => t.tier === "escalation").map((t: any) => t.rule_id),
          context_complete: contextCompleteness.context_complete,
          context_blocking_fields: contextCompleteness.issues
            .filter((i: any) => i.severity === "blocking")
            .map((i: any) => i.field),
          confidence_level: safetyResults.confidence_level,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (e) {
    console.error("Audit logging failed (non-blocking):", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { medications, allergies, vitals, symptoms, clinical_context, actor_id,
            normalized_medications, structured_prescriptions } = body;

    if (!medications || !Array.isArray(medications)) {
      return new Response(JSON.stringify({ error: "medications array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allergyList: string[] = Array.isArray(allergies) ? allergies : [];
    const vitalsObj: Record<string, number | null | undefined> = vitals && typeof vitals === "object" ? vitals : {};
    const symptomList: string[] = Array.isArray(symptoms) ? symptoms : [];

    // 0. Context completeness validation
    const context_completeness = checkContextCompleteness(clinical_context || {});

    // 0b. Normalize drug names via normalize-drug-name service
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let drug_normalization_results: any[] = [];
    if (SUPABASE_URL && SERVICE_KEY) {
      for (const med of medications) {
        try {
          const normResp = await fetch(`${SUPABASE_URL}/functions/v1/normalize-drug-name`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ drug_input: med }),
          });
          if (normResp.ok) {
            drug_normalization_results.push(await normResp.json());
          }
        } catch { /* non-blocking */ }
      }
    }

    // 1. Normalize drugs via RxNorm (existing inline normalization)
    const normalized_drugs = await Promise.all(medications.map((m: string) => normalizeDrug(m)));

    // 1b. Enhanced dose validation using normalized medication data
    let enhanced_dose_warnings: DoseWarning[] = [];
    if (Array.isArray(normalized_medications)) {
      for (const nm of normalized_medications) {
        if (nm.generic_name && nm.dose_mg && nm.max_daily_dose_mg && nm.frequency_times_per_day) {
          const dailyDose = nm.dose_mg * nm.frequency_times_per_day;
          if (dailyDose > nm.max_daily_dose_mg) {
            enhanced_dose_warnings.push({
              medication: nm.generic_name,
              issue: "exceeds_max_daily_dose",
              message: `Daily dose ${dailyDose}mg exceeds max ${nm.max_daily_dose_mg}mg/day for ${nm.generic_name}.`,
            });
          }
        }
      }
    }

    // 1c. Structured prescription validation (new structured fields)
    let structured_warnings: DoseWarning[] = [];
    let duplicate_therapy_flags: { drug_a: string; drug_b: string; message: string }[] = [];
    let contraindication_flags: { drug: string; condition: string; message: string }[] = [];

    if (Array.isArray(structured_prescriptions) && structured_prescriptions.length > 0) {
      const freqMultiplier: Record<string, number> = {
        "OD": 1, "BD": 2, "TID": 3, "QID": 4, "SOS": 0, "HS": 1, "STAT": 1,
        "once daily": 1, "twice daily": 2, "three times daily": 3,
      };

      const seenGenerics = new Map<string, string>(); // generic_name -> original drug_name

      for (const rx of structured_prescriptions) {
        const generic = (rx.generic_name || "").toLowerCase().trim();
        const doseVal = rx.dose_value ? parseFloat(rx.dose_value) : null;
        const freq = (rx.frequency || "OD").toUpperCase();
        const maxDaily = rx.max_daily_dose ? parseFloat(rx.max_daily_dose) : null;

        // Max daily dose check
        if (doseVal && maxDaily) {
          const timesPerDay = freqMultiplier[freq] || freqMultiplier[rx.frequency] || 1;
          const dailyTotal = doseVal * timesPerDay;
          if (dailyTotal > maxDaily) {
            structured_warnings.push({
              medication: rx.generic_name || rx.drug_name,
              issue: "exceeds_max_daily_dose",
              message: `${rx.generic_name}: ${dailyTotal}${rx.dose_unit || "mg"}/day exceeds max ${maxDaily}${rx.dose_unit || "mg"}/day.`,
            });
          }
        }

        // Duplicate therapy detection (same generic name)
        if (generic && seenGenerics.has(generic)) {
          duplicate_therapy_flags.push({
            drug_a: seenGenerics.get(generic)!,
            drug_b: rx.drug_name || rx.generic_name,
            message: `Duplicate therapy: "${generic}" prescribed more than once. Verify if intentional.`,
          });
        }
        if (generic) seenGenerics.set(generic, rx.drug_name || rx.generic_name);

        // Contraindication checks against patient conditions using relational table
        if (SUPABASE_URL && SERVICE_KEY) {
          try {
            const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
            const patientConditions = (clinical_context?.conditions || clinical_context?.chronic_conditions || []).map((c: string) => c.toLowerCase());

            // PRIMARY: Query drug_contraindication_map (relational)
            const genericName = (rx.generic_name || "").toLowerCase().trim();
            if (genericName) {
              const { data: contraRows } = await adminClient
                .from("drug_contraindication_map")
                .select("severity, notes, source_guideline, drug_master!inner(generic_name), diagnoses!inner(diagnosis_name)")
                .ilike("drug_master.generic_name", `%${genericName}%`);

              if (contraRows && contraRows.length > 0) {
                for (const row of contraRows) {
                  const condName = (row as any).diagnoses?.diagnosis_name?.toLowerCase() || "";
                  for (const cond of patientConditions) {
                    if (condName.includes(cond) || cond.includes(condName)) {
                      contraindication_flags.push({
                        drug: rx.generic_name || rx.drug_name,
                        condition: cond,
                        message: `⚠ ${rx.generic_name} is contraindicated in patients with "${cond}" (${(row as any).severity || "moderate"} severity). Source: ${(row as any).source_guideline || "clinical reference"}.`,
                      });
                    }
                  }
                }
              }
            }

            // FALLBACK: Check JSONB contraindications in drug_dose_guidelines
            if (rx.drug_cui && contraindication_flags.filter(f => f.drug === (rx.generic_name || rx.drug_name)).length === 0) {
              const { data: guidelines } = await adminClient
                .from("drug_dose_guidelines")
                .select("contraindications")
                .eq("ingredient_cui", rx.drug_cui)
                .limit(1)
                .maybeSingle();

              if (guidelines?.contraindications && Array.isArray(guidelines.contraindications)) {
                for (const ci of guidelines.contraindications) {
                  const ciLower = String(ci).toLowerCase();
                  for (const cond of patientConditions) {
                    if (ciLower.includes(cond) || cond.includes(ciLower)) {
                      contraindication_flags.push({
                        drug: rx.generic_name || rx.drug_name,
                        condition: cond,
                        message: `⚠ ${rx.generic_name} is contraindicated in patients with "${cond}".`,
                      });
                    }
                  }
                }
              }
            }
          } catch { /* non-blocking */ }
        }
      }
    }

    // 2. Check interactions
    const interaction_flags = await checkInteractions(normalized_drugs);

    // 3. Check allergies
    const allergy_flags = checkAllergies(medications, allergyList);

    // 4. Dose sanity
    const dose_warnings = [...checkDoseSanity(medications), ...enhanced_dose_warnings];

    // 5–6. Must-not-miss escalation: vitals dangers + emergency patterns
    const asList = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string")
        : typeof v === "string" && v.trim() ? [v] : [];
    const must_not_miss = evaluateMustNotMiss({
      symptoms: [
        ...(typeof clinical_context?.chief_complaint === "string" ? [clinical_context.chief_complaint] : []),
        ...symptomList,
      ],
      vitals: vitalsObj,
      age: typeof clinical_context?.patient_age === "number" ? clinical_context.patient_age : null,
      history: [...asList(clinical_context?.medical_history), ...asList(clinical_context?.risk_factors)],
    });
    const { vitals_dangers, emergency_patterns } = toClinicalSafetyShape(must_not_miss);

    // 7. Compute overall confidence
    const hasUnrecognized = normalized_drugs.some(d => !d.rxnorm_id);
    const hasSevereInteraction = interaction_flags.some(f => f.severity === "severe");
    const hasAllergyConflict = allergy_flags.length > 0;
    const hasDoseIssue = dose_warnings.some(w => w.issue === "high_dosage" || w.issue === "duplicate" || w.issue === "exceeds_max_daily_dose");
    const hasCriticalVitals = vitals_dangers.some(v => v.severity === "critical");
    const hasCriticalEmergency = emergency_patterns.some(p => p.severity === "critical");
    const hasDuplicateTherapy = duplicate_therapy_flags.length > 0;
    const hasContraindication = contraindication_flags.length > 0;

    let confidence_level: "low" | "moderate" | "high" = "high";
    if (hasAllergyConflict || hasSevereInteraction || hasCriticalVitals || hasCriticalEmergency || hasContraindication) confidence_level = "low";
    else if (hasUnrecognized || hasDoseIssue || hasDuplicateTherapy || dose_warnings.length > 0 || vitals_dangers.length > 0 || emergency_patterns.length > 0) confidence_level = "moderate";

    // If context is incomplete, lower confidence
    if (!context_completeness.context_complete) confidence_level = "low";

    const requires_manual_review = confidence_level !== "high" ||
      interaction_flags.length > 0 || allergy_flags.length > 0 || dose_warnings.length > 0 ||
      vitals_dangers.length > 0 || emergency_patterns.length > 0 ||
      duplicate_therapy_flags.length > 0 || contraindication_flags.length > 0 ||
      !context_completeness.context_complete;

    const result = {
      normalized_drugs, drug_normalization_results, interaction_flags, allergy_flags, dose_warnings,
      structured_warnings, duplicate_therapy_flags, contraindication_flags,
      vitals_dangers, emergency_patterns, must_not_miss, context_completeness,
      confidence_level, requires_manual_review,
      ai_suggestions_blocked: context_completeness.ai_suggestions_blocked,
      output_policy: {
        label: "AI Draft — Clinician Review Required",
        conservative_language: true,
        evidence_required: true,
      },
      timestamp: new Date().toISOString(),
    };

    // Log safety flags to audit_logs (non-blocking)
    logSafetyAudit(actor_id || null, result, context_completeness);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clinical-safety error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
