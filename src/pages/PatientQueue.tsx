import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, PhoneCall, Clock, CheckCircle2, Loader2, RefreshCw,
  Search, UserCheck, Stethoscope, QrCode,
} from "lucide-react";
import ClinicQRCode from "@/components/ClinicQRCode";

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

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  registered: { label: "Waiting", variant: "secondary" },
  intake: { label: "Intake", variant: "outline" },
  triage: { label: "Triage", variant: "outline" },
  vitals: { label: "Vitals", variant: "outline" },
  doctor: { label: "In Consultation", variant: "default" },
  lab: { label: "Lab", variant: "outline" },
  pharmacy: { label: "Pharmacy", variant: "outline" },
  billing: { label: "Billing", variant: "outline" },
  complete: { label: "Completed", variant: "secondary" },
};

export default function PatientQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "waiting" | "active" | "complete">("all");
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const loadQueue = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.clinic_id) {
      setLoading(false);
      return;
    }
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
      const mapped: QueueItem[] = (data || []).map((v: any) => ({
        id: v.id,
        token_number: v.token_number,
        check_in_time: v.check_in_time,
        status: v.status,
        visit_type: v.visit_type,
        patient_id: v.patient_id,
        patient_name: v.patients?.name || "Unknown",
        patient_age: v.patients?.age,
        patient_gender: v.patients?.gender,
        patient_phone: v.patients?.phone,
        chief_complaint: v.triage?.[0]?.chief_complaint || v.triage?.chief_complaint || null,
      }));
      setQueue(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadQueue();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_visits" }, () => {
        loadQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const callNextPatient = async () => {
    const waiting = queue.find(
      (q) => q.status === "registered" || q.status === "intake" || q.status === "triage" || q.status === "vitals"
    );
    if (!waiting) {
      toast({ title: "No patients waiting", description: "The queue is empty." });
      return;
    }

    // Update visit status to "doctor"
    const { error } = await supabase
      .from("patient_visits")
      .update({ status: "doctor", assigned_to: user!.id })
      .eq("id", waiting.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `Calling Token #${waiting.token_number}`, description: waiting.patient_name });

    // Navigate to consultation workspace with patient context
    navigate("/clinical", {
      state: {
        queuePatient: {
          id: waiting.patient_id,
          name: waiting.patient_name,
          age: waiting.patient_age,
          gender: waiting.patient_gender,
          phone: waiting.patient_phone,
        },
        visitId: waiting.id,
      },
    });
  };

  const markComplete = async (visitId: string) => {
    const { error } = await supabase
      .from("patient_visits")
      .update({ status: "complete" })
      .eq("id", visitId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      loadQueue();
    }
  };

  const waitingTime = (checkIn: string) => {
    const mins = Math.floor((Date.now() - new Date(checkIn).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const filteredQueue = queue.filter((q) => {
    const matchesSearch =
      !search ||
      q.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      String(q.token_number).includes(search);

    if (!matchesSearch) return false;

    if (filter === "waiting") return ["registered", "intake", "triage", "vitals"].includes(q.status);
    if (filter === "active") return q.status === "doctor";
    if (filter === "complete") return q.status === "complete";
    return true;
  });

  const waitingCount = queue.filter((q) => ["registered", "intake", "triage", "vitals"].includes(q.status)).length;
  const activeCount = queue.filter((q) => q.status === "doctor").length;
  const completedCount = queue.filter((q) => q.status === "complete").length;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <SEO title="Patient Queue | DATAelixAIr" description="Manage clinic patient queue" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Patient Queue</h1>
          <p className="text-sm text-muted-foreground">Today's clinic queue management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)}>
            <QrCode className="h-4 w-4 mr-1" /> QR Code
          </Button>
          <Button variant="outline" size="sm" onClick={loadQueue} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={callNextPatient} disabled={waitingCount === 0}>
            <PhoneCall className="h-4 w-4 mr-1" /> Call Next Patient
          </Button>
        </div>
      </div>

      {/* QR Code panel */}
      {showQR && clinicId && (
        <div className="max-w-xs">
          <ClinicQRCode clinicId={clinicId} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer border-2 transition-colors"
          onClick={() => setFilter("waiting")}
          style={{ borderColor: filter === "waiting" ? "hsl(var(--primary))" : "transparent" }}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{waitingCount}</p>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer border-2 transition-colors"
          onClick={() => setFilter("active")}
          style={{ borderColor: filter === "active" ? "hsl(var(--primary))" : "transparent" }}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">In Consultation</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer border-2 transition-colors"
          onClick={() => setFilter("complete")}
          style={{ borderColor: filter === "complete" ? "hsl(var(--primary))" : "transparent" }}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          All ({queue.length})
        </Button>
      </div>

      {/* Queue table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredQueue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No patients in queue</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Token</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead className="hidden md:table-cell">Complaint</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Wait Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueue.map((item) => {
                const cfg = STATUS_CONFIG[item.status] || { label: item.status, variant: "outline" as const };
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg">
                        {item.token_number || "–"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{item.patient_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[item.patient_age && `${item.patient_age}y`, item.patient_gender].filter(Boolean).join(" · ")}
                          {item.patient_phone && ` · ${item.patient_phone}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground capitalize">{item.visit_type || "Walk-in"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{waitingTime(item.check_in_time)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.status === "doctor" ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate("/clinical", {
                                state: {
                                  queuePatient: {
                                    id: item.patient_id,
                                    name: item.patient_name,
                                    age: item.patient_age,
                                    gender: item.patient_gender,
                                    phone: item.patient_phone,
                                  },
                                  visitId: item.id,
                                },
                              })
                            }
                          >
                            <Stethoscope className="h-3.5 w-3.5 mr-1" /> Open
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => markComplete(item.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : ["registered", "intake", "triage", "vitals"].includes(item.status) ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            supabase
                              .from("patient_visits")
                              .update({ status: "doctor", assigned_to: user!.id })
                              .eq("id", item.id)
                              .then(({ error }) => {
                                if (!error) {
                                  navigate("/clinical", {
                                    state: {
                                      queuePatient: {
                                        id: item.patient_id,
                                        name: item.patient_name,
                                        age: item.patient_age,
                                        gender: item.patient_gender,
                                        phone: item.patient_phone,
                                      },
                                      visitId: item.id,
                                    },
                                  });
                                }
                              });
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" /> Call In
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
