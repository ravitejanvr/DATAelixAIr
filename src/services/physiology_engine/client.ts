/**
 * Physiological State Engine — Client Service
 *
 * Invokes the physiology reasoning layer that sits between
 * Clinical Context and the DDX Engine.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PhysiologicalState {
  state: string;
  state_id: string;
  description: string;
  confidence: number;
  system: string;
  system_id: string;
  contributing_symptom_count: number;
  evidence: {
    symptom_matches: number;
    avg_map_confidence: number;
    vitals_modified: boolean;
  };
}

export interface AffectedSystem {
  system_name: string;
  max_confidence: number;
  state_count: number;
}

export interface PhysiologicalContextResult {
  physiological_states: PhysiologicalState[];
  affected_systems: AffectedSystem[];
  candidate_diagnosis_ids: string[];
  matched_symptom_count: number;
  unmatched_symptoms: string[];
  execution_ms: number;
  source: string;
}

export interface PhysiologicalContextInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  lab_indicators?: string[];
  visit_id?: string | null;
  clinic_id?: string | null;
}

/**
 * Run the Physiological State Engine. Returns null on error.
 */
export async function generatePhysiologicalContext(
  input: PhysiologicalContextInput
): Promise<PhysiologicalContextResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-physiological-context",
      { body: input }
    );

    if (error) {
      console.error("[PhysiologyEngine] Failed:", error);
      return null;
    }

    return data as PhysiologicalContextResult;
  } catch (e) {
    console.error("[PhysiologyEngine] Error:", e);
    return null;
  }
}
