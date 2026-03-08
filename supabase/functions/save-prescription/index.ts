import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { patient_id, consultation_id, visit_id, clinic_id, drugs, patient_allergies } = body;

    if (!patient_id) return new Response(JSON.stringify({ error: "patient_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!consultation_id) return new Response(JSON.stringify({ error: "consultation_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Array.isArray(drugs) || drugs.length === 0) return new Response(JSON.stringify({ error: "At least one drug required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    // Allergy check
    const allergies: string[] = Array.isArray(patient_allergies) ? patient_allergies.map((a: string) => a.toLowerCase()) : [];
    const allergyWarnings: { drug: string; allergy: string }[] = [];
    for (const d of drugs) {
      const name = (d.drug_name || "").toLowerCase();
      for (const a of allergies) {
        if (name.includes(a) || a.includes(name)) {
          allergyWarnings.push({ drug: d.drug_name, allergy: a });
        }
      }
    }

    // Validate and sanitize drugs
    const validDrugs = drugs.filter((d: any) => d.drug_name?.trim()).slice(0, 50);
    if (validDrugs.length === 0) return new Response(JSON.stringify({ error: "No valid drugs provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const rows = validDrugs.map((d: any) => ({
      patient_id,
      doctor_id: user.id,
      consultation_id,
      visit_id: visit_id || null,
      clinic_id: clinic_id || null,
      drug_name: String(d.drug_name).substring(0, 200),
      dosage: String(d.dosage || "").substring(0, 100),
      frequency: String(d.frequency || "").substring(0, 100),
      duration: String(d.duration || "").substring(0, 100),
      route: String(d.route || "Oral").substring(0, 50),
      instructions: String(d.instructions || "").substring(0, 500),
    }));

    const { data: inserted, error: insertError } = await admin.from("prescriptions").insert(rows).select("id");
    if (insertError) throw new Error(insertError.message);

    // Audit (non-blocking)
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "prescriptions_saved",
      target_type: "consultation",
      target_id: consultation_id,
      clinic_id: clinic_id || null,
      metadata: { drug_count: inserted?.length || 0, allergy_warnings: allergyWarnings },
    }).then(() => {});

    return new Response(JSON.stringify({
      prescription_ids: inserted?.map((r: any) => r.id) || [],
      allergy_warnings: allergyWarnings,
      count: inserted?.length || 0,
      status: "saved",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
