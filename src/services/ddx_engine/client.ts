/**
 * DDX Engine — Client Service
 *
 * Invokes the ddx-engine edge function to produce structured
 * differential diagnoses from patient context.
 * Gated by USE_DDX_ENGINE feature flag.
 */

import { supabase } from "@/integrations/supabase/client";
import { isDdxEngineEnabled } from "@/services/feature_flags";

export interface DDXDiagnosis {
  diagnosis_id: string;
  diagnosis_name: string;
  icd10_code: string | null;
  category: string;
  probability: number;
  supporting_symptoms: string[];
  symptom_coverage: string;
  must_not_miss: boolean;
}

export interface DDXLabRecommendation {
  test_name: string;
  category: string;
  priority: string;
  differentiates: string[];
}

export interface DDXMedication {
  generic_name: string;
  drug_class: string;
  line_of_treatment: string;
  for_diagnosis: string;
  safe: boolean;
  allergy_conflict: boolean;
  contraindications: Array<{ condition: string; severity: string }>;
  interactions: Array<{ with_drug: string; severity: string; description: string }>;
}

export interface DDXGuideline {
  guideline_name: string;
  authority: string;
  authority_priority: number;
  recommendation: string;
  evidence_level: string;
  treatment: string;
  for_diagnosis: string;
}

export interface DDXResult {
  differential_diagnoses: DDXDiagnosis[];
  recommended_labs: DDXLabRecommendation[];
  suggested_medications: DDXMedication[];
  guideline_recommendations: DDXGuideline[];
  matched_symptoms: string[];
  unmatched_symptoms: string[];
  dangerous_diagnoses_injected: number;
  execution_ms: number;
  source: string;
}

export interface DDXInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  age?: number | null;
  sex?: string | null;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  risk_factors?: string[];
  visit_id?: string | null;
  clinic_id?: string | null;
}

/**
 * Run the DDX engine. Returns null if disabled or on error.
 */
export async function runDDXEngine(input: DDXInput): Promise<DDXResult | null> {
  if (!isDdxEngineEnabled()) {
    console.log("[DDXEngine] DDX engine disabled, skipping.");
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke("ddx-engine", {
      body: input,
    });

    if (error) {
      console.error("[DDXEngine] Failed:", error);
      return null;
    }

    return data as DDXResult;
  } catch (e) {
    console.error("[DDXEngine] Error:", e);
    return null;
  }
}
