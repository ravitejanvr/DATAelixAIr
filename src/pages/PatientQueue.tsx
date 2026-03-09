import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader, SkeletonCard } from "@/components/ui/clinical-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PhoneCall, Clock, CheckCircle2, RefreshCw,
  Search, UserCheck, Stethoscope, QrCode, Users,
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

// Kanban columns for the simplified board
const KANBAN_COLUMNS = [
  { key: "waiting", label: "Waiting", statuses: ["registered", "arrived", "intake"], accent: "bg-chip-lab" },
  { key: "triage", label: "In Triage", statuses: ["triage", "vitals"], accent: "bg-chip-symptom" },
  { key: "consultation", label: "In Consultation", statuses: ["doctor"], accent: "bg-primary/80" },
  { key: "completed", label: "Completed", statuses: ["lab", "pharmacy", "billing", "complete"], accent: "bg-chip-medication" },
];

export default function PatientQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

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
      setQueue((data || []).map((v: any) => ({
        id: v.id, token_number: v.token_number, check_in_time: v.check_in_time,
        status: v.status, visit_type: v.visit_type, patient_id: v.patient_id,
        patient_name: v.patients?.name || "Unknown", patient_age: v.patients?.age,
        patient_gender: v.patients?.gender, patient_phone: v.patients?.phone,
        chief_complaint: v.triage?.[0]?.chief_complaint || v.triage?.chief_complaint || null,
      })));
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
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const filteredQueue = queue.filter(q =>
    !search || q.patient_name.toLowerCase().includes(search.toLowerCase()) || String(q.token_number).includes(search)
  );

  const waitingCount = queue.filter(q => ["registered", "intake", "triage", "vitals"].includes(q.status)).length;

  return (
    <div className="p-4 lg:p-6 max-w-full mx-auto space-y-4">
      <SEO title="Patient Queue | DATAelixAIr" description="Clinic patient queue kanban" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Patient Queue</h1>
          <p className="text-xs text-muted-foreground">Today's clinic flow · {queue.length} patients</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs rounded-xl" />
          </div>
          <Button variant="outline" size="sm" className="rounded-xl h-8" onClick={() => setShowQR(!showQR)}>
            <QrCode className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl h-8" onClick={loadQueue} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" className="rounded-xl h-8 gap-1.5" onClick={callNextPatient} disabled={waitingCount === 0}>
            <PhoneCall className="h-3.5 w-3.5" /> Call Next
          </Button>
        </div>
      </div>

      {showQR && clinicId && <div className="max-w-xs"><ClinicQRCode clinicId={clinicId} /></div>}

      {/* Kanban Board */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} lines={4} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {KANBAN_COLUMNS.map(col => {
            const items = filteredQueue.filter(q => col.statuses.includes(q.status));
            return (
              <div key={col.key} className="min-h-[200px]">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.accent}`} />
                  <span className="text-xs font-semibold text-foreground">{col.label}</span>
                  <Badge variant="outline" className="text-[10px] h-5 min-w-[20px] justify-center ml-auto">{items.length}</Badge>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <p className="text-[11px] text-muted-foreground">No patients</p>
                    </div>
                  ) : (
                    items.map(item => (
                      <ClinicalCard key={item.id} className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {item.token_number || "–"}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-foreground leading-tight">{item.patient_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {[item.patient_age && `${item.patient_age}y`, item.patient_gender].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </div>
                        </div>

                        {item.chief_complaint && (
                          <div className="mb-2">
                            <Chip variant="symptom" size="sm">{item.chief_complaint}</Chip>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> {waitingTime(item.check_in_time)}
                          </div>

                          {/* Quick action per column */}
                          {col.key === "waiting" && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 rounded-lg" onClick={async () => {
                              await supabase.functions.invoke("update-visit-status", { body: { visit_id: item.id, target_status: "with_doctor" } });
                              navigate("/clinical", { state: { queuePatient: { id: item.patient_id, name: item.patient_name, age: item.patient_age, gender: item.patient_gender, phone: item.patient_phone }, visitId: item.id } });
                            }}>
                              <UserCheck className="h-3 w-3 mr-1" /> Start
                            </Button>
                          )}
                          {col.key === "triage" && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 rounded-lg" onClick={async () => {
                              await supabase.functions.invoke("update-visit-status", { body: { visit_id: item.id, target_status: "with_doctor" } });
                              navigate("/clinical", { state: { queuePatient: { id: item.patient_id, name: item.patient_name, age: item.patient_age, gender: item.patient_gender, phone: item.patient_phone }, visitId: item.id } });
                            }}>
                              <Stethoscope className="h-3 w-3 mr-1" /> Consult
                            </Button>
                          )}
                          {col.key === "consultation" && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 rounded-lg" onClick={() =>
                              navigate("/clinical", { state: { queuePatient: { id: item.patient_id, name: item.patient_name, age: item.patient_age, gender: item.patient_gender, phone: item.patient_phone }, visitId: item.id } })
                            }>
                              Open
                            </Button>
                          )}
                          {col.key === "completed" && item.status !== "complete" && (
                            <Select value={item.status} onValueChange={(val) => updateStatus(item.id, val)}>
                              <SelectTrigger className="h-6 text-[10px] rounded-lg w-auto min-w-[80px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VISIT_STATUSES.map(s => (
                                  <SelectItem key={s} value={s} className="text-xs">{VISIT_STATUS_CONFIG[s].label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </ClinicalCard>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
