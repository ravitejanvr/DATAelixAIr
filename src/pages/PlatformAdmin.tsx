import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  Building2, Users, FileText, Check, X, Loader2, ShieldAlert, Ban,
  Activity, TrendingUp, Clock, AlertTriangle, CheckCircle, XCircle, Zap,
  Shield, Cpu, Lock, Eye, UserCheck, UserX, MessageSquare, Flag,
  BarChart3, Mail, Phone, MapPin, BookOpen, Lightbulb
} from "lucide-react";
import AdminArticleEditor from "@/components/blog/AdminArticleEditor";
import InnovationDashboard from "@/components/admin/InnovationDashboard";
import TerminologyAdmin from "@/pages/TerminologyAdmin";
import type { MonitoringDashboardData } from "@/layers/monitoring/api";
import { fetchMonitoringDashboard } from "@/layers/monitoring/api";
import { MODEL_REGISTRY, DATA_ACCESS_MATRIX, ROLE_LABELS } from "@/layers/governance/api";
import type { AppRole } from "@/layers/governance/api";

function UserApprovalCard({ user: u, clinics, onAction }: {
  user: any;
  clinics: any[];
  onAction: (userId: string, action: "approve" | "reject" | "request_info", clinicId?: string) => Promise<void>;
}) {
  const [selectedClinic, setSelectedClinic] = useState<string>("");
  const [acting, setActing] = useState(false);
  const roles = (u.user_roles as any[])?.map((r: any) => r.role) || [];
  const trustScore = u.trust_score || 0;
  const emailDomainType = u.email_domain_type || "personal";
  const verificationStatus = u.verification_status || "unverified";

  const trustColor = trustScore >= 60 ? "text-emerald-600" : trustScore >= 30 ? "text-amber-600" : "text-destructive";

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{u.full_name || "—"}</p>
              {/* Trust score badge */}
              <span className={`text-[10px] font-bold ${trustColor}`}>
                {trustScore}/100
              </span>
              <Badge variant="outline" className="text-[8px]">{verificationStatus}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> {u.email || "—"}</span>
              <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {u.phone || "—"}</span>
              {u.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {u.city}</span>}
              {u.license_number && <span className="flex items-center gap-0.5"><FileText className="h-2.5 w-2.5" /> {u.license_number}</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {roles.map((r: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[9px]">{r}</Badge>
              ))}
              {emailDomainType === "institutional" && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[8px]">Institutional Email</Badge>
              )}
              {emailDomainType === "personal" && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-[8px]">Personal Email</Badge>
              )}
            </div>
            {/* Risk flags */}
            {u._riskFlags && u._riskFlags.length > 0 && (
              <div className="flex gap-1 mt-1">
                {u._riskFlags.map((f: any, i: number) => (
                  <Badge key={i} className="bg-destructive/10 text-destructive text-[8px] gap-0.5">
                    <Flag className="h-2 w-2" /> {f.flag_type.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Registered {new Date(u.created_at).toLocaleDateString()} · {u.clinic_name || "No clinic specified"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Select value={selectedClinic} onValueChange={setSelectedClinic}>
              <SelectTrigger className="h-7 text-[10px] w-[140px]">
                <SelectValue placeholder="Assign clinic…" />
              </SelectTrigger>
              <SelectContent>
                {clinics.filter(c => c.status === "active").map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={!selectedClinic || acting}
              onClick={async () => { setActing(true); await onAction(u.user_id, "approve", selectedClinic); setActing(false); }}>
              <UserCheck className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive" disabled={acting}
              onClick={async () => { setActing(true); await onAction(u.user_id, "reject"); setActing(false); }}>
              <UserX className="h-3 w-3 mr-1" /> Reject
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground" disabled={acting}
              onClick={async () => { setActing(true); await onAction(u.user_id, "request_info"); setActing(false); }}>
              <MessageSquare className="h-3 w-3 mr-1" /> Request Info
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type AdminTab = "pilots" | "clinics" | "users" | "governance" | "monitoring" | "audit" | "safety" | "articles" | "innovation" | "terminology";

const getTabFromPath = (pathname: string): AdminTab => {
  const tabSegment = pathname.split("/")[2];
  if (tabSegment === "clinics") return "clinics";
  if (tabSegment === "users") return "users";
  if (tabSegment === "governance") return "governance";
  if (tabSegment === "monitoring") return "monitoring";
  if (tabSegment === "audit") return "audit";
  if (tabSegment === "safety") return "safety";
  if (tabSegment === "articles") return "articles";
  if (tabSegment === "innovation") return "innovation";
  if (tabSegment === "terminology") return "terminology";
  return "pilots";
};

const getPathFromTab = (tab: AdminTab): string => (
  tab === "pilots" ? "/platform-admin" : `/platform-admin/${tab}`
);

export default function PlatformAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [pilots, setPilots] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [monitoringData, setMonitoringData] = useState<MonitoringDashboardData | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [governanceAudit, setGovernanceAudit] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => getTabFromPath(location.pathname));
  const [smsConfigured, setSmsConfigured] = useState<boolean | null>(null);

  useEffect(() => { if (user) { loadAll(); checkSmsConfig(); } }, [user]);
  useEffect(() => { setActiveTab(getTabFromPath(location.pathname)); }, [location.pathname]);

  const checkSmsConfig = async () => {
    // Check if any SMS notifications were sent in mock mode
    const { data } = await supabase
      .from("notification_logs")
      .select("delivery_status")
      .eq("delivery_status", "mock_delivered")
      .limit(1);
    // If mock deliveries exist OR no SMS logs at all, SMS may not be configured
    const { data: anyLogs } = await supabase
      .from("notification_logs")
      .select("id")
      .eq("message_type", "sms")
      .eq("delivery_status", "delivered")
      .limit(1);
    setSmsConfigured(anyLogs && anyLogs.length > 0);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pilotRes, clinicRes, profileRes, rolesRes, auditRes, flagsRes] = await Promise.all([
        supabase.from("pilot_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("clinics").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("risk_flags").select("*").eq("resolved", false).order("created_at", { ascending: false }),
      ]);

      if (pilotRes.error || clinicRes.error || profileRes.error || rolesRes.error || auditRes.error) {
        throw new Error("Failed to load admin data");
      }

      const rolesByUserId = new Map<string, { role: string }[]>();
      (rolesRes.data || []).forEach((roleRow: any) => {
        const existing = rolesByUserId.get(roleRow.user_id) || [];
        existing.push({ role: roleRow.role });
        rolesByUserId.set(roleRow.user_id, existing);
      });

      // Group risk flags by user
      const flagsByUser = new Map<string, any[]>();
      (flagsRes.data || []).forEach((f: any) => {
        const existing = flagsByUser.get(f.user_id) || [];
        existing.push(f);
        flagsByUser.set(f.user_id, existing);
      });

      const profilesWithRoles = (profileRes.data || []).map((p: any) => ({
        ...p,
        user_roles: rolesByUserId.get(p.user_id) || [],
        _riskFlags: flagsByUser.get(p.user_id) || [],
      }));

      setPilots(pilotRes.data || []);
      setClinics(clinicRes.data || []);
      setUsers(profilesWithRoles);
      setAuditLogs(auditRes.data || []);
      setRiskFlags(flagsRes.data || []);
    } catch (error) {
      console.error("Platform admin loadAll error:", error);
      toast({ title: "Failed to load admin data", description: error instanceof Error ? error.message : "Please refresh.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMonitoring = async () => {
    setMonitoringLoading(true);
    try { const data = await fetchMonitoringDashboard(30); setMonitoringData(data); }
    catch { toast({ title: "Failed to load monitoring data", variant: "destructive" }); }
    finally { setMonitoringLoading(false); }
  };

  const loadGovernanceAudit = async () => {
    const { data } = await supabase
      .from("audit_logs").select("*")
      .in("event_type", ["session_completed", "ai_output_edited", "safety_override", "pilot_approved", "pilot_rejected", "clinic_suspended", "role_assigned", "trust_score_computed"])
      .order("created_at", { ascending: false }).limit(100);
    setGovernanceAudit(data || []);
  };

  const handleTabChange = (tabValue: string) => {
    const nextTab = tabValue as AdminTab;
    setActiveTab(nextTab);
    navigate(getPathFromTab(nextTab));
    if (nextTab === "monitoring" && !monitoringData && !monitoringLoading) loadMonitoring();
    if (nextTab === "governance" && governanceAudit.length === 0) loadGovernanceAudit();
  };

  const updatePilotStatus = async (id: string, status: string) => {
    const { data: result, error } = await supabase.functions.invoke("admin-action", { body: { action_type: "update_pilot_status", pilot_id: id, status } });
    if (error || result?.error) { toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" }); return; }
    toast({ title: `Pilot ${status}` }); loadAll();
  };

  const suspendClinic = async (clinicId: string) => {
    const { data: result, error } = await supabase.functions.invoke("admin-action", { body: { action_type: "suspend_clinic", clinic_id: clinicId } });
    if (error || result?.error) { toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" }); return; }
    toast({ title: "Clinic suspended" }); loadAll();
  };

  const handleUserAction = async (userId: string, action: "approve" | "reject" | "request_info", clinicId?: string) => {
    const u = users.find((u: any) => u.user_id === userId);
    if (action === "request_info") {
      toast({ title: "Info requested", description: `A request for more information has been noted for ${u?.full_name || "this user"}.` });
      // Log audit event
      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        event_type: "info_requested",
        target_type: "profile",
        target_id: userId,
        metadata: { user_name: u?.full_name },
      });
      return;
    }

    const role = (u?.user_roles as any[])?.[0]?.role || "staff";
    const { data: result, error } = await supabase.functions.invoke("approve-user", {
      body: { target_user_id: userId, action, clinic_id: clinicId, role },
    });
    if (error || result?.error) {
      toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" });
    } else {
      toast({
        title: action === "approve" ? "User approved" : "User rejected",
        description: action === "approve" ? `${u?.full_name} approved and assigned to clinic.` : `${u?.full_name}'s registration rejected.`,
      });
    }
    loadAll();
  };

  const statusBadge = (status: string) => {
    if (status === "approved" || status === "active") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[10px]">{status}</Badge>;
    if (status === "rejected" || status === "suspended") return <Badge className="bg-destructive/10 text-destructive text-[10px]">{status}</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[10px]">{status}</Badge>;
  };

  const roleCounts: Record<string, number> = {};
  users.forEach((u: any) => {
    (u.user_roles as any[])?.forEach((r: any) => { roleCounts[r.role] = (roleCounts[r.role] || 0) + 1; });
  });

  const pendingUsers = users.filter((u: any) => u.account_status === "pending");
  const nonPendingUsers = users.filter((u: any) => u.account_status !== "pending");
  const flaggedUsers = users.filter((u: any) => u._riskFlags?.length > 0);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEO title="Platform Admin — DATAelixAIr" description="Platform administration." />
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1">Platform Administration</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage pilots, clinics, users, safety, and governance.</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Pilot Requests</p><p className="text-2xl font-bold">{pilots.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Pending Users</p><p className="text-2xl font-bold text-amber-600">{pendingUsers.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Active Clinics</p><p className="text-2xl font-bold text-emerald-600">{clinics.filter(c => c.status === "active").length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Risk Flags</p><p className="text-2xl font-bold text-destructive">{riskFlags.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">All Users</p><p className="text-2xl font-bold">{users.length}</p></CardContent></Card>
        </div>

        {/* SMS Configuration Warning */}
        {smsConfigured === false && (
          <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 mb-6">
            <CardContent className="py-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">SMS Delivery Not Configured</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Patient reports are being delivered in mock mode. Configure SMS_API_KEY in backend secrets to enable real SMS delivery.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="pilots"><Building2 className="h-3.5 w-3.5 mr-1" /> Pilots</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> Users {pendingUsers.length > 0 && <Badge className="ml-1 text-[8px] bg-amber-500 text-white">{pendingUsers.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="clinics"><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Clinics</TabsTrigger>
            <TabsTrigger value="safety"><Flag className="h-3.5 w-3.5 mr-1" /> Risk Flags {riskFlags.length > 0 && <Badge className="ml-1 text-[8px] bg-destructive text-white">{riskFlags.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="governance"><Shield className="h-3.5 w-3.5 mr-1" /> Governance</TabsTrigger>
            <TabsTrigger value="monitoring"><Activity className="h-3.5 w-3.5 mr-1" /> Monitoring</TabsTrigger>
            <TabsTrigger value="audit"><FileText className="h-3.5 w-3.5 mr-1" /> Audit</TabsTrigger>
            <TabsTrigger value="articles"><BookOpen className="h-3.5 w-3.5 mr-1" /> Articles</TabsTrigger>
            <TabsTrigger value="innovation"><Lightbulb className="h-3.5 w-3.5 mr-1" /> Innovation</TabsTrigger>
            <TabsTrigger value="terminology"><Database className="h-3.5 w-3.5 mr-1" /> Terminology</TabsTrigger>
          </TabsList>

          {/* Pilots Tab */}
          <TabsContent value="pilots" className="mt-4">
            <div className="space-y-3">
              {pilots.map(p => (
                <Card key={p.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.clinic_name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.location} · {p.speciality} · {p.estimated_patient_volume} patients/day</p>
                      <p className="text-[11px] text-muted-foreground">{p.contact_name} · {p.contact_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(p.status)}
                      {p.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updatePilotStatus(p.id, "approved")}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => updatePilotStatus(p.id, "rejected")}><X className="h-3 w-3 mr-1" /> Reject</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pilots.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No pilot requests yet.</p>}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <div className="space-y-4">
              {/* Flagged users first */}
              {flaggedUsers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1.5">
                    <Flag className="h-4 w-4" /> Flagged Users ({flaggedUsers.length})
                  </h3>
                  <div className="space-y-2">
                    {flaggedUsers.filter(u => u.account_status === "pending").map((u: any) => (
                      <UserApprovalCard key={u.id} user={u} clinics={clinics} onAction={handleUserAction} />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending approvals */}
              {pendingUsers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> Pending Approval ({pendingUsers.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingUsers.filter(u => !u._riskFlags?.length).map((u: any) => (
                      <UserApprovalCard key={u.id} user={u} clinics={clinics} onAction={handleUserAction} />
                    ))}
                  </div>
                </div>
              )}
              {pendingUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">No pending approval requests.</p>
              )}

              {/* All users */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">All Users</h3>
                <div className="space-y-2">
                  {nonPendingUsers.map((u: any) => (
                    <Card key={u.id}>
                      <CardContent className="py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{u.full_name || "—"}</p>
                            <span className={`text-[10px] font-bold ${(u.trust_score || 0) >= 60 ? "text-emerald-600" : (u.trust_score || 0) >= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {u.trust_score || 0}/100
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{u.email || "—"} · {u.phone || "—"} · {u.city || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {u.account_status === "approved" && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]"><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Approved</Badge>}
                          {u.account_status === "rejected" && <Badge className="bg-destructive/10 text-destructive text-[9px]"><XCircle className="h-2.5 w-2.5 mr-0.5" /> Rejected</Badge>}
                          {(u.user_roles as any[])?.map((r: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{r.role}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Clinics Tab */}
          <TabsContent value="clinics" className="mt-4">
            <div className="space-y-3">
              {clinics.map(c => (
                <Card key={c.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.location || "—"} · {c.specialty || "General"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(c.status)}
                      {c.status === "active" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => suspendClinic(c.id)}>
                          <Ban className="h-3 w-3 mr-1" /> Suspend
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {clinics.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No clinics yet.</p>}
            </div>
          </TabsContent>

          {/* Safety / Risk Flags Tab */}
          <TabsContent value="safety" className="mt-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Flag className="h-4 w-4 text-destructive" /> Active Risk Flags
              </h3>
              {riskFlags.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No active risk flags. The system is monitoring for suspicious patterns.</p>}
              {riskFlags.map((flag: any) => {
                const flagUser = users.find((u: any) => u.user_id === flag.user_id);
                return (
                  <Card key={flag.id} className={flag.severity === "critical" ? "border-destructive/50" : "border-amber-200 dark:border-amber-800"}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={flag.severity === "critical" ? "bg-destructive text-white text-[9px]" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[9px]"}>
                              {flag.severity}
                            </Badge>
                            <span className="text-sm font-medium">{flag.flag_type.replace(/_/g, " ")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            User: {flagUser?.full_name || flag.user_id.slice(0, 8)} · {new Date(flag.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                          onClick={async () => {
                            await supabase.from("risk_flags").update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: user!.id }).eq("id", flag.id);
                            toast({ title: "Flag resolved" });
                            loadAll();
                          }}>
                          <Check className="h-3 w-3 mr-1" /> Resolve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Governance Tab */}
          <TabsContent value="governance" className="mt-4 space-y-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Role Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                    <div key={role} className="border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{ROLE_LABELS[role as AppRole] || role}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Data Access Matrix</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Resource</th><th className="text-left py-2 font-medium text-muted-foreground">Allowed Roles</th><th className="text-center py-2 font-medium text-muted-foreground">Isolation</th></tr></thead>
                    <tbody>
                      {Object.entries(DATA_ACCESS_MATRIX).map(([resource, roles]) => (
                        <tr key={resource} className="border-b last:border-0">
                          <td className="py-2 font-medium capitalize">{resource.replace(/_/g, " ")}</td>
                          <td className="py-2"><div className="flex flex-wrap gap-1">{roles.map(r => <Badge key={r} variant="outline" className="text-[9px]">{ROLE_LABELS[r] || r}</Badge>)}</div></td>
                          <td className="py-2 text-center"><Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]"><Lock className="h-2.5 w-2.5 mr-0.5" /> clinic_id</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" /> AI Model Registry</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Agent</th><th className="text-left py-2 font-medium text-muted-foreground">Model</th><th className="text-left py-2 font-medium text-muted-foreground">Provider</th><th className="text-left py-2 font-medium text-muted-foreground">Version</th></tr></thead>
                    <tbody>
                      {MODEL_REGISTRY.map(m => (
                        <tr key={m.agent} className="border-b last:border-0">
                          <td className="py-2 font-medium">{m.agent}</td>
                          <td className="py-2 text-muted-foreground font-mono text-[10px]">{m.model}</td>
                          <td className="py-2"><Badge variant="outline" className="text-[9px]">{m.provider}</Badge></td>
                          <td className="py-2 text-muted-foreground">{m.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> AI Governance Audit Trail</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {governanceAudit.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg border text-xs">
                      <div className="flex items-center gap-2">
                        {log.event_type.includes("edited") ? <AlertTriangle className="h-3 w-3 text-amber-600 flex-shrink-0" /> :
                         log.event_type.includes("approved") ? <CheckCircle className="h-3 w-3 text-emerald-600 flex-shrink-0" /> :
                         log.event_type.includes("trust") ? <BarChart3 className="h-3 w-3 text-primary flex-shrink-0" /> :
                         <Shield className="h-3 w-3 text-primary flex-shrink-0" />}
                        <div>
                          <span className="font-medium">{log.event_type.replace(/_/g, " ")}</span>
                          {log.metadata?.score !== undefined && <Badge variant="secondary" className="text-[9px] ml-1.5">Score: {log.metadata.score}</Badge>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {governanceAudit.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No governance events yet.</p>}
                </div>
                <div className="flex justify-end mt-3">
                  <Button size="sm" variant="outline" onClick={loadGovernanceAudit}><Shield className="h-3 w-3 mr-1" /> Refresh</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="mt-4 space-y-6">
            {monitoringLoading && <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /><span className="text-sm text-muted-foreground">Loading...</span></div>}
            {!monitoringLoading && !monitoringData && (
              <div className="text-center py-12">
                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <Button size="sm" onClick={loadMonitoring}>Load Monitoring Data</Button>
              </div>
            )}
            {!monitoringLoading && monitoringData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card><CardContent className="pt-4 pb-3 text-center"><Zap className="h-4 w-4 text-primary mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Sessions</p><p className="text-xl font-bold">{monitoringData.totalSessions}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><TrendingUp className="h-4 w-4 text-emerald-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">AI Accept Rate</p><p className="text-xl font-bold">{monitoringData.aiAcceptanceRate}%</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><Clock className="h-4 w-4 text-blue-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Avg SOAP</p><p className="text-xl font-bold">{monitoringData.avgSoapDurationMs > 0 ? `${(monitoringData.avgSoapDurationMs / 1000).toFixed(1)}s` : "—"}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><CheckCircle className="h-4 w-4 text-emerald-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Transcription</p><p className="text-xl font-bold">{monitoringData.avgTranscriptionConfidence > 0 ? `${monitoringData.avgTranscriptionConfidence}%` : "—"}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Safety Alerts</p><p className="text-xl font-bold">{monitoringData.safetyAlertRate}%</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><XCircle className="h-4 w-4 text-destructive mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Error Rate</p><p className="text-xl font-bold">{monitoringData.errorRate}%</p></CardContent></Card>
                </div>
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={loadMonitoring}><Activity className="h-3 w-3 mr-1" /> Refresh</Button></div>
              </>
            )}
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="mt-4">
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div>
                    <p className="font-medium">{log.event_type}</p>
                    <p className="text-[10px] text-muted-foreground">{log.target_type} · {log.target_id?.slice(0, 8)}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
              {auditLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No audit events yet.</p>}
            </div>
          </TabsContent>

          {/* Articles Tab */}
          <TabsContent value="articles" className="mt-4">
            <AdminArticleEditor />
          </TabsContent>

          {/* Innovation Tab */}
          <TabsContent value="innovation" className="mt-4">
            <InnovationDashboard />
          </TabsContent>

          {/* Terminology Tab */}
          <TabsContent value="terminology" className="mt-4">
            <TerminologyAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
