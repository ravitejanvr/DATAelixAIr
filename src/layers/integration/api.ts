/**
 * Integration Layer API
 * 
 * Defines contracts and interfaces for external healthcare system integrations.
 * Supports lab systems, pharmacy networks, insurance, national health records,
 * and wearable device APIs.
 * 
 * Architecture:
 *   - All integrations are mediated through edge functions
 *   - Clinic-specific credentials stored in clinic_settings
 *   - Integration status tracked per clinic
 * 
 * Supported Integration Categories:
 *   1. Laboratory Information Systems (LIS)
 *   2. Pharmacy Management Systems (PMS)
 *   3. Insurance / Third-Party Administrators (TPA)
 *   4. National Health Record Systems (ABDM/ABHA in India)
 *   5. Wearable Device APIs
 *   6. Telemedicine Platforms
 */

// ────────────────────────────────────────────────────────────────────────────
// Integration Categories and Providers
// ────────────────────────────────────────────────────────────────────────────

export const INTEGRATION_CATEGORIES = {
  LAB: "lab",
  PHARMACY: "pharmacy",
  INSURANCE: "insurance",
  HEALTH_RECORDS: "health_records",
  WEARABLES: "wearables",
  TELEMEDICINE: "telemedicine",
  NOTIFICATIONS: "notifications",
} as const;

export type IntegrationCategory = typeof INTEGRATION_CATEGORIES[keyof typeof INTEGRATION_CATEGORIES];

export interface IntegrationProvider {
  id: string;
  name: string;
  category: IntegrationCategory;
  country: string[];
  description: string;
  configFields: IntegrationConfigField[];
  status: "available" | "coming_soon" | "beta";
}

export interface IntegrationConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Available Integration Providers
// ────────────────────────────────────────────────────────────────────────────

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  // Lab Systems
  {
    id: "thyrocare",
    name: "Thyrocare",
    category: "lab",
    country: ["IN"],
    description: "Thyrocare lab test ordering and results API",
    status: "coming_soon",
    configFields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "partner_id", label: "Partner ID", type: "text", required: true },
    ],
  },
  {
    id: "lal_path",
    name: "Dr. Lal PathLabs",
    category: "lab",
    country: ["IN"],
    description: "Lal PathLabs integration for test ordering",
    status: "coming_soon",
    configFields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "center_code", label: "Center Code", type: "text", required: true },
    ],
  },
  // Pharmacy Systems
  {
    id: "medplus",
    name: "MedPlus",
    category: "pharmacy",
    country: ["IN"],
    description: "MedPlus pharmacy network integration",
    status: "coming_soon",
    configFields: [
      { key: "store_id", label: "Store ID", type: "text", required: true },
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
  },
  {
    id: "apollo_pharmacy",
    name: "Apollo Pharmacy",
    category: "pharmacy",
    country: ["IN"],
    description: "Apollo Pharmacy prescription fulfillment",
    status: "coming_soon",
    configFields: [
      { key: "franchise_id", label: "Franchise ID", type: "text", required: true },
      { key: "api_secret", label: "API Secret", type: "password", required: true },
    ],
  },
  // National Health Records
  {
    id: "abdm_abha",
    name: "ABDM / ABHA",
    category: "health_records",
    country: ["IN"],
    description: "Ayushman Bharat Digital Mission health records",
    status: "coming_soon",
    configFields: [
      { key: "hip_id", label: "HIP ID", type: "text", required: true },
      { key: "client_id", label: "Client ID", type: "text", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", required: true },
      { key: "callback_url", label: "Callback URL", type: "url", required: true },
    ],
  },
  // Insurance / TPA
  {
    id: "medi_assist",
    name: "Medi Assist",
    category: "insurance",
    country: ["IN"],
    description: "Medi Assist TPA integration for cashless claims",
    status: "coming_soon",
    configFields: [
      { key: "provider_code", label: "Provider Code", type: "text", required: true },
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
  },
  // Wearables
  {
    id: "google_fit",
    name: "Google Fit",
    category: "wearables",
    country: ["GLOBAL"],
    description: "Google Fit health data sync",
    status: "coming_soon",
    configFields: [
      { key: "oauth_client_id", label: "OAuth Client ID", type: "text", required: true },
      { key: "oauth_client_secret", label: "OAuth Client Secret", type: "password", required: true },
    ],
  },
  {
    id: "apple_health",
    name: "Apple HealthKit",
    category: "wearables",
    country: ["GLOBAL"],
    description: "Apple Health data integration (via patient app)",
    status: "coming_soon",
    configFields: [],
  },
  // Notifications
  {
    id: "msg91",
    name: "MSG91",
    category: "notifications",
    country: ["IN"],
    description: "SMS and WhatsApp notifications via MSG91",
    status: "available",
    configFields: [
      { key: "auth_key", label: "Auth Key", type: "password", required: true },
      { key: "sender_id", label: "Sender ID", type: "text", required: true },
      { key: "flow_id", label: "Flow ID (for templates)", type: "text", required: false },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "notifications",
    country: ["GLOBAL"],
    description: "Global SMS and WhatsApp via Twilio",
    status: "coming_soon",
    configFields: [
      { key: "account_sid", label: "Account SID", type: "text", required: true },
      { key: "auth_token", label: "Auth Token", type: "password", required: true },
      { key: "phone_number", label: "Twilio Phone Number", type: "text", required: true },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Integration Status and Config Types
// ────────────────────────────────────────────────────────────────────────────

export type IntegrationStatus = "not_configured" | "configured" | "active" | "error" | "disabled";

export interface ClinicIntegration {
  clinic_id: string;
  provider_id: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  config: Record<string, string>;
  last_sync?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Integration Data Exchange Types
// ────────────────────────────────────────────────────────────────────────────

/** Lab order sent to external LIS */
export interface ExternalLabOrder {
  order_id: string;
  patient_name: string;
  patient_phone: string;
  patient_age: number;
  patient_sex: string;
  tests: Array<{
    test_code: string;
    test_name: string;
    priority: "routine" | "urgent";
  }>;
  collection_type: "home" | "center";
  collection_address?: string;
  preferred_date?: string;
  notes?: string;
}

/** Lab result received from external LIS */
export interface ExternalLabResult {
  order_id: string;
  external_ref: string;
  report_url?: string;
  results: Array<{
    test_name: string;
    parameter: string;
    value: string;
    unit: string;
    reference_range: string;
    is_abnormal: boolean;
  }>;
  reported_at: string;
}

/** Prescription sent to pharmacy system */
export interface ExternalPrescription {
  prescription_id: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  clinic_name: string;
  medications: Array<{
    drug_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity?: number;
    instructions?: string;
  }>;
  delivery_type: "pickup" | "delivery";
  delivery_address?: string;
}

/** Wearable health data sync */
export interface WearableHealthData {
  patient_id: string;
  source: string;
  sync_time: string;
  metrics: {
    steps?: number;
    heart_rate?: number;
    blood_pressure?: { systolic: number; diastolic: number };
    blood_glucose?: number;
    sleep_hours?: number;
    calories_burned?: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Integration Helper Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get available providers for a category and country.
 */
export function getProvidersForCategory(
  category: IntegrationCategory,
  country: string = "IN"
): IntegrationProvider[] {
  return INTEGRATION_PROVIDERS.filter(
    (p) => p.category === category && (p.country.includes(country) || p.country.includes("GLOBAL"))
  );
}

/**
 * Check if a provider is available for configuration.
 */
export function isProviderAvailable(providerId: string): boolean {
  const provider = INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
  return provider?.status === "available" || provider?.status === "beta";
}

/**
 * Get human-readable category label.
 */
export function getCategoryLabel(category: IntegrationCategory): string {
  const labels: Record<IntegrationCategory, string> = {
    lab: "Laboratory Systems",
    pharmacy: "Pharmacy Networks",
    insurance: "Insurance / TPA",
    health_records: "National Health Records",
    wearables: "Wearable Devices",
    telemedicine: "Telemedicine",
    notifications: "Notifications",
  };
  return labels[category] || category;
}

/**
 * Validate integration config against provider requirements.
 */
export function validateIntegrationConfig(
  providerId: string,
  config: Record<string, string>
): { valid: boolean; missingFields: string[] } {
  const provider = INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return { valid: false, missingFields: ["Unknown provider"] };

  const missingFields = provider.configFields
    .filter((f) => f.required && !config[f.key])
    .map((f) => f.label);

  return { valid: missingFields.length === 0, missingFields };
}
