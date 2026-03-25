/**
 * @deprecated DO NOT USE — replaced by medication_intelligence/client.ts
 * This file is a legacy medication engine. Use `validateMedications` from `@/services/medication_intelligence/client` directly.
 * Scheduled for removal in next cleanup phase.
 *
 * Medication Engine Service — LEGACY
 */

import {
  validateMedications,
  type MedicationOrder,
  type MedicationValidationResult,
} from "@/services/medication_intelligence/client";
import { supabase } from "@/integrations/supabase/client";

export interface MedicationSuggestion {
  generic_name: string;
  drug_class: string;
  dose: string;
  frequency: string;
  route: string;
  for_diagnosis: string;
  line_of_treatment: string;
  safe: boolean;
  warnings: string[];
}

export interface MedicationEngineResult {
  suggestions: MedicationSuggestion[];
  safety_score: number;
  critical_warnings: number;
  validation: MedicationValidationResult | null;
}

/**
 * Generate medication suggestions for candidate diagnoses.
 */
export async function generateMedicationSuggestions(params: {
  diagnosis_candidates: string[];
  patient_allergies: string[];
  current_medications: string[];
  patient_age?: number | null;
  patient_weight_kg?: number | null;
}): Promise<MedicationEngineResult> {
  const { diagnosis_candidates, patient_allergies, current_medications, patient_age, patient_weight_kg } = params;

  if (diagnosis_candidates.length === 0) {
    return { suggestions: [], safety_score: 100, critical_warnings: 0, validation: null };
  }

  try {
    // Look up drugs for diagnoses via diagnosis_drug_map
    const { data: drugMappings } = await supabase
      .from("diagnosis_drug_map")
      .select(`
        generic_name,
        line_of_treatment,
        diagnosis_id,
        diagnoses!diagnosis_drug_map_diagnosis_id_fkey(diagnosis_name)
      `)
      .limit(20);

    if (!drugMappings || drugMappings.length === 0) {
      return { suggestions: [], safety_score: 100, critical_warnings: 0, validation: null };
    }

    // Filter to matching diagnoses
    const normalizedDx = diagnosis_candidates.map(d => d.toLowerCase());
    const relevantDrugs = drugMappings.filter((dm: any) => {
      const dxName = (dm.diagnoses as any)?.diagnosis_name?.toLowerCase() || "";
      return normalizedDx.some(dx => dxName.includes(dx) || dx.includes(dxName));
    });

    // Build medication orders for validation
    const orders: MedicationOrder[] = relevantDrugs.map((d: any) => ({
      drug_input: d.generic_name,
      drug_generic: d.generic_name,
      indication: (d.diagnoses as any)?.diagnosis_name || "",
    }));

    // Validate through medication intelligence pipeline
    const validation = orders.length > 0
      ? await validateMedications({
          medications: orders,
          patient_allergies,
          patient_weight_kg: patient_weight_kg,
          patient_age,
          patient_diagnoses: diagnosis_candidates,
          existing_medications: current_medications,
        })
      : null;

    const suggestions: MedicationSuggestion[] = relevantDrugs.map((d: any, i: number) => {
      const normalized = validation?.medications?.[i];
      const warnings = validation?.warnings
        ?.filter(w => w.drug.toLowerCase() === d.generic_name.toLowerCase())
        .map(w => w.message) || [];

      return {
        generic_name: d.generic_name,
        drug_class: normalized?.indication || "",
        dose: normalized?.dose_value ? `${normalized.dose_value} ${normalized.dose_unit}` : "See guidelines",
        frequency: normalized?.frequency_code || "As prescribed",
        route: normalized?.route || "oral",
        for_diagnosis: (d.diagnoses as any)?.diagnosis_name || "",
        line_of_treatment: d.line_of_treatment || "first_line",
        safe: (normalized?.safety_score ?? 100) >= 70,
        warnings,
      };
    });

    return {
      suggestions,
      safety_score: validation?.summary?.safety_score ?? 100,
      critical_warnings: validation?.summary?.critical_warnings ?? 0,
      validation,
    };
  } catch (e) {
    console.error("[MedicationEngine] Error:", e);
    return { suggestions: [], safety_score: 0, critical_warnings: 0, validation: null };
  }
}
