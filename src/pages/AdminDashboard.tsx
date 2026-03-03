import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  LogOut, Shield, Users, FileText, Activity, ArrowLeft,
  Loader2, CheckCircle, XCircle, Clock, BarChart3, ScrollText
} from "lucide-react";

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("pilots");

  // Pilot requests
  const [pilots, setPilots] = useState<any[]>([]);
  const [loadingPilots, setLoadingPilots] = useState(false);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Safety review
  const [flaggedConsultations, setFlaggedConsultations] = useState<any[]>([]);
  const [loadingFlagged, setLoadingFlagged] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, [user]);

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const admin = data?.some((r: any) => r.role === "admin") || false;
    setIsAdmin(admin);
    if (admin) {
      loadPilots();
      loadUsers();
      loadMetrics();
      loadAuditLogs();
      loadFlaggedConsultations();
    }
  };

  const loadPilots = async () => {
    setLoadingPilots(true);
    const { data } = await supabase.from("pilot_requests" as any).select("*").order("created_at", { ascending: false });
    setPilots((data as any[]) || []);
    setLoadingPilots(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data } = await supabase.from("profiles").select("*, user_roles(role)").order("created_at", { ascending: false });
    setUsers(data || []);
    setLoadingUsers(false);
  };

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const [patientsRes, consultsRes, draftRes] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("consultations").select("id", { count: "exact", head: true }),
        supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "draft"),
      ]);

      // Safety flags frequency
      const { data: flagged } = await supabase.from("consultations")
        .select("confidence_score")
        .not("safety_flags", "eq", "[]");

      const lowConf = flagged?.filter((c: any) => c.confidence_score === "low").length || 0;
      const modConf = flagged?.filter((c: any) => c.confidence_score === "moderate").length || 0;

      setMetrics({
        totalPatients: patientsRes.count || 0,
        totalConsultations: consultsRes.count || 0,
        draftConsultations: draftRes.count || 0,
        flaggedTotal: flagged?.length || 0,
        lowConfidence: lowConf,
        moderateConfidence: modConf,
      });
    } catch {}
    setLoadingMetrics(false);
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    const { data } = await supabase.from("audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(50);
    setAuditLogs((data as any[]) || []);
    setLoadingAudit(false);
  };

  const loadFlaggedConsultations = async () => {
    setLoadingFlagged(true);
    const { data } = await supabase.from("consultations")
      .select("id, chief_complaint, confidence_score, safety_flags, created_at, status")
      .not("safety_flags", "eq", "[]")
      .order("created_at", { ascending: false })
      .limit(20);
    setFlaggedConsultations(data || []);
    setLoadingFlagged(false);
  };

  const updatePilotStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("pilot_requests" as any).update({ status } as any).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    // Log audit
    if (user) {
      await supabase.from("audit_logs" as any).insert({
        event_type: `pilot_${status}`,
        actor_id: user.id,
        target_type: "pilot_request",
        target_id: id,
        metadata: { status },
      } as any);
    }
    toast({ title: "Status updated" });
    loadPilots();
    loadAuditLogs();
  };

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <Shield className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">You do not have admin privileges.</p>
            <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  return (
    <>
      <SEO title="Admin Dashboard — DATAelixAIr" description="Admin control panel" />
      <header className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-border px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-bold text-foreground">Admin Dashboard</h1>
            <Badge variant="outline" className="text-[10px] font-mono">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Activity className="h-4 w-4 mr-1" /> CDSS
            </Button>
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-8 px-4 max-w-6xl mx-auto mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pilots"><FileText className="h-3.5 w-3.5 mr-1" />Pilot Requests</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="metrics"><BarChart3 className="h-3.5 w-3.5 mr-1" />Metrics</TabsTrigger>
            <TabsTrigger value="safety"><Shield className="h-3.5 w-3.5 mr-1" />Safety Review</TabsTrigger>
            <TabsTrigger value="audit"><ScrollText className="h-3.5 w-3.5 mr-1" />Audit Logs</TabsTrigger>
          </TabsList>

          {/* PILOT REQUESTS */}
          <TabsContent value="pilots">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pilot Requests</CardTitle>
                <CardDescription>Review and manage clinic pilot applications.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPilots ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : pilots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No pilot requests yet.</p>
                ) : (
                  <div className="space-y-3">
                    {pilots.map((p: any) => (
                      <div key={p.id} className="p-3 rounded-lg border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{p.clinic_name}</span>
                          {statusBadge(p.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>📍 {p.location}</span>
                          <span>🏥 {p.speciality}</span>
                          <span>👤 {p.contact_name}</span>
                          <span>📧 {p.contact_email}</span>
                          {p.estimated_patient_volume && <span>📊 ~{p.estimated_patient_volume} patients/day</span>}
                        </div>
                        {p.status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => updatePilotStatus(p.id, "approved")}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => updatePilotStatus(p.id, "rejected")}>
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User Management</CardTitle>
                <CardDescription>View registered users and their roles.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUsers ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : users.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No users found.</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u: any) => (
                      <div key={u.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{u.full_name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{u.clinic_name || "No clinic"} • {u.specialization || "N/A"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(u.user_roles as any[])?.map((r: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{r.role}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* METRICS */}
          <TabsContent value="metrics">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {loadingMetrics ? <Loader2 className="h-5 w-5 animate-spin col-span-3 mx-auto" /> : metrics && (
                <>
                  <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-primary">{metrics.totalPatients}</p><p className="text-xs text-muted-foreground mt-1">Total Patients</p></CardContent></Card>
                  <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-primary">{metrics.totalConsultations}</p><p className="text-xs text-muted-foreground mt-1">Total Consultations</p></CardContent></Card>
                  <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-amber-600">{metrics.draftConsultations}</p><p className="text-xs text-muted-foreground mt-1">Draft Sessions</p></CardContent></Card>
                  <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-destructive">{metrics.flaggedTotal}</p><p className="text-xs text-muted-foreground mt-1">Safety Flagged</p></CardContent></Card>
                  <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-destructive">{metrics.lowConfidence}</p><p className="text-xs text-muted-foreground mt-1">Low Confidence</p></CardContent></Card>
                  <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-amber-600">{metrics.moderateConfidence}</p><p className="text-xs text-muted-foreground mt-1">Moderate Confidence</p></CardContent></Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* SAFETY REVIEW */}
          <TabsContent value="safety">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Safety Flag Review</CardTitle>
                <CardDescription>Consultations with safety flags. Admin view only — cannot modify clinical content.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFlagged ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : flaggedConsultations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No flagged consultations.</p>
                ) : (
                  <div className="space-y-2">
                    {flaggedConsultations.map((c: any) => (
                      <div key={c.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{c.chief_complaint || "No complaint"}</span>
                          <Badge variant={c.confidence_score === "low" ? "destructive" : "outline"} className="text-[10px]">
                            {c.confidence_score} confidence
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {Array.isArray(c.safety_flags) ? c.safety_flags.length : 0} flag(s)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT LOGS */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audit Logs</CardTitle>
                <CardDescription>Immutable record of system events.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAudit ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No audit logs yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                    {auditLogs.map((log: any) => (
                      <div key={log.id} className="p-2 rounded border border-border text-xs flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-[9px] mr-2">{log.event_type}</Badge>
                          <span className="text-muted-foreground">{log.target_type} {log.target_id ? `#${log.target_id.substring(0, 8)}` : ""}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
