/**
 * Infrastructure Layer API
 * 
 * Defines platform reliability, security, and resilience capabilities.
 * Covers database backups, disaster recovery, high availability,
 * secure authentication, and offline fallback.
 * 
 * Architecture:
 *   - Lovable Cloud provides managed database backups and HA
 *   - Auth via Lovable Cloud with email verification and role-based access
 *   - Offline fallback via sessionStorage for active consultations
 *   - TLS 1.3 encryption in transit, AES-256 at rest (managed by Cloud)
 */

// ────────────────────────────────────────────────────────────────────────────
// Security & Encryption Standards
// ────────────────────────────────────────────────────────────────────────────

export const SECURITY_STANDARDS = {
  encryption_in_transit: "TLS 1.3",
  encryption_at_rest: "AES-256",
  auth_method: "Email + Password with verification",
  session_management: "JWT with refresh tokens",
  mfa_support: "TOTP (planned)",
  password_policy: {
    min_length: 8,
    require_uppercase: true,
    require_number: true,
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Backup & Recovery
// ────────────────────────────────────────────────────────────────────────────

export interface BackupConfig {
  automatic_backups: boolean;
  backup_frequency: "daily" | "hourly";
  point_in_time_recovery: boolean;
  retention_days: number;
  managed_by: "lovable_cloud";
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  automatic_backups: true,
  backup_frequency: "daily",
  point_in_time_recovery: true,
  retention_days: 30,
  managed_by: "lovable_cloud",
};

// ────────────────────────────────────────────────────────────────────────────
// High Availability
// ────────────────────────────────────────────────────────────────────────────

export interface AvailabilityConfig {
  database_replication: boolean;
  edge_function_regions: string[];
  cdn_enabled: boolean;
  auto_scaling: boolean;
  target_uptime_sla: string;
}

export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  database_replication: true,
  edge_function_regions: ["ap-south-1"], // India primary
  cdn_enabled: true,
  auto_scaling: true,
  target_uptime_sla: "99.9%",
};

// ────────────────────────────────────────────────────────────────────────────
// Offline Fallback
// ────────────────────────────────────────────────────────────────────────────

export interface OfflineCapability {
  feature: string;
  offlineSupport: "full" | "partial" | "none";
  fallbackMethod: string;
}

export const OFFLINE_CAPABILITIES: OfflineCapability[] = [
  {
    feature: "Active Consultation Recording",
    offlineSupport: "partial",
    fallbackMethod: "Browser audio recording continues; transcript queued for sync",
  },
  {
    feature: "Consultation Draft",
    offlineSupport: "partial",
    fallbackMethod: "Session storage preserves transcript and extracted data",
  },
  {
    feature: "Patient Queue View",
    offlineSupport: "none",
    fallbackMethod: "Requires connectivity for real-time queue status",
  },
  {
    feature: "Previously Loaded Patient Data",
    offlineSupport: "partial",
    fallbackMethod: "Cached in memory for current session only",
  },
  {
    feature: "AI Pipeline Processing",
    offlineSupport: "none",
    fallbackMethod: "Requires cloud connectivity; manual entry fallback available",
  },
];

/**
 * Save critical consultation data to sessionStorage as offline fallback.
 * Called periodically during active consultations to prevent data loss.
 */
export function saveConsultationFallback(
  consultationId: string,
  data: {
    rawTranscript?: string;
    editedTranscript?: string;
    extractedData?: Record<string, unknown>;
    soapSections?: Record<string, string>;
    patientId?: string;
    visitId?: string;
  }
): void {
  try {
    const key = `consultation_fallback_${consultationId}`;
    const payload = {
      ...data,
      savedAt: new Date().toISOString(),
      consultationId,
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    console.warn("Failed to save consultation fallback to sessionStorage");
  }
}

/**
 * Retrieve consultation fallback data from sessionStorage.
 */
export function loadConsultationFallback(
  consultationId: string
): Record<string, unknown> | null {
  try {
    const key = `consultation_fallback_${consultationId}`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear consultation fallback data after successful save.
 */
export function clearConsultationFallback(consultationId: string): void {
  try {
    sessionStorage.removeItem(`consultation_fallback_${consultationId}`);
  } catch {
    // Ignore
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Health Check Types
// ────────────────────────────────────────────────────────────────────────────

export interface ServiceHealth {
  service: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  lastChecked: string;
}

export interface PlatformHealth {
  overall: "healthy" | "degraded" | "down";
  services: ServiceHealth[];
  timestamp: string;
}

/**
 * Check connectivity to critical services.
 */
export async function checkPlatformHealth(): Promise<PlatformHealth> {
  const services: ServiceHealth[] = [];
  const now = new Date().toISOString();

  // Check database connectivity
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const start = Date.now();
    const { error } = await supabase.from("clinics").select("id").limit(1);
    services.push({
      service: "Database",
      status: error ? "degraded" : "healthy",
      latencyMs: Date.now() - start,
      lastChecked: now,
    });
  } catch {
    services.push({ service: "Database", status: "down", lastChecked: now });
  }

  // Check edge function connectivity
  try {
    const start = Date.now();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clinical-safety`,
      { method: "OPTIONS" }
    );
    services.push({
      service: "Edge Functions",
      status: response.ok || response.status === 204 ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      lastChecked: now,
    });
  } catch {
    services.push({ service: "Edge Functions", status: "down", lastChecked: now });
  }

  const overall = services.every((s) => s.status === "healthy")
    ? "healthy"
    : services.some((s) => s.status === "down")
      ? "down"
      : "degraded";

  return { overall, services, timestamp: now };
}
