import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Building2, Users, BarChart3, ShieldAlert, FileText, Check, X, Loader2 } from "lucide-react";

export default function PlatformAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pilots, setPilots] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const [pilotRes, profileRes, auditRes] = await Promise.all([
      supabase.from("pilot_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*, user_roles(role)").order("created_at", { ascending: false }) as any,
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setPilots(pilotRes.data || []);
    setUsers(profileRes.data || []);
    setAuditLogs(auditRes.data || []);
    setLoading(false);
  };

  const updatePilotStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("pilot_requests").update({ status } as any).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    // Log audit
    await supabase.from("audit_logs").insert({
      actor_id: user!.id,
      event_type: `pilot_${status}`,
      target_type: "pilot_request",
      target_id: id,
      metadata: { status },
    });
    toast({ title: `Pilot ${status}` });
    loadAll();
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-100 text-green-800 text-[10px]">Approved</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-800 text-[10px]">Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 text-[10px]">Pending</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO title="Platform Admin — DATAelixAIr" description="Platform administration dashboard." />
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1">Platform Administration</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage pilots, users, and platform health. No access to clinical data.</p>

        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Pilot Requests</p>
            <p className="text-2xl font-bold">{pilots.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{pilots.filter(p => p.status === "pending").length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Registered Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Audit Events</p>
            <p className="text-2xl font-bold">{auditLogs.length}</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="pilots">
          <TabsList>
            <TabsTrigger value="pilots"><Building2 className="h-3.5 w-3.5 mr-1" /> Pilots</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="audit"><FileText className="h-3.5 w-3.5 mr-1" /> Audit</TabsTrigger>
          </TabsList>

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
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700" onClick={() => updatePilotStatus(p.id, "approved")}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-700" onClick={() => updatePilotStatus(p.id, "rejected")}>
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
