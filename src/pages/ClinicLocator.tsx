import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import { MapPin, Search, Loader2, Navigation, Phone, Clock, ExternalLink } from "lucide-react";

interface ClinicResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

export default function ClinicLocator() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClinicResult[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<ClinicResult | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          // Auto-search nearby clinics
          searchNearby(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Default to a central location if geolocation denied
          console.log("Geolocation not available, using default");
        }
      );
    }
  }, []);

  const searchNearby = async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=hospital+clinic+near&viewbox=${lon - 0.1},${lat + 0.1},${lon + 0.1},${lat - 0.1}&bounded=1&limit=20&addressdetails=1`
      );
      const data = await resp.json();
      setResults(data.filter((r: any) =>
        r.type === "hospital" || r.type === "clinic" || r.type === "doctors" ||
        r.display_name.toLowerCase().includes("hospital") ||
        r.display_name.toLowerCase().includes("clinic") ||
        r.display_name.toLowerCase().includes("medical")
      ).slice(0, 15));
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const searchTerm = `${query} hospital clinic medical`;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=20&addressdetails=1`
      );
      const data = await resp.json();
      setResults(data.slice(0, 15));
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDistance = (lat: string, lon: string): string | null => {
    if (!userLocation) return null;
    const R = 6371;
    const dLat = ((parseFloat(lat) - userLocation.lat) * Math.PI) / 180;
    const dLon = ((parseFloat(lon) - userLocation.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.lat * Math.PI) / 180) * Math.cos((parseFloat(lat) * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  };

  const openInMaps = (clinic: ClinicResult) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${clinic.lat},${clinic.lon}`, "_blank");
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

  // Build OpenStreetMap embed URL
  const getMapUrl = () => {
    if (selectedClinic) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(selectedClinic.lon) - 0.01},${parseFloat(selectedClinic.lat) - 0.01},${parseFloat(selectedClinic.lon) + 0.01},${parseFloat(selectedClinic.lat) + 0.01}&layer=mapnik&marker=${selectedClinic.lat},${selectedClinic.lon}`;
    }
    if (userLocation) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${userLocation.lon - 0.05},${userLocation.lat - 0.05},${userLocation.lon + 0.05},${userLocation.lat + 0.05}&layer=mapnik&marker=${userLocation.lat},${userLocation.lon}`;
    }
    return `https://www.openstreetmap.org/export/embed.html?bbox=68.0,6.5,97.5,37.0&layer=mapnik`;
  };

  return (
    <>
      <SEO title="Find a Clinic — DATAelixAIr" description="Locate hospitals and clinics near you with our free clinic locator" />

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
              Search for healthcare facilities by location. Powered by OpenStreetMap — free and open source.
            </p>
          </div>

          {/* Search */}
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
            {/* Map */}
            <Card className="overflow-hidden">
              <div ref={mapRef} className="w-full h-[400px] lg:h-[500px]">
                <iframe
                  src={getMapUrl()}
                  className="w-full h-full border-0"
                  title="Clinic Map"
                  loading="lazy"
                />
              </div>
            </Card>

            {/* Results */}
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
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {clinic.display_name.split(",")[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {clinic.display_name.split(",").slice(1, 4).join(",")}
                          </p>
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
