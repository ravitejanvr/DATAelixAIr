import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  Building2, Users, FileText, Check, X, Loader2, ShieldAlert, Ban,
  Activity, TrendingUp, Clock, AlertTriangle, CheckCircle, XCircle, Zap
} from "lucide-react";
import type { MonitoringDashboardData } from "@/layers/monitoring/api";
import { fetchMonitoringDashboard } from "@/layers/monitoring/api";

export default function PlatformAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pilots, setPilots] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [monitoringData, setMonitoringData] = useState<MonitoringDashboardData | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const [pilotRes, clinicRes, profileRes, auditRes] = await Promise.all([
      supabase.from("pilot_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("clinics").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*, user_roles(role)").order("created_at", { ascending: false }) as any,
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setPilots(pilotRes.data || []);
    setClinics(clinicRes.data || []);
    setUsers(profileRes.data || []);
    setAuditLogs(auditRes.data || []);
    setLoading(false);
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

  const updatePilotStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("pilot_requests").update({ status } as any).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (status === "approved") {
      const pilot = pilots.find(p => p.id === id);
      if (pilot) {
        await supabase.from("clinics").insert({
          name: pilot.clinic_name, location: pilot.location, specialty: pilot.speciality,
          email: pilot.contact_email, phone: pilot.contact_phone || null, status: "active",
        });
      }
    }
    await supabase.from("audit_logs").insert({
      actor_id: user!.id, event_type: `pilot_${status}`,
      target_type: "pilot_request", target_id: id, metadata: { status },
    });
    toast({ title: `Pilot ${status}` });
    loadAll();
  };

  const suspendClinic = async (clinicId: string) => {
    const { error } = await supabase.from("clinics").update({ status: "suspended" } as any).eq("id", clinicId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("audit_logs").insert({
      actor_id: user!.id, event_type: "clinic_suspended",
      target_type: "clinic", target_id: clinicId,
    });
    toast({ title: "Clinic suspended" });
    loadAll();
  };

  const statusBadge = (status: string) => {
    if (status === "approved" || status === "active") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[10px]">{status}</Badge>;
    if (status === "rejected" || status === "suspended") return <Badge className="bg-destructive/10 text-destructive text-[10px]">{status}</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[10px]">{status}</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEO title="Platform Admin — DATAelixAIr" description="Platform administration." />
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1">Platform Administration</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage pilots, clinics, users, and monitor AI performance. No access to clinical data.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Pilot Requests</p><p className="text-2xl font-bold">{pilots.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">{pilots.filter(p => p.status === "pending").length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Active Clinics</p><p className="text-2xl font-bold text-emerald-600">{clinics.filter(c => c.status === "active").length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Registered Users</p><p className="text-2xl font-bold">{users.length}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="pilots">
          <TabsList>
            <TabsTrigger value="pilots"><Building2 className="h-3.5 w-3.5 mr-1" /> Pilots</TabsTrigger>
            <TabsTrigger value="clinics"><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Clinics</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> Users</TabsTrigger>
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

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <div className="space-y-2">
              {users.map((u: any) => (
                <Card key={u.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{u.full_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{u.clinic_name || "No clinic"} · {u.specialization || ""}</p>
                    </div>
                    <div className="flex gap-1">
                      {(u.user_roles as any[])?.map((r: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{r.role}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <Zap className="h-4 w-4 text-primary mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Total Sessions</p>
                      <p className="text-xl font-bold">{monitoringData.totalSessions}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <TrendingUp className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">AI Acceptance Rate</p>
                      <p className="text-xl font-bold">{monitoringData.aiAcceptanceRate}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <Clock className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Avg SOAP Time</p>
                      <p className="text-xl font-bold">{monitoringData.avgSoapDurationMs > 0 ? `${(monitoringData.avgSoapDurationMs / 1000).toFixed(1)}s` : "—"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Transcription Conf.</p>
                      <p className="text-xl font-bold">{monitoringData.avgTranscriptionConfidence > 0 ? `${monitoringData.avgTranscriptionConfidence}%` : "—"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Safety Alert Rate</p>
                      <p className="text-xl font-bold">{monitoringData.safetyAlertRate}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <XCircle className="h-4 w-4 text-destructive mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Error Rate</p>
                      <p className="text-xl font-bold">{monitoringData.errorRate}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Agent Performance Table */}
                {monitoringData.agentPerformance.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Agent Performance (Last 30 Days)</CardTitle>
                    </CardHeader>
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
                                <td className="py-2 text-right text-muted-foreground">
                                  {a.avgDuration > 0 ? `${(a.avgDuration / 1000).toFixed(1)}s` : "—"}
                                </td>
                                <td className="py-2 text-right">
                                  <Badge variant="outline" className={`text-[10px] ${
                                    a.successRate >= 95 ? "text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" :
                                    a.successRate >= 80 ? "text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800" :
                                    "text-destructive border-destructive/20"
                                  }`}>
                                    {a.successRate}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Events */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recent Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                      {monitoringData.recentEvents.map((e, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border text-xs">
                          <div className="flex items-center gap-2">
                            {e.success ? (
                              <CheckCircle className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                            )}
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
                        <p className="text-sm text-muted-foreground text-center py-8">No monitoring events recorded yet. Events will appear after clinical sessions are completed.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={loadMonitoring}>
                    <Activity className="h-3 w-3 mr-1" /> Refresh
                  </Button>
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
