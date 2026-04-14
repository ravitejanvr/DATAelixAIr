import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      console.error("[TTS] ELEVENLABS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "TTS_NOT_CONFIGURED", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedVoice = voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah - multilingual

    console.log("[TTS] Generating speech:", {
      voiceId: selectedVoice,
      textLen: text.length,
      textPreview: text.substring(0, 80),
    });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[TTS] ElevenLabs error:", response.status, errText);

      // Return structured error with fallback signal instead of 502
      const isFallbackable = response.status >= 500 || response.status === 429;
      return new Response(
        JSON.stringify({
          error: isFallbackable ? "TTS_SERVICE_UNAVAILABLE" : `ElevenLabs error: ${response.status}`,
          fallback: isFallbackable,
          details: errText.substring(0, 200),
        }),
        {
          status: 200, // Return 200 so client can read JSON body
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err) {
    console.error("[TTS] Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "TTS_GENERATION_FAILED", fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
