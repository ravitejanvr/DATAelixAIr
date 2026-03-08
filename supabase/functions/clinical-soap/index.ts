import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, extractedData, clinical_context } = await req.json();

    if (!transcript && !extractedData && !clinical_context) {
      return new Response(JSON.stringify({ error: "Transcript, extracted data, or clinical context required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const safetyContext = extractedData?.safety_results
      ? `\n\nSAFETY CONTROLLER FINDINGS:\n${JSON.stringify(extractedData.safety_results, null, 2)}`
      : "";

    const systemPrompt = `You are a concise clinical documentation assistant for small private clinics in Hyderabad, India.

Given a consultation transcript and/or structured extracted clinical data, generate a brief clinical summary.

OUTPUT FORMAT (use these exact headings):

**Visit Summary**
1-2 lines summarising the visit reason and key findings.

**Findings**
Relevant clinical findings, vitals, observations. Only what was mentioned.

**Provisional Diagnosis**
Use conservative language: "Likely", "Consistent with", "Provisional diagnosis", "Consider evaluation for...".
If diagnosis unclear: "Provisional diagnosis: To be clinically determined"
If insufficient data: "Insufficient information to determine definitive diagnosis."
NEVER use definitive diagnostic language unless there are clear, documented supporting findings.
Always append: "Clinical correlation recommended" when uncertainty exists.

**Safety Warnings**
If safety controller findings are provided, summarise:
- Drug normalization issues
- Interaction warnings
- Allergy conflicts
- Dose concerns
If no safety issues: "No safety concerns identified."

**Treatment Plan**
Medications, dosage adjustments, lifestyle changes. Only what was discussed.

**Advice**
Patient instructions, dietary guidance, activity modifications.

**Follow-up**
When to return, what to monitor.

RULES:
- Keep the ENTIRE output under 15-18 lines total
- Use ONLY information from the transcript and extracted data
- Do NOT invent findings not mentioned
- Do NOT escalate conditions or use emergency language
- Do NOT include literature references or citations
- Do NOT suggest specialist referrals unless explicitly discussed
- Use conservative, practical clinical language
- If a section has no relevant data, write "Not discussed" for that section
- The output must be plain text with the headings as shown above
- When uncertainty is detected, ALWAYS use provisional/hedged language
- NEVER generate hallucinated contraindications or side effects not supported by data`;

    const userMessage = `CONSULTATION TRANSCRIPT:
${transcript || "Not provided"}

EXTRACTED CLINICAL DATA:
${JSON.stringify(extractedData || {}, null, 2)}${safetyContext}

Generate the concise clinical summary following the format exactly.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse sections from the generated text
    const sections: Record<string, string> = {};
    const headings = ["Visit Summary", "Findings", "Provisional Diagnosis", "Safety Warnings", "Treatment Plan", "Advice", "Follow-up"];
    
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const pattern = new RegExp(`\\*\\*${heading}\\*\\*[\\s]*([\\s\\S]*?)(?=\\*\\*(?:${headings.slice(i + 1).join("|")})\\*\\*|$)`);
      const match = content.match(pattern);
      sections[heading] = match ? match[1].trim() : "Not discussed";
    }

    return new Response(JSON.stringify({
      soap_text: content,
      sections,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clinical-soap error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
