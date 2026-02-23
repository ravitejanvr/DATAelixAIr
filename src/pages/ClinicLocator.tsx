import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Search, Loader2, Navigation, ExternalLink, Star, Clock } from "lucide-react";

interface ClinicResult {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  rating: number | null;
  user_ratings_total: number;
  open_now: boolean | null;
  types: string[];
  business_status: string;
  photo_reference: string | null;
}

export default function ClinicLocator() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClinicResult[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<ClinicResult | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setUserLocation(loc);
          searchNearby(loc.lat, loc.lon);
        },
        () => console.log("Geolocation not available, using default")
      );
    }
  }, []);

  const searchNearby = async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("places-search", {
        body: { lat, lon, type: "nearby" },
      });
      if (error) throw error;
      setResults(data.clinics || []);
    } catch (err) {
      console.error("Nearby search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("places-search", {
        body: { query },
      });
      if (error) throw error;
      setResults(data.clinics || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDistance = (lat: number, lon: number): string | null => {
    if (!userLocation) return null;
    const R = 6371;
    const dLat = ((lat - userLocation.lat) * Math.PI) / 180;
    const dLon = ((lon - userLocation.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  };

  const openInMaps = (clinic: ClinicResult) => {
    window.open(`https://www.google.com/maps/place/?q=place_id:${clinic.place_id}`, "_blank");
  };

  const getDirections = (clinic: ClinicResult) => {
    if (userLocation) {
      window.open(
        `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lon}/${clinic.lat},${clinic.lon}`,
        "_blank"
      );
    } else {
      window.open(`https://www.google.com/maps/dir//${clinic.lat},${clinic.lon}`, "_blank");
    }
  };

  const getMapUrl = () => {
    if (selectedClinic) {
      return `https://maps.google.com/maps?q=${selectedClinic.lat},${selectedClinic.lon}&z=15&output=embed`;
    }
    if (userLocation) {
      return `https://maps.google.com/maps?q=${userLocation.lat},${userLocation.lon}&z=13&output=embed`;
    }
    return `https://maps.google.com/maps?q=20.5937,78.9629&z=5&output=embed`;
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
        <span className="text-xs font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <>
      <SEO title="Find a Clinic — DATAelixAIr" description="Locate hospitals and clinics near you with ratings and reviews" />

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-3 text-xs">
              <MapPin className="h-3 w-3 mr-1" /> Clinic Locator
            </Badge>
            <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground mb-3">
              Find Hospitals & Clinics <span className="text-primary">Near You</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Search for healthcare facilities with ratings, reviews, and real-time availability. Powered by Google Maps.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto mb-8">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city, area, or clinic name..."
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Search
            </Button>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="overflow-hidden">
              <div ref={mapRef} className="w-full h-[400px] lg:h-[500px]">
                <iframe
                  src={getMapUrl()}
                  className="w-full h-full border-0"
                  title="Clinic Map"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  {results.length > 0 ? `${results.length} Results Found` : "Search Results"}
                </CardTitle>
                <CardDescription>
                  {userLocation ? "Showing clinics near your location" : "Enter a location to search"}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[420px] overflow-y-auto space-y-2">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {!loading && results.length === 0 && (
                  <div className="text-center py-12">
                    <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {userLocation ? "No clinics found nearby. Try searching by name." : "Allow location access or search by city name."}
                    </p>
                  </div>
                )}
                {results.map((clinic) => {
                  const dist = getDistance(clinic.lat, clinic.lon);
                  return (
                    <button
                      key={clinic.place_id}
                      onClick={() => setSelectedClinic(clinic)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedClinic?.place_id === clinic.place_id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{clinic.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{clinic.address}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {renderStars(clinic.rating)}
                            {clinic.user_ratings_total > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                ({clinic.user_ratings_total.toLocaleString()} reviews)
                              </span>
                            )}
                            {clinic.open_now !== null && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  clinic.open_now
                                    ? "border-green-300 text-green-700 bg-green-50"
                                    : "border-red-300 text-red-700 bg-red-50"
                                }`}
                              >
                                <Clock className="h-2.5 w-2.5 mr-0.5" />
                                {clinic.open_now ? "Open" : "Closed"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {dist && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">{dist}</Badge>
                        )}
                      </div>
                      {selectedClinic?.place_id === clinic.place_id && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); getDirections(clinic); }}>
                            <Navigation className="h-3 w-3 mr-1" /> Directions
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); openInMaps(clinic); }}>
                            <ExternalLink className="h-3 w-3 mr-1" /> Open in Maps
                          </Button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
