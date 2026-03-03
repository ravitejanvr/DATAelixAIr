import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      // Try approximate match
      const approxRes = await fetch(`${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(trimmed)}&maxEntries=1`);
      if (approxRes.ok) {
        const approxData = await approxRes.json();
        const candidate = approxData?.approximateGroup?.candidate?.[0];
        if (candidate?.rxcui) {
          // Get properties for canonical name
          const propRes = await fetch(`${RXNORM_BASE}/rxcui/${candidate.rxcui}/properties.json`);
          const propData = propRes.ok ? await propRes.json() : null;
          const canonicalName = propData?.properties?.name || candidate.name || trimmed;
          return {
            original_name: trimmed,
            rxnorm_id: candidate.rxcui,
            canonical_name: canonicalName,
            confidence_level: parseInt(candidate.score) > 50 ? "moderate" : "low",
            warning: parseInt(candidate.score) <= 50 ? "Low confidence match — please verify medication name." : null,
          };
        }
      }
      return {
        original_name: trimmed,
        rxnorm_id: null,
        canonical_name: null,
        confidence_level: "low",
        warning: "Unrecognized medication — please verify spelling.",
      };
    }

    // Get canonical name from properties
    const propRes = await fetch(`${RXNORM_BASE}/rxcui/${rxcui}/properties.json`);
    const propData = propRes.ok ? await propRes.json() : null;
    const canonicalName = propData?.properties?.name || trimmed;

    return {
      original_name: trimmed,
      rxnorm_id: rxcui,
      canonical_name: canonicalName,
      confidence_level: "high",
      warning: null,
    };
  } catch (e) {
    console.error(`RxNorm lookup failed for "${trimmed}":`, e);
    return {
      original_name: trimmed,
      rxnorm_id: null,
      canonical_name: null,
      confidence_level: "low",
      warning: "RxNorm lookup failed — please verify medication manually.",
    };
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
      flags.push({
        interaction_warning: true,
        severity,
        drug_a: drugNames[0] || "Unknown",
        drug_b: drugNames[1] || "Unknown",
        description: desc.description || "Potential interaction detected.",
      });
    }
  } catch (e) {
    console.error("Interaction check failed:", e);
  }
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
      // Check direct match or substring match
      if (medLower.includes(allergy) || allergy.includes(medLower)) {
        flags.push({
          medication: med,
          allergy,
          severity: "high",
          message: `⚠ Medication "${med}" conflicts with documented allergy "${allergy}".`,
        });
      }
    }
  }

  // Common drug-class to allergy mappings
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
          const exists = flags.some(f => f.medication.toLowerCase() === medLower && f.allergy === allergy);
          if (!exists) {
            flags.push({
              medication: med,
              allergy,
              severity: "high",
              message: `⚠ Medication "${med}" belongs to ${allergyClass} class — conflicts with documented allergy "${allergy}".`,
            });
          }
        }
        if (members.some(m => allergy.includes(m)) && medLower.includes(allergyClass)) {
          const exists = flags.some(f => f.medication.toLowerCase() === medLower && f.allergy === allergy);
          if (!exists) {
            flags.push({
              medication: med,
              allergy,
              severity: "high",
              message: `⚠ Medication "${med}" conflicts with documented allergy "${allergy}".`,
            });
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

    // Duplicate detection (by base drug name)
    const baseName = medLower.split(/\s+/)[0];
    if (seen.has(baseName)) {
      warnings.push({
        medication: med,
        issue: "duplicate",
        message: `Duplicate medication detected: "${med}". Please verify.`,
      });
    }
    seen.add(baseName);

    // Missing unit check
    const hasUnit = /\d+\s*(mg|ml|mcg|g|iu|unit|%|tablet|cap)/i.test(med);
    const hasNumber = /\d/.test(med);
    if (hasNumber && !hasUnit) {
      warnings.push({
        medication: med,
        issue: "missing_unit",
        message: `Please verify dosage and frequency for "${med}" — unit (mg/ml) not detected.`,
      });
    }

    // Extremely high dosage heuristic
    const doseMatch = med.match(/(\d+)\s*(mg|g)/i);
    if (doseMatch) {
      const value = parseInt(doseMatch[1]);
      const unit = doseMatch[2].toLowerCase();
      if ((unit === "mg" && value > 2000) || (unit === "g" && value > 5)) {
        warnings.push({
          medication: med,
          issue: "high_dosage",
          message: `Please verify dosage for "${med}" — ${value}${unit} appears unusually high.`,
        });
      }
    }

    // Missing frequency check
    const hasFrequency = /(once|twice|thrice|daily|bid|tid|qid|od|bd|hs|prn|stat|sos|q\d+h|every|morning|night|evening)/i.test(med);
    if (!hasFrequency && medLower.length > 3) {
      warnings.push({
        medication: med,
        issue: "missing_frequency",
        message: `Please verify dosage and frequency for "${med}" — frequency not specified.`,
      });
    }
  }

  return warnings;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { medications, allergies } = await req.json();

    if (!medications || !Array.isArray(medications)) {
      return new Response(JSON.stringify({ error: "medications array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allergyList: string[] = Array.isArray(allergies) ? allergies : [];

    // 1. Normalize all drugs via RxNorm
    const normalized_drugs = await Promise.all(
      medications.map((m: string) => normalizeDrug(m))
    );

    // 2. Check interactions
    const interaction_flags = await checkInteractions(normalized_drugs);

    // 3. Check allergies
    const allergy_flags = checkAllergies(
      medications,
      allergyList
    );

    // 4. Dose sanity
    const dose_warnings = checkDoseSanity(medications);

    // 5. Compute overall confidence
    const hasUnrecognized = normalized_drugs.some(d => !d.rxnorm_id);
    const hasSevereInteraction = interaction_flags.some(f => f.severity === "severe");
    const hasAllergyConflict = allergy_flags.length > 0;
    const hasDoseIssue = dose_warnings.some(w => w.issue === "high_dosage" || w.issue === "duplicate");

    let confidence_level: "low" | "moderate" | "high" = "high";
    if (hasAllergyConflict || hasSevereInteraction) confidence_level = "low";
    else if (hasUnrecognized || hasDoseIssue || dose_warnings.length > 0) confidence_level = "moderate";

    const requires_manual_review = confidence_level !== "high" ||
      interaction_flags.length > 0 ||
      allergy_flags.length > 0 ||
      dose_warnings.length > 0;

    const result = {
      normalized_drugs,
      interaction_flags,
      allergy_flags,
      dose_warnings,
      confidence_level,
      requires_manual_review,
      timestamp: new Date().toISOString(),
    };

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
