/**
 * Layer 9: Governance API
 * 
 * Manages pilot approval workflows, clinic lifecycle,
 * and role-based access control.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client, RLS policies
 *   - Layer 8 (Monitoring): Audit logging for governance actions
 * 
 * Consumers:
 *   - Layer 1 (UI): Platform admin dashboard, Auth routing
 */

import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const CLINICAL_ROLES: AppRole[] = [
  "doctor", "nurse", "clinic_admin", "receptionist", 
  "pharmacist", "allied_health", "lab", "care_coordinator", "front_desk"
];

export const ROLE_LABELS: Record<AppRole, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  clinic_admin: "Clinic Admin",
  receptionist: "Receptionist",
  pharmacist: "Pharmacist",
  patient: "Patient",
  admin: "Admin",
  allied_health: "Allied Health",
  lab: "Lab",
  care_coordinator: "Care Coordinator",
  front_desk: "Front Desk",
  platform_admin: "Platform Admin",
};

/** Maps role to the default route after login */
export function getDefaultRouteForRole(role: AppRole | null): string {
  switch (role) {
    case "platform_admin": return "/platform-admin";
    case "clinic_admin": return "/dashboard";
    case "doctor": return "/dashboard";
    case "nurse": return "/vitals";
    case "receptionist": return "/dashboard";
    case "patient": return "/patient-portal";
    case "pharmacist": return "/prescriptions";
    default: return "/dashboard";
  }
}

export const PILOT_STATUSES = ["pending", "approved", "rejected"] as const;
export type PilotStatus = typeof PILOT_STATUSES[number];
