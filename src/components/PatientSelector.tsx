import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, User, Plus, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export interface SelectedPatient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  allergies: string[] | null;
  current_medications: string[] | null;
  medical_history: any;
  created_at: string;
}

interface PatientSelectorProps {
  onSelect: (patient: SelectedPatient | null) => void;
  selected: SelectedPatient | null;
}

export default function PatientSelector({ onSelect, selected }: PatientSelectorProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelectedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!user || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("patients")
        .select("id, name, age, gender, phone, allergies, current_medications, medical_history, created_at")
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(8);
      setResults((data as SelectedPatient[]) || []);
    } catch { setResults([]); }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => { if (query.length >= 2) search(query); else setResults([]); }, 250);
    return () => clearTimeout(t);
  }, [query, search]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/20 bg-primary/[0.03]">
        <User className="h-3.5 w-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate">{selected.name}</span>
            {selected.age && <span className="text-[10px] text-muted-foreground">{selected.age}y</span>}
            {selected.gender && <span className="text-[10px] text-muted-foreground capitalize">• {selected.gender}</span>}
          </div>
          {selected.allergies && selected.allergies.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertTriangle className="h-2.5 w-2.5 text-destructive" />
              <span className="text-[9px] text-destructive font-medium truncate">{selected.allergies.join(", ")}</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSelect(null)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search patient by name or phone…"
          className="h-8 text-xs pl-7"
        />
      </div>
      {showDropdown && (query.length >= 2) && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No patients found</div>
          )}
          {results.map(p => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center justify-between"
              onClick={() => { onSelect(p); setShowDropdown(false); setQuery(""); }}
            >
              <div>
                <span className="font-medium text-foreground">{p.name}</span>
                {p.age && <span className="text-muted-foreground ml-1.5">{p.age}y</span>}
                {p.gender && <span className="text-muted-foreground ml-1 capitalize">{p.gender}</span>}
              </div>
              <span className="text-[10px] text-muted-foreground">{p.phone || ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
