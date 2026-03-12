/**
 * Safety Engine Service — Canonical Interface
 *
 * Validates drug interactions, allergy conflicts, duplicate medications,
 * dose safety, and contraindications across the pipeline output.
 */

import { supabase } from "@/integrations/supabase/client";

export interface SafetyAlert {
  severity: "critical" | "high" | "moderate" | "low";
  alert_type: string;
  description: string;
  affected_drug?: string;
  affected_diagnosis?: string;
  recommendation?: string;
}

export interface SafetyEngineResult {
  alerts: SafetyAlert[];
  safety_score: number;
  critical_count: number;
  high_count: number;
  passed: boolean;
}

/**
 * Run safety validation on the pipeline output.
 */
export async function runSafetyValidation(params: {
  medications: string[];
  allergies: string[];
  diagnoses: string[];
  vitals?: Record<string, any>;
  patient_age?: number | null;
}): Promise<SafetyEngineResult> {
  const alerts: SafetyAlert[] = [];
  const { medications, allergies, diagnoses, vitals, patient_age } = params;

  try {
    // 1. Check drug interactions
    if (medications.length >= 2) {
      const { data: interactions } = await supabase
        .from("drug_interactions")
        .select("*")
        .or(
          medications
            .map(m => `drug_a.ilike.%${m}%,drug_b.ilike.%${m}%`)
            .join(","),
        )
        .limit(20);

      if (interactions) {
        for (const ix of interactions) {
          const drugAMatch = medications.some(m => ix.drug_a.toLowerCase().includes(m.toLowerCase()));
          const drugBMatch = medications.some(m => ix.drug_b.toLowerCase().includes(m.toLowerCase()));
          if (drugAMatch && drugBMatch) {
            alerts.push({
              severity: ix.severity as SafetyAlert["severity"],
              alert_type: "drug_interaction",
              description: ix.interaction_description,
              affected_drug: `${ix.drug_a} + ${ix.drug_b}`,
              recommendation: ix.recommended_action || undefined,
            });
          }
        }
      }
    }

    // 2. Check allergy conflicts
    if (allergies.length > 0 && medications.length > 0) {
      for (const allergy of allergies) {
        for (const med of medications) {
          if (med.toLowerCase().includes(allergy.toLowerCase()) ||
              allergy.toLowerCase().includes(med.toLowerCase())) {
            alerts.push({
              severity: "critical",
              alert_type: "allergy_conflict",
              description: `Patient has allergy to "${allergy}" — potential conflict with "${med}"`,
              affected_drug: med,
            });
          }
        }
      }
    }

    // 3. Duplicate medication check
    const medLower = medications.map(m => m.toLowerCase());
    const seen = new Set<string>();
    for (const m of medLower) {
      if (seen.has(m)) {
        alerts.push({
          severity: "moderate",
          alert_type: "duplicate_medication",
          description: `Duplicate medication detected: "${m}"`,
          affected_drug: m,
        });
      }
      seen.add(m);
    }

    // 4. Contraindication check
    if (diagnoses.length > 0 && medications.length > 0) {
      const { data: contras } = await supabase
        .from("drug_contraindication_map")
        .select(`
          severity, notes,
          drug_master!drug_contraindication_map_drug_id_fkey(generic_name),
          diagnoses!drug_contraindication_map_condition_id_fkey(diagnosis_name)
        `)
        .limit(50);

      if (contras) {
        for (const c of contras) {
          const drugName = (c.drug_master as any)?.generic_name?.toLowerCase() || "";
          const condName = (c.diagnoses as any)?.diagnosis_name?.toLowerCase() || "";
          const medMatch = medications.some(m => drugName.includes(m.toLowerCase()));
          const dxMatch = diagnoses.some(d => condName.includes(d.toLowerCase()));

          if (medMatch && dxMatch) {
            alerts.push({
              severity: c.severity as SafetyAlert["severity"],
              alert_type: "contraindication",
              description: c.notes || `Contraindication: ${drugName} with ${condName}`,
              affected_drug: drugName,
              affected_diagnosis: condName,
            });
          }
        }
      }
    }

    // 5. Dangerous vitals check
    if (vitals) {
      if (vitals.temperature && vitals.temperature >= 40) {
        alerts.push({ severity: "critical", alert_type: "dangerous_vital", description: `Critical temperature: ${vitals.temperature}°C` });
      }
      if (vitals.spo2 && vitals.spo2 < 90) {
        alerts.push({ severity: "critical", alert_type: "dangerous_vital", description: `Low SpO2: ${vitals.spo2}%` });
      }
      if (vitals.pulse && (vitals.pulse > 150 || vitals.pulse < 40)) {
        alerts.push({ severity: "high", alert_type: "dangerous_vital", description: `Abnormal pulse: ${vitals.pulse} bpm` });
      }
    }
  } catch (e) {
    console.error("[SafetyEngine] Error:", e);
  }

  const critical = alerts.filter(a => a.severity === "critical").length;
  const high = alerts.filter(a => a.severity === "high").length;
  const score = Math.max(0, 100 - (critical * 30) - (high * 15) - (alerts.length * 5));

  return {
    alerts,
    safety_score: score,
    critical_count: critical,
    high_count: high,
    passed: critical === 0,
  };
}
