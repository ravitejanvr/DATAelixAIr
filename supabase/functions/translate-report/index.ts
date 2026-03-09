import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * translate-report Edge Function
 *
 * Translates specific report fields into Telugu or Hindi using structured tool calling.
 * Preserves drug names, lab test names, doctor names, and clinic names in English.
 *
 * Input: { fields: { chiefComplaint, symptoms, findings, diagnosis, plan, advice[], followUpInstructions }, language: "hindi" | "telugu" }
 * Output: { translated: { ...same keys with translated values }, language }
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fields, language, content } = await req.json();

    // Support legacy single-string mode
    if (content && !fields) {
      return handleLegacy(content, language);
    }

    if (!fields || !language) {
      return new Response(JSON.stringify({ error: "fields and language are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["hindi", "telugu"].includes(language)) {
      return new Response(JSON.stringify({ error: "language must be 'hindi' or 'telugu'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langName = language === "hindi" ? "Hindi (हिन्दी)" : "Telugu (తెలుగు)";

    // Build a structured prompt with all translatable fields
    const fieldEntries: Record<string, string> = {};
    const translatableKeys = [
      "chiefComplaint", "symptoms", "findings", "diagnosis", "plan",
      "followUpInstructions",
    ];

    for (const key of translatableKeys) {
      if (fields[key]) fieldEntries[key] = fields[key];
    }

    // Handle advice array separately
    if (fields.advice && Array.isArray(fields.advice) && fields.advice.length > 0) {
      fieldEntries["advice"] = fields.advice.join("\n---ITEM---\n");
    }

    // Section headings to translate
    const headings = {
      patientInformation: "Patient Information",
      vitals: "Vitals",
      consultationSummary: "Consultation Summary",
      chiefComplaintLabel: "Chief Complaint",
      symptomsLabel: "Symptoms",
      clinicalFindings: "Clinical Findings",
      provisionalDiagnosis: "Provisional Diagnosis",
      planLabel: "Plan",
      prescription: "Prescription",
      investigations: "Investigations",
      adviceLabel: "Advice / Patient Instructions",
      followUp: "Follow-Up",
      nextVisit: "Next visit",
      doctorSignature: "Doctor Signature",
      demoWatermark: "Demo Report – Not for clinical use",
    };
    fieldEntries["sectionHeadings"] = JSON.stringify(headings);

    const prompt = `Translate each field below into ${langName}. Return a JSON object with the same keys and translated values.

CRITICAL RULES:
- Do NOT translate drug names (e.g., Amlodipine, Paracetamol)
- Do NOT translate lab test names (e.g., CBC, HbA1c, TSH)
- Do NOT translate doctor names or clinic names
- Do NOT translate medical abbreviations (BP, SpO2, OD, BD, TID, SOS, HS)
- Do NOT translate dosage values (5mg, 500mg)
- Keep numbers as-is
- For the "advice" field, items are separated by "---ITEM---". Translate each item and return them separated by the same delimiter.
- For "sectionHeadings", parse the JSON, translate values only, return as JSON string.

Fields to translate:
${JSON.stringify(fieldEntries, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a medical document translator specializing in ${langName}. You translate clinical consultation reports for patients in India. Output ONLY valid JSON, no markdown, no explanations.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    let rawContent = result.choices?.[0]?.message?.content || "{}";

    // Strip markdown code fences if present
    rawContent = rawContent.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response as JSON:", rawContent);
      throw new Error("Translation returned invalid format");
    }

    // Post-process advice back into array
    const translated: Record<string, any> = {};
    for (const key of translatableKeys) {
      if (parsed[key]) translated[key] = parsed[key];
    }

    if (parsed.advice) {
      translated.advice = typeof parsed.advice === "string"
        ? parsed.advice.split("---ITEM---").map((s: string) => s.trim()).filter(Boolean)
        : parsed.advice;
    }

    // Parse section headings
    if (parsed.sectionHeadings) {
      try {
        translated.sectionHeadings = typeof parsed.sectionHeadings === "string"
          ? JSON.parse(parsed.sectionHeadings)
          : parsed.sectionHeadings;
      } catch {
        translated.sectionHeadings = parsed.sectionHeadings;
      }
    }

    return new Response(JSON.stringify({ translated, language }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Legacy single-string translation for backward compat */
async function handleLegacy(content: string, language: string) {
  if (!content || !language) {
    return new Response(JSON.stringify({ error: "content and language are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!["hindi", "telugu"].includes(language)) {
    return new Response(JSON.stringify({ error: "language must be 'hindi' or 'telugu'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const langName = language === "hindi" ? "Hindi (हिन्दी)" : "Telugu (తెలుగు)";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a medical translator. Translate the following clinical consultation report into ${langName}. 
Keep medical terms in English where appropriate (drug names, lab values, ICD codes).
Preserve the structure and formatting. Output ONLY the translated text, no explanations.`,
        },
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await response.text();
    throw new Error(`AI gateway error: ${response.status} ${text}`);
  }

  const result = await response.json();
  const translated = result.choices?.[0]?.message?.content || "";

  return new Response(JSON.stringify({ translated, language }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
