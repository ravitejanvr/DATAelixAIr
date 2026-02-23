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

  const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!GOOGLE_PLACES_API_KEY) {
    return new Response(JSON.stringify({ error: "Google API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { lat, lon } = await req.json();

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: "lat and lon are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google Air Quality API - Current Conditions
    const aqResp = await fetch(
      `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_PLACES_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: { latitude: lat, longitude: lon },
          extraComputations: [
            "HEALTH_RECOMMENDATIONS",
            "DOMINANT_POLLUTANT_CONCENTRATION",
            "POLLUTANT_CONCENTRATION",
          ],
          languageCode: "en",
        }),
      }
    );

    if (!aqResp.ok) {
      const errText = await aqResp.text();
      console.error("Air Quality API error:", aqResp.status, errText);
      // Fallback: return null AQI so CDSS can still run
      return new Response(JSON.stringify({ aqi: null, message: "Air Quality API unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aqData = await aqResp.json();

    // Extract the universal AQI index
    const universalAqi = aqData.indexes?.find((idx: any) => idx.code === "uaqi");
    const usAqi = aqData.indexes?.find((idx: any) => idx.code === "usa_epa");

    // Extract pollutant data
    const pollutants = (aqData.pollutants || []).map((p: any) => ({
      code: p.code,
      displayName: p.displayName,
      concentration: p.concentration?.value,
      unit: p.concentration?.units,
    }));

    // Extract health recommendations
    const healthRecommendations = aqData.healthRecommendations || {};

    const result = {
      aqi: usAqi?.aqi || universalAqi?.aqi || null,
      category: usAqi?.category || universalAqi?.category || "Unknown",
      dominantPollutant: usAqi?.dominantPollutant || universalAqi?.dominantPollutant || null,
      color: usAqi?.color || universalAqi?.color || null,
      pollutants,
      healthRecommendations,
      dateTime: aqData.dateTime || new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AQI fetch error:", error);
    return new Response(JSON.stringify({ aqi: null, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
