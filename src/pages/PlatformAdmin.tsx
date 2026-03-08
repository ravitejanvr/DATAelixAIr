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
  Shield, Cpu, Lock, Eye, UserCheck, UserX
} from "lucide-react";
import type { MonitoringDashboardData } from "@/layers/monitoring/api";
import { fetchMonitoringDashboard } from "@/layers/monitoring/api";
import { MODEL_REGISTRY, DATA_ACCESS_MATRIX, ROLE_LABELS } from "@/layers/governance/api";
import type { AppRole } from "@/layers/governance/api";

function UserApprovalCard({ user: u, clinics, onAction }: {
  user: any;
  clinics: any[];
  onAction: (userId: string, action: "approve" | "reject", clinicId?: string) => Promise<void>;
}) {
  const [selectedClinic, setSelectedClinic] = useState<string>("");
  const [acting, setActing] = useState(false);
  const roles = (u.user_roles as any[])?.map((r: any) => r.role) || [];

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">{u.full_name || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{u.phone || "No phone"} · Registered {new Date(u.created_at).toLocaleDateString()}</p>
            <div className="flex gap-1 mt-1">
              {roles.map((r: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[9px]">{r}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={selectedClinic} onValueChange={setSelectedClinic}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Assign clinic…" />
              </SelectTrigger>
              <SelectContent>
                {clinics.filter(c => c.status === "active").map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!selectedClinic || acting}
              onClick={async () => { setActing(true); await onAction(u.user_id, "approve", selectedClinic); setActing(false); }}>
              <UserCheck className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs text-destructive" disabled={acting}
              onClick={async () => { setActing(true); await onAction(u.user_id, "reject"); setActing(false); }}>
              <UserX className="h-3 w-3 mr-1" /> Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type AdminTab = "pilots" | "clinics" | "users" | "governance" | "monitoring" | "audit";

const getTabFromPath = (pathname: string): AdminTab => {
  const tabSegment = pathname.split("/")[2];
  if (tabSegment === "clinics") return "clinics";
  if (tabSegment === "users") return "users";
  if (tabSegment === "governance") return "governance";
  if (tabSegment === "monitoring") return "monitoring";
  if (tabSegment === "audit") return "audit";
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
  const [loading, setLoading] = useState(true);
  const [monitoringData, setMonitoringData] = useState<MonitoringDashboardData | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [governanceAudit, setGovernanceAudit] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => getTabFromPath(location.pathname));

  useEffect(() => { if (user) loadAll(); }, [user]);
  useEffect(() => { setActiveTab(getTabFromPath(location.pathname)); }, [location.pathname]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pilotRes, clinicRes, profileRes, rolesRes, auditRes] = await Promise.all([
        supabase.from("pilot_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("clinics").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      if (pilotRes.error || clinicRes.error || profileRes.error || rolesRes.error || auditRes.error) {
        throw new Error(
          pilotRes.error?.message ||
          clinicRes.error?.message ||
          profileRes.error?.message ||
          rolesRes.error?.message ||
          auditRes.error?.message ||
          "Failed to load admin data"
        );
      }

      const rolesByUserId = new Map<string, { role: string }[]>();
      (rolesRes.data || []).forEach((roleRow: any) => {
        const existing = rolesByUserId.get(roleRow.user_id) || [];
        existing.push({ role: roleRow.role });
        rolesByUserId.set(roleRow.user_id, existing);
      });

      const profilesWithRoles = (profileRes.data || []).map((p: any) => ({
        ...p,
        user_roles: rolesByUserId.get(p.user_id) || [],
      }));

      setPilots(pilotRes.data || []);
      setClinics(clinicRes.data || []);
      setUsers(profilesWithRoles);
      setAuditLogs(auditRes.data || []);
    } catch (error) {
      console.error("Platform admin loadAll error:", error);
      toast({
        title: "Failed to load admin data",
        description: error instanceof Error ? error.message : "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMonitoring = async () => {
    setMonitoringLoading(true);
    try {
      const data = await fetchMonitoringDashboard(30);
      setMonitoringData(data);
    } catch {
      toast({ title: "Failed to load monitoring data", variant: "destructive" });
    } finally {
      setMonitoringLoading(false);
    }
  };

  const loadGovernanceAudit = async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .in("event_type", ["session_completed", "ai_output_edited", "safety_override", "pilot_approved", "pilot_rejected", "clinic_suspended", "role_assigned"])
      .order("created_at", { ascending: false })
      .limit(100);
    setGovernanceAudit(data || []);
  };

  const updatePilotStatus = async (id: string, status: string) => {
    const { data: result, error } = await supabase.functions.invoke("admin-action", {
      body: { action_type: "update_pilot_status", pilot_id: id, status },
    });
    if (error || result?.error) {
      toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" });
      return;
    }
    toast({ title: `Pilot ${status}` });
    loadAll();
  };

  const suspendClinic = async (clinicId: string) => {
    const { data: result, error } = await supabase.functions.invoke("admin-action", {
      body: { action_type: "suspend_clinic", clinic_id: clinicId },
    });
    if (error || result?.error) {
      toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Clinic suspended" });
    loadAll();
  };

  const statusBadge = (status: string) => {
    if (status === "approved" || status === "active") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[10px]">{status}</Badge>;
    if (status === "rejected" || status === "suspended") return <Badge className="bg-destructive/10 text-destructive text-[10px]">{status}</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[10px]">{status}</Badge>;
  };

  // Compute role distribution from users
  const roleCounts: Record<string, number> = {};
  users.forEach((u: any) => {
    (u.user_roles as any[])?.forEach((r: any) => {
      roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
    });
  });

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEO title="Platform Admin — DATAelixAIr" description="Platform administration." />
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1">Platform Administration</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage pilots, clinics, users, governance, and monitor AI performance. No access to clinical data.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Pilot Requests</p><p className="text-2xl font-bold">{pilots.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">{pilots.filter(p => p.status === "pending").length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Active Clinics</p><p className="text-2xl font-bold text-emerald-600">{clinics.filter(c => c.status === "active").length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Registered Users</p><p className="text-2xl font-bold">{users.length}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="pilots">
          <TabsList className="flex-wrap">
            <TabsTrigger value="pilots"><Building2 className="h-3.5 w-3.5 mr-1" /> Pilots</TabsTrigger>
            <TabsTrigger value="clinics"><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Clinics</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="governance" onClick={loadGovernanceAudit}><Shield className="h-3.5 w-3.5 mr-1" /> Governance</TabsTrigger>
            <TabsTrigger value="monitoring" onClick={loadMonitoring}><Activity className="h-3.5 w-3.5 mr-1" /> Monitoring</TabsTrigger>
            <TabsTrigger value="audit"><FileText className="h-3.5 w-3.5 mr-1" /> Audit</TabsTrigger>
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
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updatePilotStatus(p.id, "approved")}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => updatePilotStatus(p.id, "rejected")}>
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pilots.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No pilot requests yet.</p>}
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

          {/* Users Tab — with approval workflow */}
          <TabsContent value="users" className="mt-4">
            <div className="space-y-4">
              {/* Pending approvals first */}
              {users.filter((u: any) => (u as any).account_status === "pending").length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> Pending Approval ({users.filter((u: any) => (u as any).account_status === "pending").length})
                  </h3>
                  <div className="space-y-2">
                    {users.filter((u: any) => (u as any).account_status === "pending").map((u: any) => (
                      <UserApprovalCard key={u.id} user={u} clinics={clinics} onAction={async (userId, action, clinicId) => {
                        const role = (u.user_roles as any[])?.[0]?.role || "staff";
                        const { data: result, error } = await supabase.functions.invoke("approve-user", {
                          body: { target_user_id: userId, action, clinic_id: clinicId, role },
                        });
                        if (error || result?.error) {
                          toast({ title: "Error", description: error?.message || result?.error, variant: "destructive" });
                        } else {
                          toast({
                            title: action === "approve" ? "User approved" : "User rejected",
                            description: action === "approve"
                              ? `${u.full_name} has been approved and assigned to a clinic.`
                              : `${u.full_name}'s registration has been rejected.`,
                          });
                        }
                        loadAll();
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Approved users */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">All Users</h3>
                <div className="space-y-2">
                  {users.filter((u: any) => (u as any).account_status !== "pending").map((u: any) => (
                    <Card key={u.id}>
                      <CardContent className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{u.full_name || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{u.clinic_name || "No clinic"} · {u.specialization || ""}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(u as any).account_status === "approved" && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]">
                              <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Approved
                            </Badge>
                          )}
                          {(u as any).account_status === "rejected" && (
                            <Badge className="bg-destructive/10 text-destructive text-[9px]">
                              <XCircle className="h-2.5 w-2.5 mr-0.5" /> Rejected
                            </Badge>
                          )}
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

          {/* ============ GOVERNANCE TAB ============ */}
          <TabsContent value="governance" className="mt-4 space-y-6">
            {/* Role Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Role Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                    <div key={role} className="border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{ROLE_LABELS[role as AppRole] || role}</p>
                    </div>
                  ))}
                  {Object.keys(roleCounts).length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-4">No roles assigned yet.</p>}
                </div>
              </CardContent>
            </Card>

            {/* Data Access Matrix */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Data Access Matrix (Clinic-Isolated via RLS)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Resource</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Allowed Roles</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Isolation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(DATA_ACCESS_MATRIX).map(([resource, roles]) => (
                        <tr key={resource} className="border-b last:border-0">
                          <td className="py-2 font-medium capitalize">{resource.replace(/_/g, " ")}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {roles.map(r => (
                                <Badge key={r} variant="outline" className="text-[9px]">{ROLE_LABELS[r] || r}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]">
                              <Lock className="h-2.5 w-2.5 mr-0.5" /> clinic_id
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Model Version Registry */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" /> AI Model Version Registry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Agent</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Model</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Provider</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Version</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODEL_REGISTRY.map(m => (
                        <tr key={m.agent} className="border-b last:border-0">
                          <td className="py-2 font-medium">{m.agent}</td>
                          <td className="py-2 text-muted-foreground font-mono text-[10px]">{m.model}</td>
                          <td className="py-2"><Badge variant="outline" className="text-[9px]">{m.provider}</Badge></td>
                          <td className="py-2 text-muted-foreground">{m.version}</td>
                          <td className="py-2 text-muted-foreground">{m.lastUpdated}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Governance Audit Trail */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> AI Output & Doctor Edit Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {governanceAudit.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg border text-xs">
                      <div className="flex items-center gap-2">
                        {log.event_type.includes("edited") ? (
                          <AlertTriangle className="h-3 w-3 text-amber-600 flex-shrink-0" />
                        ) : log.event_type.includes("approved") ? (
                          <CheckCircle className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                        ) : log.event_type.includes("rejected") || log.event_type.includes("suspended") ? (
                          <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                        ) : (
                          <Shield className="h-3 w-3 text-primary flex-shrink-0" />
                        )}
                        <div>
                          <span className="font-medium">{log.event_type.replace(/_/g, " ")}</span>
                          {log.target_type && <span className="text-muted-foreground ml-1.5">· {log.target_type}</span>}
                          {log.metadata?.stage && <Badge variant="outline" className="text-[9px] ml-1.5">{log.metadata.stage}</Badge>}
                          {log.metadata?.model_version && <Badge variant="secondary" className="text-[9px] ml-1">{log.metadata.model_version}</Badge>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {governanceAudit.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No governance events recorded yet. Events appear after clinical sessions are completed.</p>
                  )}
                </div>
                <div className="flex justify-end mt-3">
                  <Button size="sm" variant="outline" onClick={loadGovernanceAudit}>
                    <Shield className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="mt-4 space-y-6">
            {monitoringLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Loading monitoring data...</span>
              </div>
            )}

            {!monitoringLoading && !monitoringData && (
              <div className="text-center py-12">
                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Click the Monitoring tab to load AI performance data.</p>
                <Button size="sm" onClick={loadMonitoring}>Load Monitoring Data</Button>
              </div>
            )}

            {!monitoringLoading && monitoringData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card><CardContent className="pt-4 pb-3 text-center"><Zap className="h-4 w-4 text-primary mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Total Sessions</p><p className="text-xl font-bold">{monitoringData.totalSessions}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><TrendingUp className="h-4 w-4 text-emerald-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">AI Acceptance Rate</p><p className="text-xl font-bold">{monitoringData.aiAcceptanceRate}%</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><Clock className="h-4 w-4 text-blue-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Avg SOAP Time</p><p className="text-xl font-bold">{monitoringData.avgSoapDurationMs > 0 ? `${(monitoringData.avgSoapDurationMs / 1000).toFixed(1)}s` : "—"}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><CheckCircle className="h-4 w-4 text-emerald-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Transcription Conf.</p><p className="text-xl font-bold">{monitoringData.avgTranscriptionConfidence > 0 ? `${monitoringData.avgTranscriptionConfidence}%` : "—"}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Safety Alert Rate</p><p className="text-xl font-bold">{monitoringData.safetyAlertRate}%</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3 text-center"><XCircle className="h-4 w-4 text-destructive mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Error Rate</p><p className="text-xl font-bold">{monitoringData.errorRate}%</p></CardContent></Card>
                </div>

                {monitoringData.agentPerformance.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Agent Performance (Last 30 Days)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-[11px] font-medium text-muted-foreground">Agent</th>
                              <th className="text-right py-2 text-[11px] font-medium text-muted-foreground">Invocations</th>
                              <th className="text-right py-2 text-[11px] font-medium text-muted-foreground">Avg Duration</th>
                              <th className="text-right py-2 text-[11px] font-medium text-muted-foreground">Success Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monitoringData.agentPerformance.map(a => (
                              <tr key={a.agent} className="border-b last:border-0">
                                <td className="py-2 font-medium capitalize">{a.agent.replace(/_/g, " ")}</td>
                                <td className="py-2 text-right text-muted-foreground">{a.count}</td>
                                <td className="py-2 text-right text-muted-foreground">{a.avgDuration > 0 ? `${(a.avgDuration / 1000).toFixed(1)}s` : "—"}</td>
                                <td className="py-2 text-right">
                                  <Badge variant="outline" className={`text-[10px] ${
                                    a.successRate >= 95 ? "text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" :
                                    a.successRate >= 80 ? "text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800" :
                                    "text-destructive border-destructive/20"
                                  }`}>{a.successRate}%</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Events</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                      {monitoringData.recentEvents.map((e, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border text-xs">
                          <div className="flex items-center gap-2">
                            {e.success ? <CheckCircle className="h-3 w-3 text-emerald-600 flex-shrink-0" /> : <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                            <div>
                              <span className="font-medium">{e.event_type.replace(/_/g, " ")}</span>
                              {e.agent_name && <span className="text-muted-foreground ml-1.5">· {e.agent_name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            {e.duration_ms && <span>{(e.duration_ms / 1000).toFixed(1)}s</span>}
                            <span className="text-[10px]">{new Date(e.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                      {monitoringData.recentEvents.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No monitoring events recorded yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={loadMonitoring}><Activity className="h-3 w-3 mr-1" /> Refresh</Button>
                </div>
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
        </Tabs>
      </div>
    </>
  );
}