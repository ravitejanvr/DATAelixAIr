import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * generate-patient-report Edge Function
 * 
 * Builds a comprehensive outpatient consultation report:
 * - Fetches consultation, patient, vitals, triage, prescriptions, lab orders
 * - Includes doctor and clinic information
 * - Returns structured data for PDF rendering with all clinical sections
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let consultation_id: string | null = null;
    let visit_id: string | null = null;
    let target_language: string | null = null;
    let bilingual = false;
    let isTokenAccess = false;

    // Support both GET (token-based) and POST (authenticated) access
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Token required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate token
      const { data: tokenRecord, error: tokenErr } = await supabase
        .from("report_tokens")
        .select("consultation_id, expires_at")
        .eq("token", token)
        .single();

      if (tokenErr || !tokenRecord) {
        return new Response(JSON.stringify({ error: "Invalid or expired report token" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Report token has expired" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      consultation_id = tokenRecord.consultation_id;
      isTokenAccess = true;
    } else {
      // POST: require auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      consultation_id = body.consultation_id;
      visit_id = body.visit_id;
      target_language = body.target_language;
      bilingual = body.bilingual || false;
    }

    if (!consultation_id && !visit_id) {
      return new Response(JSON.stringify({ error: "consultation_id or visit_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch consultation ──
    let consultQuery = supabase.from("consultations").select("*");
    if (consultation_id) consultQuery = consultQuery.eq("id", consultation_id);
    else consultQuery = consultQuery.eq("visit_id", visit_id);
    
    const { data: consultation, error: consultError } = await consultQuery.maybeSingle();
    if (consultError || !consultation) {
      return new Response(JSON.stringify({ error: "Consultation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vId = consultation.visit_id || visit_id;
    const patientId = consultation.patient_id;
    const doctorId = consultation.doctor_id;
    const clinicId = consultation.clinic_id;

    // ── Fetch all related data in parallel ──
    const [
      patientRes,
      prescriptionsRes,
      labOrdersRes,
      invoiceRes,
      clinicRes,
      doctorRes,
      vitalsRes,
      triageRes,
      visitRes,
    ] = await Promise.all([
      // Patient demographics
      supabase.from("patients").select(`
        name, age, gender, phone, email, address, blood_group, date_of_birth, 
        allergies, current_medications, medical_history, height_cm, weight_kg, bmi,
        smoking_status, alcohol_use, occupation
      `).eq("id", patientId).single(),
      
      // Prescriptions
      supabase.from("prescriptions").select(`
        drug_name, dosage, frequency, duration, route, instructions
      `).eq("consultation_id", consultation.id),
      
      // Lab orders — query by visit_id OR consultation_id to catch all cases
      (async () => {
        let labData: any[] = [];
        if (vId) {
          const { data } = await supabase.from("lab_orders").select("test_name, test_code, category, priority, status, notes").eq("visit_id", vId);
          if (data?.length) labData = data;
        }
        // Fallback: also query by consultation_id if visit_id yielded nothing
        if (labData.length === 0 && consultation.id) {
          const { data } = await supabase.from("lab_orders").select("test_name, test_code, category, priority, status, notes").eq("consultation_id", consultation.id);
          if (data?.length) labData = data;
        }
        console.log(`[generate-patient-report] Lab orders found: ${labData.length} (visit_id=${vId}, consultation_id=${consultation.id})`);
        return { data: labData, error: null };
      })(),
      
      // Invoice
      vId 
        ? supabase.from("invoices").select("total, status, payment_mode, consultation_fee, discount, invoice_number").eq("visit_id", vId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      
      // Clinic information
      clinicId 
        ? supabase.from("clinics").select("name, phone, email, location, specialty").eq("id", clinicId).single()
        : Promise.resolve({ data: null, error: null }),
      
      // Doctor information from profiles
      supabase.from("profiles").select(`
        full_name, specialization, license_number, designation, signature_text, phone, email
      `).eq("user_id", doctorId).single(),
      
      // Vitals for this visit
      vId 
        ? supabase.from("vitals").select(`
            bp_systolic, bp_diastolic, pulse, temperature, respiratory_rate, spo2,
            height_cm, weight_kg, blood_sugar, notes, created_at
          `).eq("visit_id", vId).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      
      // Triage information
      vId 
        ? supabase.from("triage").select(`
            chief_complaint, symptom_duration, pain_score, priority, allergies_noted,
            pregnancy_status, notes, created_at
          `).eq("visit_id", vId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      
      // Visit information
      vId 
        ? supabase.from("patient_visits").select(`
            visit_date, visit_type, token_number, check_in_time, status
          `).eq("id", vId).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // ── Extract data with defaults ──
    const patient = patientRes.data || {};
    const doctor = doctorRes.data || {};
    const clinic = clinicRes.data || { name: "DATAelixAIr™ Clinic" };
    const vitals = vitalsRes.data || {};
    const triage = triageRes.data || {};
    const visit = visitRes.data || {};
    const prescriptions = prescriptionsRes.data || [];
    const labOrders = labOrdersRes.data || [];
    const invoice = invoiceRes.data || null;

    // ── Debug logging ──
    console.log(`[generate-patient-report] Data assembly: prescriptions=${prescriptions.length}, labOrders=${labOrders.length}, hasVitals=${!!vitalsRes.data}, hasTriage=${!!triageRes.data}, hasDoctor=${!!doctorRes.data}`);

    // ── Calculate age if date_of_birth exists ──
    let patientAge = patient.age;
    if (!patientAge && patient.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      const today = new Date();
      patientAge = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        patientAge--;
      }
    }

    // ── Build comprehensive report payload ──
    const report = {
      // Section 1: Header / Branding
      header: {
        platform_name: "DATAelixAIr™",
        clinic_name: clinic.name || "Clinic",
        clinic_phone: clinic.phone || null,
        clinic_email: clinic.email || null,
        clinic_address: clinic.location || null,
        clinic_specialty: clinic.specialty || null,
        report_date: new Date().toISOString(),
        report_title: "OUTPATIENT CONSULTATION REPORT",
      },

      // Section 2: Patient Information
      patient_info: {
        name: patient.name || "Not recorded",
        age: patientAge || "Not recorded",
        gender: patient.gender || "Not recorded",
        date_of_birth: patient.date_of_birth || null,
        phone: patient.phone || null,
        email: patient.email || null,
        address: patient.address || null,
        blood_group: patient.blood_group || "Not recorded",
        allergies: patient.allergies?.length ? patient.allergies : ["None reported"],
        current_medications: patient.current_medications?.length ? patient.current_medications : ["None reported"],
        medical_history: patient.medical_history || [],
        occupation: patient.occupation || null,
        smoking_status: patient.smoking_status || null,
        alcohol_use: patient.alcohol_use || null,
      },

      // Section 3: Visit Summary
      visit_summary: {
        visit_date: visit.visit_date || consultation.created_at,
        visit_type: visit.visit_type || "Consultation",
        token_number: visit.token_number || null,
        check_in_time: visit.check_in_time || null,
        chief_complaint: triage.chief_complaint || consultation.chief_complaint || "Not recorded",
        symptom_duration: triage.symptom_duration || "Not specified",
        priority: triage.priority || "routine",
        pain_score: triage.pain_score ?? null,
        pregnancy_status: triage.pregnancy_status || null,
        triage_notes: triage.notes || null,
      },

      // Section 4: Vitals
      vitals: {
        blood_pressure: vitals.bp_systolic && vitals.bp_diastolic 
          ? `${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg` 
          : "Not recorded",
        pulse: vitals.pulse ? `${vitals.pulse} bpm` : "Not recorded",
        temperature: vitals.temperature ? `${vitals.temperature}°F` : "Not recorded",
        respiratory_rate: vitals.respiratory_rate ? `${vitals.respiratory_rate}/min` : "Not recorded",
        spo2: vitals.spo2 ? `${vitals.spo2}%` : "Not recorded",
        height: vitals.height_cm || patient.height_cm ? `${vitals.height_cm || patient.height_cm} cm` : "Not recorded",
        weight: vitals.weight_kg || patient.weight_kg ? `${vitals.weight_kg || patient.weight_kg} kg` : "Not recorded",
        bmi: patient.bmi ? patient.bmi.toFixed(1) : null,
        blood_sugar: vitals.blood_sugar ? `${vitals.blood_sugar} mg/dL` : null,
        vitals_notes: vitals.notes || null,
        recorded_at: vitals.created_at || null,
      },

      // Section 5: SOAP Clinical Notes
      soap_notes: {
        subjective: consultation.soap_subjective || "Not documented",
        objective: consultation.soap_objective || "Not documented",
        assessment: consultation.soap_assessment || "Not documented",
        plan: consultation.soap_plan || "Not documented",
        ai_summary: consultation.ai_summary || null,
        confidence_score: consultation.confidence_score || null,
      },

      // Section 6: Prescriptions
      prescriptions: prescriptions.length > 0 
        ? prescriptions.map((rx: any, index: number) => ({
            sno: index + 1,
            drug_name: rx.drug_name || "Unknown",
            dosage: rx.dosage || "-",
            frequency: rx.frequency || "-",
            duration: rx.duration || "-",
            route: rx.route || "Oral",
            instructions: rx.instructions || "-",
          }))
        : [],

      // Section 7: Lab Orders
      lab_orders: labOrders.length > 0
        ? labOrders.map((lab: any, index: number) => ({
            sno: index + 1,
            test_name: lab.test_name || "Unknown Test",
            test_code: lab.test_code || "-",
            category: lab.category || "General",
            priority: lab.priority || "Routine",
            status: lab.status || "Ordered",
            notes: lab.notes || null,
          }))
        : [],

      // Section 8: Patient Instructions
      instructions: {
        general: buildInstructions(consultation, prescriptions, labOrders),
        dietary: consultation.extracted_data?.dietary_advice || null,
        lifestyle: consultation.extracted_data?.lifestyle_advice || null,
        warning_signs: consultation.extracted_data?.warning_signs || [
          "Return immediately if symptoms worsen",
          "High fever (>102°F) persisting more than 48 hours",
          "Difficulty breathing or chest pain",
          "Severe headache or confusion",
        ],
        medication_timing: buildMedicationTimingAdvice(prescriptions),
      },

      // Section 9: Follow-up
      follow_up: {
        date: consultation.follow_up_date || null,
        instructions: consultation.follow_up_date 
          ? `Please return for follow-up on ${formatDate(consultation.follow_up_date)}`
          : "Follow-up as needed. Contact clinic if symptoms persist or worsen.",
        tests_before_visit: labOrders.filter((l: any) => l.status === "ordered").map((l: any) => l.test_name),
      },

      // Section 10: Doctor Signature
      doctor_signature: {
        name: doctor.full_name || "Consulting Physician",
        designation: doctor.designation || null,
        specialization: doctor.specialization || null,
        license_number: doctor.license_number || null,
        signature_text: doctor.signature_text || null,
        contact_phone: doctor.phone || clinic.phone || null,
        contact_email: doctor.email || clinic.email || null,
      },

      // Metadata
      metadata: {
        consultation_id: consultation.id,
        visit_id: vId,
        consultation_status: consultation.status,
        safety_flags: consultation.safety_flags || [],
        generated_at: new Date().toISOString(),
        version: "2.0",
      },

      // Invoice (optional section)
      invoice: invoice ? {
        invoice_number: invoice.invoice_number || null,
        consultation_fee: invoice.consultation_fee || 0,
        discount: invoice.discount || 0,
        total: invoice.total || 0,
        payment_mode: invoice.payment_mode || "Cash",
        status: invoice.status || "pending",
      } : null,

      // Disclaimer
      disclaimer: "This is an AI-assisted clinical report generated by DATAelixAIr™. All clinical decisions and final diagnosis rest with the treating physician. This document is for reference purposes and should be reviewed by qualified medical personnel.",
    };

    // ── Translation (optional) ──
    let translated_report: any = null;
    if (target_language && target_language !== "english") {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (apiKey) {
        const reportText = buildReportText(report);
        const langLabel = target_language.charAt(0).toUpperCase() + target_language.slice(1);

        try {
          const translateRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a medical translator specializing in Indian healthcare. Translate the following clinical report into ${langLabel}. 
                  - Keep medical terms in English with ${langLabel} explanation in parentheses
                  - Preserve all formatting, numbers, and measurements
                  - Ensure medication names remain in English for safety
                  - Output ONLY the translated text`,
                },
                { role: "user", content: reportText },
              ],
              temperature: 0.2,
            }),
          });

          if (translateRes.ok) {
            const translateData = await translateRes.json();
            translated_report = translateData.choices?.[0]?.message?.content || null;
          }
        } catch (translateError) {
          console.error("Translation error:", translateError);
        }
      }
    }

    // ── Audit log (skip for token-based access) ──
    if (!isTokenAccess) {
      supabase.from("audit_logs").insert({
        actor_id: doctorId,
        clinic_id: clinicId,
        event_type: "report_generated",
        target_type: "consultation",
        target_id: consultation.id,
        metadata: {
          target_language: target_language || "english",
          bilingual: !!bilingual,
          sections_included: Object.keys(report).filter(k => k !== "metadata" && k !== "disclaimer"),
          token_access: isTokenAccess,
        },
      }).then(() => {});
    }

    return new Response(JSON.stringify({
      report,
      translated_report,
      bilingual: !!bilingual && !!translated_report,
      language: target_language || "english",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-patient-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Helper Functions ──

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function buildInstructions(consultation: any, prescriptions: any[], labOrders: any[]): string[] {
  const instructions: string[] = [];
  
  instructions.push("Take all medications as prescribed");
  instructions.push("Complete the full course of antibiotics if prescribed");
  instructions.push("Stay hydrated and rest adequately");
  
  if (labOrders.length > 0) {
    instructions.push(`Complete the following lab tests: ${labOrders.map(l => l.test_name).join(", ")}`);
  }
  
  if (consultation.follow_up_date) {
    instructions.push(`Return for follow-up on ${formatDate(consultation.follow_up_date)}`);
  }
  
  return instructions;
}

function buildMedicationTimingAdvice(prescriptions: any[]): string[] {
  const advice: string[] = [];
  
  prescriptions.forEach((rx: any) => {
    if (rx.frequency) {
      let timing = "";
      switch (rx.frequency.toLowerCase()) {
        case "once daily":
        case "od":
          timing = "Take once daily, preferably at the same time each day";
          break;
        case "twice daily":
        case "bd":
          timing = "Take morning and evening, 12 hours apart";
          break;
        case "three times daily":
        case "tid":
          timing = "Take morning, afternoon, and evening, 8 hours apart";
          break;
        case "four times daily":
        case "qid":
          timing = "Take every 6 hours";
          break;
        default:
          timing = `Take ${rx.frequency}`;
      }
      advice.push(`${rx.drug_name}: ${timing}`);
    }
  });
  
  return advice;
}

function buildReportText(report: any): string {
  const lines: string[] = [];
  
  // Header
  lines.push("═══════════════════════════════════════════════════════");
  lines.push(`         ${report.header.report_title}`);
  lines.push(`         ${report.header.platform_name}`);
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Clinic: ${report.header.clinic_name}`);
  if (report.header.clinic_address) lines.push(`Address: ${report.header.clinic_address}`);
  if (report.header.clinic_phone) lines.push(`Phone: ${report.header.clinic_phone}`);
  lines.push(`Report Date: ${new Date(report.header.report_date).toLocaleDateString("en-IN")}`);
  lines.push("");

  // Patient Information
  lines.push("───────────────────────────────────────────────────────");
  lines.push("PATIENT INFORMATION");
  lines.push("───────────────────────────────────────────────────────");
  lines.push(`Name: ${report.patient_info.name}`);
  lines.push(`Age: ${report.patient_info.age} | Gender: ${report.patient_info.gender}`);
  if (report.patient_info.phone) lines.push(`Phone: ${report.patient_info.phone}`);
  lines.push(`Blood Group: ${report.patient_info.blood_group}`);
  lines.push(`Allergies: ${Array.isArray(report.patient_info.allergies) ? report.patient_info.allergies.join(", ") : report.patient_info.allergies}`);
  lines.push(`Current Medications: ${Array.isArray(report.patient_info.current_medications) ? report.patient_info.current_medications.join(", ") : report.patient_info.current_medications}`);
  lines.push("");

  // Visit Summary
  lines.push("───────────────────────────────────────────────────────");
  lines.push("VISIT SUMMARY");
  lines.push("───────────────────────────────────────────────────────");
  lines.push(`Date: ${new Date(report.visit_summary.visit_date).toLocaleDateString("en-IN")}`);
  lines.push(`Visit Type: ${report.visit_summary.visit_type}`);
  lines.push(`Chief Complaint: ${report.visit_summary.chief_complaint}`);
  if (report.visit_summary.symptom_duration !== "Not specified") {
    lines.push(`Duration: ${report.visit_summary.symptom_duration}`);
  }
  lines.push("");

  // Vitals
  lines.push("───────────────────────────────────────────────────────");
  lines.push("VITALS");
  lines.push("───────────────────────────────────────────────────────");
  lines.push(`Blood Pressure: ${report.vitals.blood_pressure}`);
  lines.push(`Pulse: ${report.vitals.pulse}`);
  lines.push(`Temperature: ${report.vitals.temperature}`);
  lines.push(`SpO2: ${report.vitals.spo2}`);
  lines.push(`Respiratory Rate: ${report.vitals.respiratory_rate}`);
  lines.push(`Height: ${report.vitals.height} | Weight: ${report.vitals.weight}`);
  if (report.vitals.bmi) lines.push(`BMI: ${report.vitals.bmi}`);
  lines.push("");

  // SOAP Notes
  lines.push("───────────────────────────────────────────────────────");
  lines.push("CLINICAL NOTES (SOAP)");
  lines.push("───────────────────────────────────────────────────────");
  lines.push(`SUBJECTIVE:`);
  lines.push(report.soap_notes.subjective);
  lines.push("");
  lines.push(`OBJECTIVE:`);
  lines.push(report.soap_notes.objective);
  lines.push("");
  lines.push(`ASSESSMENT:`);
  lines.push(report.soap_notes.assessment);
  lines.push("");
  lines.push(`PLAN:`);
  lines.push(report.soap_notes.plan);
  lines.push("");

  // Prescriptions
  if (report.prescriptions.length > 0) {
    lines.push("───────────────────────────────────────────────────────");
    lines.push("PRESCRIPTIONS");
    lines.push("───────────────────────────────────────────────────────");
    lines.push("┌─────┬────────────────────┬──────────┬──────────────┬──────────┬────────────────────┐");
    lines.push("│ S.No│ Drug Name          │ Dosage   │ Frequency    │ Duration │ Instructions       │");
    lines.push("├─────┼────────────────────┼──────────┼──────────────┼──────────┼────────────────────┤");
    report.prescriptions.forEach((rx: any) => {
      lines.push(`│ ${rx.sno.toString().padEnd(3)} │ ${(rx.drug_name || "").substring(0, 18).padEnd(18)} │ ${(rx.dosage || "").substring(0, 8).padEnd(8)} │ ${(rx.frequency || "").substring(0, 12).padEnd(12)} │ ${(rx.duration || "").substring(0, 8).padEnd(8)} │ ${(rx.instructions || "").substring(0, 18).padEnd(18)} │`);
    });
    lines.push("└─────┴────────────────────┴──────────┴──────────────┴──────────┴────────────────────┘");
    lines.push("");
  } else {
    lines.push("───────────────────────────────────────────────────────");
    lines.push("PRESCRIPTIONS: None prescribed");
    lines.push("───────────────────────────────────────────────────────");
    lines.push("");
  }

  // Lab Orders
  if (report.lab_orders.length > 0) {
    lines.push("───────────────────────────────────────────────────────");
    lines.push("LAB ORDERS");
    lines.push("───────────────────────────────────────────────────────");
    report.lab_orders.forEach((lab: any) => {
      lines.push(`${lab.sno}. ${lab.test_name} [${lab.priority}] - ${lab.status}`);
      if (lab.notes) lines.push(`   Note: ${lab.notes}`);
    });
    lines.push("");
  } else {
    lines.push("───────────────────────────────────────────────────────");
    lines.push("LAB ORDERS: None ordered");
    lines.push("───────────────────────────────────────────────────────");
    lines.push("");
  }

  // Instructions
  lines.push("───────────────────────────────────────────────────────");
  lines.push("PATIENT INSTRUCTIONS");
  lines.push("───────────────────────────────────────────────────────");
  report.instructions.general.forEach((inst: string) => {
    lines.push(`• ${inst}`);
  });
  lines.push("");
  lines.push("Warning Signs (Seek immediate care if you experience):");
  report.instructions.warning_signs.forEach((warn: string) => {
    lines.push(`⚠ ${warn}`);
  });
  lines.push("");

  // Follow-up
  lines.push("───────────────────────────────────────────────────────");
  lines.push("FOLLOW-UP");
  lines.push("───────────────────────────────────────────────────────");
  lines.push(report.follow_up.instructions);
  lines.push("");

  // Doctor Signature
  lines.push("───────────────────────────────────────────────────────");
  lines.push("CONSULTING PHYSICIAN");
  lines.push("───────────────────────────────────────────────────────");
  lines.push(`Dr. ${report.doctor_signature.name}`);
  if (report.doctor_signature.specialization) lines.push(report.doctor_signature.specialization);
  if (report.doctor_signature.license_number) lines.push(`Reg. No: ${report.doctor_signature.license_number}`);
  if (report.doctor_signature.signature_text) {
    lines.push("");
    lines.push(`Signature: ${report.doctor_signature.signature_text}`);
  }
  lines.push("");

  // Disclaimer
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("DISCLAIMER");
  lines.push("═══════════════════════════════════════════════════════");
  lines.push(report.disclaimer);
  lines.push("");
  lines.push(`Generated by ${report.header.platform_name} on ${new Date().toLocaleString("en-IN")}`);

  return lines.join("\n");
}
