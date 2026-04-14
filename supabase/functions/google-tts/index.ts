import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Voice map for Indic languages supported by Google Cloud TTS
const VOICE_MAP: Record<string, { languageCode: string; name: string }> = {
  te: { languageCode: "te-IN", name: "te-IN-Standard-A" },
  hi: { languageCode: "hi-IN", name: "hi-IN-Standard-A" },
  ta: { languageCode: "ta-IN", name: "ta-IN-Standard-A" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language } = await req.json();

    // --- GUARD 1: API key ---
    const GOOGLE_TTS_API_KEY = Deno.env.get("GOOGLE_TTS_API_KEY");
    if (!GOOGLE_TTS_API_KEY) {
      console.error("[GOOGLE_TTS] GOOGLE_TTS_API_KEY is NOT configured");
      return new Response(
        JSON.stringify({ error: "GOOGLE_TTS_NOT_CONFIGURED", message: "Google TTS API key missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- GUARD 2: Input validation ---
    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No text provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang = (language || "te").toLowerCase();
    const voice = VOICE_MAP[lang];
    if (!voice) {
      return new Response(
        JSON.stringify({ error: `Unsupported language: ${lang}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[GOOGLE_TTS] Synthesizing:", {
      provider: "google",
      language: lang,
      voice: voice.name,
      textLen: text.length,
      textPreview: text.substring(0, 80),
    });

    // --- Call Google Cloud TTS ---
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: voice.languageCode,
            name: voice.name,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 0.95,
            pitch: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[GOOGLE_TTS] API error:", response.status, errText);
      return new Response(
        JSON.stringify({
          error: "GOOGLE_TTS_FAILED",
          status: response.status,
          details: errText.substring(0, 300),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const audioContent = data.audioContent; // base64

    if (!audioContent) {
      console.error("[GOOGLE_TTS] No audioContent in response");
      return new Response(
        JSON.stringify({ error: "GOOGLE_TTS_NO_AUDIO" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 to binary
    const binaryString = atob(audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log("[GOOGLE_TTS] Success:", { provider: "google", language: lang, audioBytes: bytes.length });

    return new Response(bytes.buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err) {
    console.error("[GOOGLE_TTS] Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "GOOGLE_TTS_INTERNAL_ERROR", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
