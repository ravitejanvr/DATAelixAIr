import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Users, Clock, RefreshCw } from "lucide-react";
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

    // Realtime subscription
    const channel = supabase
      .channel("visit-tracker")
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_visits" }, () => {
        loadVisits();
      })
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
    const { error } = await supabase
      .from("patient_visits")
      .update({ status: newStatus } as any)
      .eq("id", visitId);
    if (error) {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Live Visit Tracker
            </h1>
            <p className="text-sm text-muted-foreground">Real-time patient journey through the clinic</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadVisits} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Status columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {STATUSES.map(status => {
            const config = statusConfig[status];
            const statusVisits = visits.filter(v => v.status === status);
            return (
              <div key={status} className="space-y-2">
                <div className={`text-center py-1.5 rounded-lg text-xs font-medium border ${config.color}`}>
                  {config.label} ({statusVisits.length})
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {statusVisits.map(visit => (
                    <Card key={visit.id} className="border-border">
                      <CardContent className="p-3 space-y-2">
                        <p className="text-sm font-medium truncate">
                          {(visit.patients as any)?.name || "Unknown"}
                        </p>
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          {(visit.patients as any)?.age && (
                            <p>{(visit.patients as any).age}y · {(visit.patients as any).gender || ""}</p>
                          )}
                          <p className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {waitingTime(visit.check_in_time)}
                          </p>
                        </div>
                        {status !== "complete" && (
                          <Select
                            value={visit.status}
                            onValueChange={(val) => updateStatus(visit.id, val)}
                          >
                            <SelectTrigger className="h-7 text-[10px]">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {visits.length === 0 && !loading && (
          <Card className="mt-6">
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No active visits. Register a patient to begin tracking.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
