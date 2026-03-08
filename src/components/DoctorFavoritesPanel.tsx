import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Star, Clock, ChevronDown, ChevronRight, Search, Plus, Trash2, Loader2 } from "lucide-react";

export interface FavoriteDrug {
  id: string;
  generic_name: string;
  default_dose: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  preferred_brand: string | null;
}

export interface RecentDrug {
  drug_name: string;
  dosage: string;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  use_count: number;
}

interface DrugTemplate {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
}

interface DoctorFavoritesPanelProps {
  onSelectDrug: (drug: DrugTemplate) => void;
}

export default function DoctorFavoritesPanel({ onSelectDrug }: DoctorFavoritesPanelProps) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteDrug[]>([]);
  const [recents, setRecents] = useState<RecentDrug[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [favOpen, setFavOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load favorites
      const { data: favData } = await supabase
        .from("doctor_favorites")
        .select("id, generic_name, default_dose, frequency, duration, route, instructions, preferred_brand")
        .eq("doctor_id", user.id)
        .order("generic_name");

      if (favData) setFavorites(favData);

      // Load recent prescriptions (last 50, aggregated by drug_name)
      const { data: rxData } = await supabase
        .from("prescriptions")
        .select("drug_name, dosage, frequency, duration, route, instructions")
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (rxData) {
        const drugMap = new Map<string, RecentDrug>();
        for (const rx of rxData) {
          const key = rx.drug_name.toLowerCase().trim();
          if (drugMap.has(key)) {
            drugMap.get(key)!.use_count++;
          } else {
            drugMap.set(key, {
              drug_name: rx.drug_name,
              dosage: rx.dosage,
              frequency: rx.frequency,
              duration: rx.duration,
              route: rx.route,
              instructions: rx.instructions,
              use_count: 1,
            });
          }
        }
        // Sort by frequency of use
        const sorted = Array.from(drugMap.values()).sort((a, b) => b.use_count - a.use_count).slice(0, 10);
        setRecents(sorted);
      }
    } catch {
      // silent
    }
    setLoading(false);
  };

  const filteredFavorites = favorites.filter(f =>
    f.generic_name.toLowerCase().includes(search.toLowerCase()) ||
    (f.preferred_brand && f.preferred_brand.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredRecents = recents.filter(r =>
    r.drug_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectFavorite = (fav: FavoriteDrug) => {
    onSelectDrug({
      drug_name: fav.generic_name,
      dosage: fav.default_dose || "",
      frequency: fav.frequency || "Once daily",
      duration: fav.duration || "5 days",
      route: fav.route || "Oral",
      instructions: fav.instructions || "",
    });
  };

  const handleSelectRecent = (rec: RecentDrug) => {
    onSelectDrug({
      drug_name: rec.drug_name,
      dosage: rec.dosage,
      frequency: rec.frequency || "Once daily",
      duration: rec.duration || "5 days",
      route: rec.route || "Oral",
      instructions: rec.instructions || "",
    });
  };

  const removeFavorite = async (id: string) => {
    await supabase.from("doctor_favorites").delete().eq("id", id);
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Search */}
      {(favorites.length > 0 || recents.length > 0) && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medications…"
            className="h-7 text-[10px] pl-7"
          />
        </div>
      )}

      {/* Favorites Section */}
      <Collapsible open={favOpen} onOpenChange={setFavOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground transition-colors">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-500" />
            Favorites
            <Badge variant="outline" className="text-[8px] ml-1">{filteredFavorites.length}</Badge>
          </span>
          {favOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {filteredFavorites.length === 0 ? (
            <p className="text-[9px] text-muted-foreground py-1">No favorites saved yet. Save medications from prescriptions to build your list.</p>
          ) : (
            <ScrollArea className="max-h-[160px]">
              <div className="space-y-0.5">
                {filteredFavorites.map(fav => (
                  <button
                    key={fav.id}
                    onClick={() => handleSelectFavorite(fav)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-foreground truncate">{fav.generic_name}</span>
                        {fav.preferred_brand && (
                          <span className="text-[8px] text-muted-foreground">({fav.preferred_brand})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        {fav.default_dose && <span>{fav.default_dose}</span>}
                        {fav.frequency && <span>· {fav.frequency}</span>}
                        {fav.duration && <span>· {fav.duration}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <Plus className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <button
                        onClick={e => { e.stopPropagation(); removeFavorite(fav.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Recent Prescriptions Section */}
      <Collapsible open={recentOpen} onOpenChange={setRecentOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground transition-colors">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" />
            Recent
            <Badge variant="outline" className="text-[8px] ml-1">{filteredRecents.length}</Badge>
          </span>
          {recentOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {filteredRecents.length === 0 ? (
            <p className="text-[9px] text-muted-foreground py-1">No recent prescriptions found.</p>
          ) : (
            <ScrollArea className="max-h-[140px]">
              <div className="space-y-0.5">
                {filteredRecents.map((rec, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectRecent(rec)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-foreground truncate">{rec.drug_name}</span>
                        <Badge variant="secondary" className="text-[7px] px-1 py-0">{rec.use_count}×</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <span>{rec.dosage}</span>
                        {rec.frequency && <span>· {rec.frequency}</span>}
                        {rec.duration && <span>· {rec.duration}</span>}
                      </div>
                    </div>
                    <Plus className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
