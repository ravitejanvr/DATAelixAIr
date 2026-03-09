import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClinicalCard, SkeletonCard } from "@/components/ui/clinical-card";
import SEO from "@/components/SEO";
import { FileText, Search, ChevronRight, RefreshCw } from "lucide-react";

type ReportItem = {
  id: string;
  created_at: string;
  status: string | null;
  chief_complaint: string | null;
  patient: {
    name: string;
    age: number | null;
    gender: string | null;
    phone: string | null;
  } | null;
};

function statusVariant(status: string | null): "secondary" | "default" | "destructive" {
  if (!status) return "secondary";
  if (status === "completed" || status === "shared") return "default";
  return "secondary";
}

export default function Reports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("consultations")
      .select(
        "id, created_at, status, chief_complaint, patient:patients(name, age, gender, phone)",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    setItems((data as unknown as ReportItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const p = it.patient;
      return (
        (p?.name || "").toLowerCase().includes(q) ||
        (p?.phone || "").includes(q) ||
        (it.chief_complaint || "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  return (
    <>
      <SEO title="Reports — DATAelixAIr" description="Consultation reports" />
      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Reports</h1>
            <p className="text-xs text-muted-foreground">{items.length} consultations</p>
          </div>
          <Button size="sm" variant="outline" className="gap-2 rounded-xl" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 h-11 text-sm rounded-2xl bg-muted/50 border-border focus:bg-background"
            placeholder="Search by patient, phone, or complaint…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <ClinicalCard className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">
              {search ? "No reports match" : "No reports yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Try a different search" : "Complete a consultation to generate a report"}
            </p>
          </ClinicalCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((it) => (
              <ClinicalCard
                key={it.id}
                className="cursor-pointer hover:shadow-md transition-all group"
                onClick={() => navigate(`/consultations/${it.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {it.patient?.name || "Unknown patient"}
                      </p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {it.patient?.age != null && <span>{it.patient.age}y</span>}
                      {it.patient?.gender && <span className="capitalize">{it.patient.gender}</span>}
                      <span>•</span>
                      <span>{new Date(it.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(it.status)} className="text-[10px]">
                        {it.status || "draft"}
                      </Badge>
                      {it.chief_complaint && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {it.chief_complaint}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </ClinicalCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
