import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader, SkeletonCard } from "@/components/ui/clinical-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, PhoneCall, Clock, CheckCircle2, Loader2, RefreshCw,
  Search, UserCheck, Stethoscope, QrCode, Activity, AlertTriangle,
} from "lucide-react";
import ClinicQRCode from "@/components/ClinicQRCode";
import { VISIT_STATUSES, VISIT_STATUS_CONFIG } from "@/layers/workflow/api";

interface QueueItem {
  id: string;
  token_number: number | null;
  check_in_time: string;
  status: string;
  visit_type: string | null;
  patient_id: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  patient_phone: string | null;
  chief_complaint: string | null;
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "active", label: "In Consultation" },
  { key: "complete", label: "Completed" },
] as const;

const STATUS_CHIP: Record<string, { label: string; variant: "symptom" | "medication" | "lab" | "neutral" | "diagnosis" }> = {
  registered: { label: "Waiting", variant: "lab" },
  intake: { label: "Intake", variant: "neutral" },
  triage: { label: "Triage", variant: "symptom" },
  vitals: { label: "Vitals", variant: "diagnosis" },
  doctor: { label: "With Doctor", variant: "medication" },
  lab: { label: "Lab", variant: "lab" },
  pharmacy: { label: "Pharmacy", variant: "lab" },
  billing: { label: "Billing", variant: "neutral" },
  complete: { label: "Done", variant: "medication" },
};

export default function PatientQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [tab, setTab] = useState<string>("queue");

  // Visit tracker state
  const [kanbanVisits, setKanbanVisits] = useState<any[]>([]);

  const loadQueue = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("user_id", user.id).single();
    if (!profile?.clinic_id) { setLoading(false); return; }
    setClinicId(profile.clinic_id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("patient_visits")
      .select("id, token_number, check_in_time, status, visit_type, patient_id, patients(name, age, gender, phone), triage(chief_complaint)")
      .eq("clinic_id", profile.clinic_id)
      .gte("check_in_time", today.toISOString())
      .order("token_number", { ascending: true });

    if (error) {
      toast({ title: "Error loading queue", description: error.message, variant: "destructive" });
    } else {
      const items = (data || []).map((v: any) => ({
        id: v.id, token_number: v.token_number, check_in_time: v.check_in_time,
        status: v.status, visit_type: v.visit_type, patient_id: v.patient_id,
        patient_name: v.patients?.name || "Unknown", patient_age: v.patients?.age,
        patient_gender: v.patients?.gender, patient_phone: v.patients?.phone,
        chief_complaint: v.triage?.[0]?.chief_complaint || v.triage?.chief_complaint || null,
      }));
      setQueue(items);
      // Also feed kanban
      setKanbanVisits((data || []).map((v: any) => ({ ...v, patients: v.patients })));
    }
    setLoading(false);
  };

  useEffect(() => { loadQueue(); }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_visits" }, () => loadQueue())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const callNextPatient = async () => {
    const waiting = queue.find(q => ["registered", "intake", "triage", "vitals"].includes(q.status));
    if (!waiting) { toast({ title: "No patients waiting" }); return; }
    const { data: result, error } = await supabase.functions.invoke("update-visit-status", {
      body: { visit_id: waiting.id, target_status: "with_doctor" },
    });
    if (error || result?.error) { toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" }); return; }
    toast({ title: `Calling Token #${waiting.token_number}`, description: waiting.patient_name });
    navigate("/clinical", { state: { queuePatient: { id: waiting.patient_id, name: waiting.patient_name, age: waiting.patient_age, gender: waiting.patient_gender, phone: waiting.patient_phone }, visitId: waiting.id } });
  };

  const markComplete = async (visitId: string) => {
    const { error, data: result } = await supabase.functions.invoke("update-visit-status", { body: { visit_id: visitId, target_status: "completed" } });
    if (error || result?.error) toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" });
    else loadQueue();
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
    const mins = Math.floor((Date.now() - new Date(checkIn).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const filteredQueue = queue.filter(q => {
    const matchesSearch = !search || q.patient_name.toLowerCase().includes(search.toLowerCase()) || String(q.token_number).includes(search);
    if (!matchesSearch) return false;
    if (filter === "waiting") return ["registered", "intake", "triage", "vitals"].includes(q.status);
    if (filter === "active") return q.status === "doctor";
    if (filter === "complete") return q.status === "complete";
    return true;
  });

  const waitingCount = queue.filter(q => ["registered", "intake", "triage", "vitals"].includes(q.status)).length;
  const activeCount = queue.filter(q => q.status === "doctor").length;
  const completedCount = queue.filter(q => q.status === "complete").length;

  const STATUSES = VISIT_STATUSES;
  const statusConfig = VISIT_STATUS_CONFIG;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      <SEO title="Patient Queue | DATAelixAIr" description="Manage clinic patient queue and visit tracking" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Patient Queue</h1>
          <p className="text-sm text-muted-foreground">Today's clinic flow</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowQR(!showQR)}>
            <QrCode className="h-4 w-4 mr-1.5" /> QR
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={loadQueue} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="rounded-lg" onClick={callNextPatient} disabled={waitingCount === 0}>
            <PhoneCall className="h-4 w-4 mr-1.5" /> Call Next
          </Button>
        </div>
      </div>

      {showQR && clinicId && <div className="max-w-xs"><ClinicQRCode clinicId={clinicId} /></div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Waiting", count: waitingCount, icon: Clock, color: "text-chip-lab-text", bg: "bg-chip-lab", filterKey: "waiting" },
          { label: "In Consultation", count: activeCount, icon: Stethoscope, color: "text-primary", bg: "bg-primary/10", filterKey: "active" },
          { label: "Completed", count: completedCount, icon: CheckCircle2, color: "text-chip-medication-text", bg: "bg-chip-medication", filterKey: "complete" },
        ].map(s => (
          <ClinicalCard
            key={s.filterKey}
            className={`cursor-pointer transition-all ${filter === s.filterKey ? "ring-2 ring-primary/30" : ""}`}
            onClick={() => setFilter(filter === s.filterKey ? "all" : s.filterKey)}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.count}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </ClinicalCard>
        ))}
      </div>

      {/* Tabs: Queue List / Visit Tracker */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-auto">
          <TabsTrigger value="queue">Queue List</TabsTrigger>
          <TabsTrigger value="tracker">Visit Tracker</TabsTrigger>
        </TabsList>

        {/* ═══ Queue List Tab ═══ */}
        <TabsContent value="queue" className="space-y-4 mt-4">
          {/* Search + Filter Chips */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or token…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-lg" />
            </div>
            <ChipGroup>
              {STATUS_FILTERS.map(f => (
                <Chip key={f.key} variant={filter === f.key ? "action" : "neutral"} selected={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label} {f.key === "all" ? `(${queue.length})` : ""}
                </Chip>
              ))}
            </ChipGroup>
          </div>

          {/* Patient Cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filteredQueue.length === 0 ? (
            <ClinicalCard className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No patients in queue</p>
            </ClinicalCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredQueue.map(item => {
                const cfg = STATUS_CHIP[item.status] || { label: item.status, variant: "neutral" as const };
                return (
                  <ClinicalCard key={item.id} className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                            {item.token_number || "–"}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{item.patient_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {[item.patient_age && `${item.patient_age}y`, item.patient_gender].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                        <Chip variant={cfg.variant} size="sm">{cfg.label}</Chip>
                      </div>

                      {item.chief_complaint && (
                        <div className="mb-3">
                          <Chip variant="symptom" size="sm">{item.chief_complaint}</Chip>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Waiting {waitingTime(item.check_in_time)}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border flex gap-2">
                      {item.status === "doctor" ? (
                        <>
                          <Button size="sm" variant="outline" className="flex-1 rounded-lg text-xs" onClick={() =>
                            navigate("/clinical", { state: { queuePatient: { id: item.patient_id, name: item.patient_name, age: item.patient_age, gender: item.patient_gender, phone: item.patient_phone }, visitId: item.id } })
                          }>
                            <Stethoscope className="h-3.5 w-3.5 mr-1" /> Open
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => markComplete(item.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : ["registered", "intake", "triage", "vitals"].includes(item.status) ? (
                        <Button size="sm" className="flex-1 rounded-lg text-xs" onClick={async () => {
                          const { data: result, error } = await supabase.functions.invoke("update-visit-status", { body: { visit_id: item.id, target_status: "with_doctor" } });
                          if (!error && !result?.error) {
                            navigate("/clinical", { state: { queuePatient: { id: item.patient_id, name: item.patient_name, age: item.patient_age, gender: item.patient_gender, phone: item.patient_phone }, visitId: item.id } });
                          }
                        }}>
                          <UserCheck className="h-3.5 w-3.5 mr-1" /> Start Consultation
                        </Button>
                      ) : null}
                    </div>
                  </ClinicalCard>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ Visit Tracker Tab (Kanban) ═══ */}
        <TabsContent value="tracker" className="mt-4">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STATUSES.map((status) => {
              const config = statusConfig[status];
              const statusVisits = kanbanVisits.filter(v => v.status === status);
              return (
                <div key={status} className="min-w-[200px] flex-shrink-0">
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

          {kanbanVisits.length === 0 && !loading && (
            <ClinicalCard className="mt-6 py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No active visits. Register a patient to begin tracking.</p>
            </ClinicalCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
