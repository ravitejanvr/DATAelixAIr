import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Users, Clock, RefreshCw, ArrowRight } from "lucide-react";
import { VISIT_STATUSES, VISIT_STATUS_CONFIG } from "@/layers/workflow/api";

const STATUSES = VISIT_STATUSES;
const statusConfig = VISIT_STATUS_CONFIG;

export default function VisitTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadVisits();
    const channel = supabase
      .channel("visit-tracker")
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_visits" }, () => loadVisits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadVisits = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("patient_visits")
      .select("*, patients(name, age, gender, phone)")
      .neq("status", "complete")
      .order("check_in_time", { ascending: true });
    setVisits(data || []);
    setLoading(false);
  };

  const updateStatus = async (visitId: string, newStatus: string) => {
    const { data: result, error } = await supabase.functions.invoke("update-visit-status", {
      body: { visit_id: visitId, target_status: newStatus },
    });
    if (error || result?.error) {
      toast({ title: "Error updating status", description: error?.message || result?.error, variant: "destructive" });
    }
  };

  const waitingTime = (checkIn: string) => {
    const mins = Math.round((Date.now() - new Date(checkIn).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <>
      <SEO title="Visit Tracker — DATAelixAIr" description="Live patient visit tracking" />
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Live Visit Tracker
            </h1>
            <p className="text-sm text-muted-foreground">Kanban view of patient journey through the clinic</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={loadVisits} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Kanban Columns */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUSES.map((status, idx) => {
            const config = statusConfig[status];
            const statusVisits = visits.filter(v => v.status === status);
            return (
              <div key={status} className="min-w-[200px] flex-shrink-0">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      status === "complete" ? "bg-chip-medication-text" : 
                      status === "doctor" ? "bg-primary" : "bg-muted-foreground/40"
                    }`} />
                    <span className="text-xs font-semibold text-foreground">{config.label}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 min-w-[20px] justify-center">
                    {statusVisits.length}
                  </Badge>
                </div>

                {/* Arrow between columns */}
                <div className="space-y-2 min-h-[120px]">
                  {statusVisits.map(visit => (
                    <ClinicalCard key={visit.id} className="p-3">
                      <p className="text-sm font-semibold text-foreground truncate mb-1">
                        {(visit.patients as any)?.name || "Unknown"}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(visit.patients as any)?.age && (
                          <Chip variant="neutral" size="sm">
                            {(visit.patients as any).age}y · {(visit.patients as any).gender || ""}
                          </Chip>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                        <Clock className="h-3 w-3" />
                        {waitingTime(visit.check_in_time)}
                      </div>
                      {status !== "complete" && (
                        <Select
                          value={visit.status}
                          onValueChange={(val) => updateStatus(visit.id, val)}
                        >
                          <SelectTrigger className="h-7 text-[10px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {statusConfig[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </ClinicalCard>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {visits.length === 0 && !loading && (
          <ClinicalCard className="mt-6 py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No active visits. Register a patient to begin tracking.</p>
          </ClinicalCard>
        )}
      </div>
    </>
  );
}