/**
 * PCIE — Client-side API helper
 * 
 * Provides a clean API to invoke the build-patient-context edge function
 * and retrieve stored context objects.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PatientContextObject, BuildContextInput } from "./context_builder";

export interface PCIEResponse {
  success: boolean;
  context_id?: string;
  context: any;
  processing_time_ms: number;
}

/**
 * Build patient context via the PCIE edge function.
 */
export async function buildPatientContext(params: {
  visit_id: string;
  patient_id: string;
  clinic_id: string;
  raw_text?: string;
  input_type?: string;
  structured_data?: {
    chief_complaint?: string;
    symptoms?: string[];
    duration?: string;
    severity?: string;
    allergies?: string[];
    medications?: string[];
  };
  vitals?: Record<string, unknown>;
  lab_results?: unknown[];
  patient_age?: number | null;
  patient_sex?: string | null;
  previous_conditions?: string[];
}): Promise<PCIEResponse> {
  const { data, error } = await supabase.functions.invoke("build-patient-context", {
    body: params,
  });

  if (error) {
    console.error("[PCIE Client] Error:", error);
    throw new Error(error.message || "Failed to build patient context");
  }

  return data;
}

/**
 * Retrieve the latest patient context object for a visit.
 */
export async function getPatientContext(visitId: string) {
  const { data, error } = await supabase
    .from("patient_context_objects")
    .select("*")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[PCIE Client] Fetch error:", error);
    return null;
  }

  return data;
}

/**
 * Update a field in the patient context object (doctor edit).
 */
export async function updatePatientContextField(
  contextId: string,
  field: string,
  value: unknown
) {
  const { error } = await supabase
    .from("patient_context_objects")
    .update({ [field]: value })
    .eq("id", contextId);

  if (error) {
    console.error("[PCIE Client] Update error:", error);
    throw new Error("Failed to update context field");
  }
}
