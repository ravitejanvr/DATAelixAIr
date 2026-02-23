import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  Users, Stethoscope, ClipboardList, Pill, Activity, LogOut,
  Plus, ArrowRight, Calendar, Clock, TrendingUp, LayoutDashboard,
  User, FileText
} from "lucide-react";

interface DashboardStats {
  totalPatients: number;
  totalConsultations: number;
  draftConsultations: number;
  recentPatients: any[];
  recentConsultations: any[];
  topConditions: { condition: string; count: number }[];
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalConsultations: 0,
    draftConsultations: 0,
    recentPatients: [],
    recentConsultations: [],
    topConditions: [],
  });
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        { count: patientCount },
        { count: consultationCount },
        { count: draftCount },
        { data: recentPatients },
        { data: recentConsultations },
        { data: profile },
      ] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("consultations").select("*, patients(name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle(),
      ]);

      // Extract top conditions from recent consultations
      const conditionMap: Record<string, number> = {};
      recentConsultations?.forEach((c: any) => {
        if (c.chief_complaint) {
          c.chief_complaint.split(",").forEach((cond: string) => {
            const trimmed = cond.trim();
            if (trimmed) conditionMap[trimmed] = (conditionMap[trimmed] || 0) + 1;
          });
        }
      });
      const topConditions = Object.entries(conditionMap)
        .map(([condition, count]) => ({ condition, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalPatients: patientCount || 0,
        totalConsultations: consultationCount || 0,
        draftConsultations: draftCount || 0,
        recentPatients: recentPatients || [],
        recentConsultations: recentConsultations || [],
        topConditions,
      });
      setProfileName(profile?.full_name || "");
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <>
      <SEO title="CDSS Dashboard — DATAelixAIr" description="Clinical Decision Support System dashboard overview" />

      <header className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-border px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={brainLogo} alt="DATAelixAIr" className="h-8" />
            <div>
              <h1 className="text-sm font-bold text-foreground">DATAelixAIr</h1>
              <p className="text-xs text-muted-foreground">CDSS Dashboard</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono ml-2">PhD Prototype</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/clinical")}>
              <Stethoscope className="h-4 w-4 mr-1" /> CDSS Analysis
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
              <Users className="h-4 w-4 mr-1" /> Patients
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/prescriptions")}>
              <Pill className="h-4 w-4 mr-1" /> Rx
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-8 px-4 max-w-7xl mx-auto">
        {/* Greeting */}
        <div className="mt-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            {greeting()}, {profileName ? `Dr. ${profileName.split(" ").pop()}` : "Doctor"} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Here's your clinical practice overview for today.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Button onClick={() => navigate("/clinical")} className="h-auto py-3 flex-col gap-1" size="lg">
            <Stethoscope className="h-5 w-5" />
            <span className="text-xs">New CDSS Analysis</span>
          </Button>
          <Button onClick={() => navigate("/patients")} variant="outline" className="h-auto py-3 flex-col gap-1" size="lg">
            <Plus className="h-5 w-5" />
            <span className="text-xs">Register Patient</span>
          </Button>
          <Button onClick={() => navigate("/patients")} variant="outline" className="h-auto py-3 flex-col gap-1" size="lg">
            <Users className="h-5 w-5" />
            <span className="text-xs">Patient Records</span>
          </Button>

          <Button onClick={() => navigate("/prescriptions")} variant="outline" className="h-auto py-3 flex-col gap-1" size="lg">
            <Pill className="h-5 w-5" />
            <span className="text-xs">Write Prescription</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Patients</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.totalPatients}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Consultations</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.totalConsultations}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Draft Reports</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.draftConsultations}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Conditions Tracked</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.topConditions.length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Consultations */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Recent Consultations
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/patients")}>
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Loading...</div>
                ) : stats.recentConsultations.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No consultations yet</p>
                    <Button size="sm" className="mt-3" onClick={() => navigate("/clinical")}>
                      Run first analysis
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.recentConsultations.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/consultations/${c.id}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {(c.patients as any)?.name || "Unknown Patient"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.chief_complaint || "No chief complaint"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              c.status === "draft"
                                ? "border-amber-300 text-amber-700 bg-amber-50"
                                : "border-green-300 text-green-700 bg-green-50"
                            }`}
                          >
                            {c.status || "draft"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Recent Patients */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Recent Patients
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/patients")}>
                    All <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
                ) : stats.recentPatients.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No patients yet</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/patients")}>
                      <Plus className="h-3 w-3 mr-1" /> Add first patient
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.recentPatients.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/patients/${p.id}`)}
                      >
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {p.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.age ? `${p.age}y` : ""} {p.gender ? `• ${p.gender}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Conditions */}
            {stats.topConditions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary" /> Top Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.topConditions.map((tc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm truncate">{tc.condition}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{tc.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
