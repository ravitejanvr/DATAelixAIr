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
    return new Response(JSON.stringify({ error: "Google Places API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { query, lat, lon, type } = await req.json();

    let results: any[] = [];

    if (type === "nearby" && lat && lon) {
      // Nearby Search
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=10000&type=hospital&key=${GOOGLE_PLACES_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      results = data.results || [];
    } else if (query) {
      // Text Search
      const searchQuery = `${query} hospital clinic medical`;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&type=hospital&key=${GOOGLE_PLACES_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      results = data.results || [];
    } else {
      return new Response(JSON.stringify({ error: "Provide query or lat/lon" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map to clean response with ratings, address, etc.
    const clinics = results.slice(0, 15).map((place: any) => ({
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address || place.vicinity || "",
      lat: place.geometry?.location?.lat,
      lon: place.geometry?.location?.lng,
      rating: place.rating || null,
      user_ratings_total: place.user_ratings_total || 0,
      open_now: place.opening_hours?.open_now ?? null,
      types: place.types || [],
      business_status: place.business_status || "OPERATIONAL",
      photo_reference: place.photos?.[0]?.photo_reference || null,
    }));

    return new Response(JSON.stringify({ clinics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Places search error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
