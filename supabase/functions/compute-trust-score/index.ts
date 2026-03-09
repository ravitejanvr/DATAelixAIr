import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Email domain trust classification
const TRUSTED_DOMAINS = [
  "hospital.com", "clinic.in", "apollo.in", "maxhealthcare.in",
  "fortishealthcare.in", "manipalhospitals.com", "aster.in",
  "nhs.uk", "nhs.net", "gov.in", "nic.in",
  "elixair.uk", // Internal
];
const SEMI_TRUSTED_SUFFIXES = [
  ".hospital", ".clinic", ".health", ".medical", ".med",
  ".ac.in", ".edu", ".edu.in", ".org", ".gov",
];
const PERSONAL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com", "aol.com"];

function classifyEmailDomain(email: string): { type: string; score: number } {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (TRUSTED_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`))) {
    return { type: "institutional", score: 25 };
  }
  if (SEMI_TRUSTED_SUFFIXES.some(s => domain.endsWith(s))) {
    return { type: "semi_institutional", score: 15 };
  }
  if (PERSONAL_DOMAINS.includes(domain)) {
    return { type: "personal", score: 0 };
  }
  // Custom domain (could be clinic)
  return { type: "custom", score: 10 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let score = 0;
    const factors: Record<string, number> = {};
    const riskFlags: string[] = [];

    // 1. Email domain intelligence
    const emailClassification = classifyEmailDomain(profile.email || "");
    factors.email_domain = emailClassification.score;
    score += emailClassification.score;

    // 2. Email verified
    if (profile.email_verified) {
      factors.email_verified = 15;
      score += 15;
    }

    // 3. Phone verified
    if (profile.phone_verified) {
      factors.phone_verified = 15;
      score += 15;
    }

    // 4. License number provided
    if (profile.license_number && profile.license_number.trim().length > 3) {
      factors.license_provided = 15;
      score += 15;

      // Check for duplicate license
      const { data: duplicates } = await admin
        .from("profiles")
        .select("user_id")
        .eq("license_number", profile.license_number)
        .neq("user_id", user_id);
      if (duplicates && duplicates.length > 0) {
        factors.duplicate_license = -20;
        score -= 20;
        riskFlags.push("duplicate_license");
      }
    }

    // 5. Clinic assigned
    if (profile.clinic_id) {
      factors.clinic_assigned = 10;
      score += 10;
    }

    // 6. Profile completeness
    const profileFields = [profile.full_name, profile.phone, profile.city, profile.specialization, profile.designation];
    const completedFields = profileFields.filter(f => f && String(f).trim().length > 0).length;
    const completeness = Math.round((completedFields / profileFields.length) * 10);
    factors.profile_completeness = completeness;
    score += completeness;

    // 7. Check consultation activity (normal usage = good)
    const { count: consultCount } = await admin
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", user_id);
    if ((consultCount || 0) > 0 && (consultCount || 0) <= 50) {
      factors.normal_usage = 10;
      score += 10;
    } else if ((consultCount || 0) > 100) {
      // Unusually high volume — flag for review
      riskFlags.push("high_consultation_volume");
    }

    // 8. Check safety alerts
    const { count: safetyCount } = await admin
      .from("clinical_alerts")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", user_id)
      .is("acknowledged_at", null);
    if ((safetyCount || 0) > 5) {
      factors.unacked_safety_alerts = -10;
      score -= 10;
      riskFlags.push("unacknowledged_safety_alerts");
    }

    // Clamp score 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine verification status
    let verificationStatus = "unverified";
    if (score >= 60) verificationStatus = "verified";
    else if (score >= 30) verificationStatus = "partial";

    // Update profile
    await admin.from("profiles").update({
      trust_score: score,
      email_domain_type: emailClassification.type,
      verification_status: verificationStatus,
    }).eq("user_id", user_id);

    // Insert risk flags
    for (const flag of riskFlags) {
      const existing = await admin
        .from("risk_flags")
        .select("id")
        .eq("user_id", user_id)
        .eq("flag_type", flag)
        .eq("resolved", false)
        .maybeSingle();
      if (!existing?.data) {
        await admin.from("risk_flags").insert({
          user_id,
          flag_type: flag,
          severity: flag === "duplicate_license" ? "critical" : "warning",
          description: getRiskFlagDescription(flag),
          metadata: { score, factors },
        });
      }
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: user_id,
      event_type: "trust_score_computed",
      target_type: "profile",
      target_id: user_id,
      metadata: { score, factors, verification_status: verificationStatus, risk_flags: riskFlags },
    });

    return new Response(JSON.stringify({
      trust_score: score,
      verification_status: verificationStatus,
      email_domain_type: emailClassification.type,
      factors,
      risk_flags: riskFlags,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("compute-trust-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getRiskFlagDescription(flag: string): string {
  switch (flag) {
    case "duplicate_license": return "Multiple accounts registered with the same medical license number.";
    case "high_consultation_volume": return "Unusually high consultation volume detected. Review for potential misuse.";
    case "unacknowledged_safety_alerts": return "Multiple unacknowledged clinical safety alerts. May indicate safety compliance issues.";
    default: return `Suspicious activity detected: ${flag}`;
  }
}
