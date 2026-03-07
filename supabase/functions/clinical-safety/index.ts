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

interface VitalsDanger {
  parameter: string;
  value: number;
  severity: "warning" | "critical";
  message: string;
  action_hint: string;
}

interface EmergencyPattern {
  pattern: string;
  severity: "warning" | "critical";
  matched_indicators: string[];
  message: string;
  action_hint: string;
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
      warnings.push({ medication: med, issue: "duplicate", message: `Duplicate medication detected: "${med}". Please verify.` });
    }
    seen.add(baseName);
    const hasUnit = /\d+\s*(mg|ml|mcg|g|iu|unit|%|tablet|cap)/i.test(med);
    const hasNumber = /\d/.test(med);
    if (hasNumber && !hasUnit) {
      warnings.push({ medication: med, issue: "missing_unit", message: `Please verify dosage and frequency for "${med}" — unit (mg/ml) not detected.` });
    }
    const doseMatch = med.match(/(\d+)\s*(mg|g)/i);
    if (doseMatch) {
      const value = parseInt(doseMatch[1]);
      const unit = doseMatch[2].toLowerCase();
      if ((unit === "mg" && value > 2000) || (unit === "g" && value > 5)) {
        warnings.push({ medication: med, issue: "high_dosage", message: `Please verify dosage for "${med}" — ${value}${unit} appears unusually high.` });
      }
    }
    const hasFrequency = /(once|twice|thrice|daily|bid|tid|qid|od|bd|hs|prn|stat|sos|q\d+h|every|morning|night|evening)/i.test(med);
    if (!hasFrequency && medLower.length > 3) {
      warnings.push({ medication: med, issue: "missing_frequency", message: `Please verify dosage and frequency for "${med}" — frequency not specified.` });
    }
  }
  return warnings;
}

// --- Dangerous vitals detection ---
function checkVitalsDangers(vitals: Record<string, number | null | undefined>): VitalsDanger[] {
  const dangers: VitalsDanger[] = [];

  const rules: Array<{
    key: string; label: string;
    critical_low?: number; warning_low?: number; warning_high?: number; critical_high?: number;
    low_action?: string; high_action?: string;
  }> = [
    { key: "bp_systolic", label: "Systolic BP", critical_low: 80, warning_low: 90, warning_high: 160, critical_high: 180,
      low_action: "Evaluate for shock. IV access recommended.", high_action: "Hypertensive crisis. Evaluate end-organ damage." },
    { key: "bp_diastolic", label: "Diastolic BP", critical_low: 50, warning_low: 60, warning_high: 100, critical_high: 120,
      low_action: "Evaluate for hypotension and perfusion.", high_action: "Severe hypertension. Urgent evaluation needed." },
    { key: "pulse", label: "Heart Rate", critical_low: 40, warning_low: 50, warning_high: 120, critical_high: 150,
      low_action: "Evaluate for bradycardia. ECG recommended.", high_action: "Tachycardia. Rule out sepsis, dehydration, arrhythmia." },
    { key: "temperature", label: "Temperature (°F)", critical_low: 95, warning_low: 96.8, warning_high: 101.3, critical_high: 104,
      low_action: "Hypothermia. Active rewarming needed.", high_action: "High fever. Evaluate for infection or sepsis." },
    { key: "spo2", label: "SpO₂", critical_low: 88, warning_low: 93,
      low_action: "Hypoxia. Supplemental oxygen. Evaluate for respiratory distress." },
    { key: "respiratory_rate", label: "Respiratory Rate", warning_low: 10, critical_low: 8, warning_high: 24, critical_high: 30,
      low_action: "Bradypnea. Evaluate for CNS depression.", high_action: "Tachypnea. Evaluate for respiratory distress or acidosis." },
    { key: "blood_sugar", label: "Blood Sugar (mg/dL)", critical_low: 54, warning_low: 70, warning_high: 250, critical_high: 400,
      low_action: "Hypoglycemia. Administer glucose immediately.", high_action: "Severe hyperglycemia. Evaluate for DKA/HHS." },
  ];

  for (const rule of rules) {
    const val = vitals[rule.key];
    if (val == null) continue;

    if (rule.critical_low != null && val <= rule.critical_low) {
      dangers.push({ parameter: rule.label, value: val, severity: "critical", message: `${rule.label} critically low: ${val}`, action_hint: rule.low_action || "Urgent evaluation required." });
    } else if (rule.warning_low != null && val <= rule.warning_low) {
      dangers.push({ parameter: rule.label, value: val, severity: "warning", message: `${rule.label} below normal: ${val}`, action_hint: rule.low_action || "Monitor closely." });
    }

    if (rule.critical_high != null && val >= rule.critical_high) {
      dangers.push({ parameter: rule.label, value: val, severity: "critical", message: `${rule.label} critically high: ${val}`, action_hint: rule.high_action || "Urgent evaluation required." });
    } else if (rule.warning_high != null && val >= rule.warning_high) {
      dangers.push({ parameter: rule.label, value: val, severity: "warning", message: `${rule.label} above normal: ${val}`, action_hint: rule.high_action || "Monitor closely." });
    }
  }

  return dangers;
}

// --- Emergency symptom pattern matching ---
function checkEmergencyPatterns(
  symptoms: string[],
  vitals: Record<string, number | null | undefined>
): EmergencyPattern[] {
  const patterns: EmergencyPattern[] = [];
  const symptomsLower = symptoms.map(s => s.toLowerCase());
  const allText = symptomsLower.join(" ");

  // Hypertensive crisis
  const systolic = vitals.bp_systolic ?? 0;
  const diastolic = vitals.bp_diastolic ?? 0;
  if (systolic >= 180 || diastolic >= 120) {
    const headache = symptomsLower.some(s => s.includes("headache") || s.includes("head") || s.includes("sir dard"));
    const vision = symptomsLower.some(s => s.includes("vision") || s.includes("blurr") || s.includes("eye"));
    const chest = symptomsLower.some(s => s.includes("chest") || s.includes("seene"));
    const matched = [`BP ${systolic}/${diastolic}`];
    if (headache) matched.push("headache");
    if (vision) matched.push("visual disturbance");
    if (chest) matched.push("chest pain");
    patterns.push({
      pattern: "Hypertensive Crisis", severity: "critical", matched_indicators: matched,
      message: `BP ${systolic}/${diastolic} with associated symptoms suggests hypertensive emergency.`,
      action_hint: "Immediate BP reduction. Evaluate for end-organ damage (brain, heart, kidneys). Consider IV antihypertensives.",
    });
  }

  // Possible sepsis (SIRS criteria)
  const temp = vitals.temperature ?? 0;
  const hr = vitals.pulse ?? 0;
  const rr = vitals.respiratory_rate ?? 0;
  let sirsCount = 0;
  const sirsIndicators: string[] = [];
  if (temp > 100.4 || temp < 96.8) { sirsCount++; sirsIndicators.push(`Temp ${temp}°F`); }
  if (hr > 90) { sirsCount++; sirsIndicators.push(`HR ${hr}`); }
  if (rr > 20) { sirsCount++; sirsIndicators.push(`RR ${rr}`); }
  const infectionHint = symptomsLower.some(s =>
    s.includes("fever") || s.includes("chills") || s.includes("infection") ||
    s.includes("bukhar") || s.includes("jvaram") || s.includes("pus") || s.includes("wound")
  );
  if (sirsCount >= 2 && infectionHint) {
    patterns.push({
      pattern: "Possible Sepsis", severity: "critical", matched_indicators: [...sirsIndicators, "infection signs"],
      message: `${sirsCount} SIRS criteria met with signs of infection. Evaluate for sepsis.`,
      action_hint: "Blood cultures, IV fluids, broad-spectrum antibiotics within 1 hour. Lactate level. Consider ICU referral.",
    });
  }

  // Respiratory distress
  const spo2 = vitals.spo2 ?? 100;
  const breathingSymptoms = symptomsLower.some(s =>
    s.includes("breathless") || s.includes("dyspnea") || s.includes("difficulty breathing") ||
    s.includes("oopiritittanam") || s.includes("saans") || s.includes("wheez") || s.includes("stridor")
  );
  if ((spo2 < 92 && rr > 24) || (spo2 < 88) || (breathingSymptoms && (spo2 < 94 || rr > 22))) {
    const matched: string[] = [];
    if (spo2 < 94) matched.push(`SpO₂ ${spo2}%`);
    if (rr > 22) matched.push(`RR ${rr}`);
    if (breathingSymptoms) matched.push("breathing difficulty");
    patterns.push({
      pattern: "Respiratory Distress", severity: spo2 < 90 ? "critical" : "warning", matched_indicators: matched,
      message: `Respiratory compromise detected. SpO₂ ${spo2}%, RR ${rr}.`,
      action_hint: "Supplemental O₂. Position upright. ABG if available. Evaluate for pneumonia, PE, asthma exacerbation.",
    });
  }

  // Hypoglycemic emergency
  const sugar = vitals.blood_sugar ?? 999;
  if (sugar <= 54) {
    const confused = symptomsLower.some(s => s.includes("confus") || s.includes("drowsy") || s.includes("sweating") || s.includes("tremor") || s.includes("unresponsive"));
    patterns.push({
      pattern: "Hypoglycemic Emergency", severity: "critical", matched_indicators: [`Sugar ${sugar} mg/dL`, ...(confused ? ["altered consciousness"] : [])],
      message: `Blood glucose critically low at ${sugar} mg/dL.`,
      action_hint: "IV dextrose (25g D50) or oral glucose if conscious. Recheck in 15 min. Identify cause.",
    });
  }

  // Acute coronary syndrome hints
  const chestPain = symptomsLower.some(s => s.includes("chest pain") || s.includes("seene mein dard") || s.includes("gunde noppi"));
  const radiating = symptomsLower.some(s => s.includes("arm") || s.includes("jaw") || s.includes("back") || s.includes("shoulder"));
  const sweating = symptomsLower.some(s => s.includes("sweat") || s.includes("diaphor") || s.includes("nausea"));
  if (chestPain && (radiating || sweating || hr > 100)) {
    const matched = ["chest pain"];
    if (radiating) matched.push("radiating pain");
    if (sweating) matched.push("diaphoresis/nausea");
    if (hr > 100) matched.push(`HR ${hr}`);
    patterns.push({
      pattern: "Possible Acute Coronary Syndrome", severity: "critical", matched_indicators: matched,
      message: "Chest pain with concerning features. Rule out ACS.",
      action_hint: "ECG immediately. Aspirin 325mg. Troponin. Consider referral to cardiology/ED.",
    });
  }

  return patterns;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { medications, allergies, vitals, symptoms } = body;

    if (!medications || !Array.isArray(medications)) {
      return new Response(JSON.stringify({ error: "medications array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allergyList: string[] = Array.isArray(allergies) ? allergies : [];
    const vitalsObj: Record<string, number | null | undefined> = vitals && typeof vitals === "object" ? vitals : {};
    const symptomList: string[] = Array.isArray(symptoms) ? symptoms : [];

    // 1. Normalize drugs
    const normalized_drugs = await Promise.all(medications.map((m: string) => normalizeDrug(m)));

    // 2. Check interactions
    const interaction_flags = await checkInteractions(normalized_drugs);

    // 3. Check allergies
    const allergy_flags = checkAllergies(medications, allergyList);

    // 4. Dose sanity
    const dose_warnings = checkDoseSanity(medications);

    // 5. Vitals danger detection
    const vitals_dangers = checkVitalsDangers(vitalsObj);

    // 6. Emergency pattern matching
    const emergency_patterns = checkEmergencyPatterns(symptomList, vitalsObj);

    // 7. Compute overall confidence
    const hasUnrecognized = normalized_drugs.some(d => !d.rxnorm_id);
    const hasSevereInteraction = interaction_flags.some(f => f.severity === "severe");
    const hasAllergyConflict = allergy_flags.length > 0;
    const hasDoseIssue = dose_warnings.some(w => w.issue === "high_dosage" || w.issue === "duplicate");
    const hasCriticalVitals = vitals_dangers.some(v => v.severity === "critical");
    const hasCriticalEmergency = emergency_patterns.some(p => p.severity === "critical");

    let confidence_level: "low" | "moderate" | "high" = "high";
    if (hasAllergyConflict || hasSevereInteraction || hasCriticalVitals || hasCriticalEmergency) confidence_level = "low";
    else if (hasUnrecognized || hasDoseIssue || dose_warnings.length > 0 || vitals_dangers.length > 0 || emergency_patterns.length > 0) confidence_level = "moderate";

    const requires_manual_review = confidence_level !== "high" ||
      interaction_flags.length > 0 || allergy_flags.length > 0 || dose_warnings.length > 0 ||
      vitals_dangers.length > 0 || emergency_patterns.length > 0;

    return new Response(JSON.stringify({
      normalized_drugs, interaction_flags, allergy_flags, dose_warnings,
      vitals_dangers, emergency_patterns,
      confidence_level, requires_manual_review,
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("clinical-safety error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
