import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ClinicalCard, ClinicalCardHeader, SkeletonCard } from "@/components/ui/clinical-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import SEO from "@/components/SEO";
import ClinicQRCode from "@/components/ClinicQRCode";
import {
  Users, Stethoscope, ClipboardList, Clock, TrendingUp,
  ArrowRight, User, Activity, AlertTriangle, IndianRupee,
  Plus, Pill
} from "lucide-react";

interface DashboardStats {
  totalPatients: number;
  totalConsultations: number;
  draftConsultations: number;
  todayConsultations: number;
  todayRevenue: number;
  queueWaiting: number;
  recentPatients: any[];
  recentConsultations: any[];
  topConditions: { condition: string; count: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0, totalConsultations: 0, draftConsultations: 0,
    todayConsultations: 0, todayRevenue: 0, queueWaiting: 0,
    recentPatients: [], recentConsultations: [], topConditions: [],
  });
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicId, setClinicId] = useState<string | null>(null);

  useEffect(() => { if (user) fetchDashboardData(); }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        { count: patientCount },
        { count: consultationCount },
        { count: draftCount },
        { data: recentPatients },
        { data: recentConsultations },
        { data: profile },
        { count: todayCount },
        { data: todayInvoices },
        { count: queueCount },
      ] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("consultations").select("*, patients(name)").order("created_at", { ascending: false }).limit(8),
        supabase.from("profiles").select("full_name, clinic_name, clinic_id").eq("user_id", user!.id).maybeSingle(),
        supabase.from("consultations").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("invoices").select("total").gte("created_at", today.toISOString()),
        supabase.from("patient_visits").select("*", { count: "exact", head: true }).gte("check_in_time", today.toISOString()).in("status", ["registered", "intake", "triage", "vitals"]),
      ]);

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
        .sort((a, b) => b.count - a.count).slice(0, 5);

      const todayRevenue = (todayInvoices || []).reduce((s: number, inv: any) => s + (Number(inv.total) || 0), 0);

      setStats({
        totalPatients: patientCount || 0,
        totalConsultations: consultationCount || 0,
        draftConsultations: draftCount || 0,
        todayConsultations: todayCount || 0,
        todayRevenue,
        queueWaiting: queueCount || 0,
        recentPatients: recentPatients || [],
        recentConsultations: recentConsultations || [],
        topConditions,
      });
      setProfileName(profile?.full_name || "");
      setClinicName(profile?.clinic_name || "");
      setClinicId(profile?.clinic_id || null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally { setLoading(false); }
  };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  const statCards = [
    { label: "Queue Waiting", value: stats.queueWaiting, icon: Clock, accent: "text-chip-lab-text", bg: "bg-chip-lab", path: "/patient-queue" },
    { label: "Today's Consultations", value: stats.todayConsultations, icon: Stethoscope, accent: "text-primary", bg: "bg-primary/10", path: "/clinical" },
    { label: "Pending Reports", value: stats.draftConsultations, icon: ClipboardList, accent: "text-chip-alert-text", bg: "bg-chip-alert", path: "/patients" },
    { label: "Revenue Today", value: `₹${stats.todayRevenue}`, icon: IndianRupee, accent: "text-chip-medication-text", bg: "bg-chip-medication", path: "/billing" },
  ];

  return (
    <>
      <SEO title="Dashboard — DATAelixAIr" description="Clinical Operating System dashboard" />
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {greeting()}, {profileName ? `Dr. ${profileName.split(" ").pop()}` : "Doctor"} 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {clinicName ? `${clinicName} · ` : ""}Today's clinical overview
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate("/clinical")} className="gap-1.5 rounded-xl">
            <Stethoscope className="h-3.5 w-3.5" /> New Consultation
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/patients")} className="gap-1.5 rounded-xl">
            <Plus className="h-3.5 w-3.5" /> Register Patient
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/patient-queue")} className="gap-1.5 rounded-xl">
            <Users className="h-3.5 w-3.5" /> View Queue
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? (
            [1, 2, 3, 4].map(i => <SkeletonCard key={i} lines={2} />)
          ) : (
            statCards.map(s => (
              <ClinicalCard key={s.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(s.path)}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${s.bg}`}>
                    <s.icon className={`h-5 w-5 ${s.accent}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                </div>
              </ClinicalCard>
            ))
          )}
        </div>

        {/* Main Grid: 2 cols */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Consultations */}
          <div className="lg:col-span-2">
            <ClinicalCard>
              <ClinicalCardHeader
                title="Recent Consultations"
                icon={<Activity className="h-4 w-4" />}
                action={
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/patients")}>
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                }
              />
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : stats.recentConsultations.length === 0 ? (
                <div className="text-center py-10">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No consultations yet</p>
                  <Button size="sm" className="mt-3 rounded-xl" onClick={() => navigate("/clinical")}>Start first consultation</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {stats.recentConsultations.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/consultations/${c.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{(c.patients as any)?.name || "Unknown"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{c.chief_complaint || "No complaint"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Chip variant={c.status === "draft" ? "lab" : "medication"} size="sm">{c.status || "draft"}</Chip>
                        <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ClinicalCard>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Recent Patients */}
            <ClinicalCard>
              <ClinicalCardHeader
                title="Recent Patients"
                icon={<Users className="h-4 w-4" />}
                action={
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/patients")}>
                    All <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                }
              />
              {loading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : stats.recentPatients.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No patients yet</p>
                  <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={() => navigate("/patients")}>
                    <Plus className="h-3 w-3 mr-1" /> Add patient
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {stats.recentPatients.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {p.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {[p.age && `${p.age}y`, p.gender].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {p.allergies?.length > 0 && (
                        <AlertTriangle className="h-3.5 w-3.5 text-chip-alert-text shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ClinicalCard>

            {/* Top Conditions */}
            {stats.topConditions.length > 0 && (
              <ClinicalCard>
                <ClinicalCardHeader title="Top Conditions" icon={<Pill className="h-4 w-4" />} />
                <div className="flex flex-wrap gap-1.5">
                  {stats.topConditions.map((tc, i) => (
                    <Chip key={i} variant="diagnosis" size="sm">
                      {tc.condition} <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{tc.count}</Badge>
                    </Chip>
                  ))}
                </div>
              </ClinicalCard>
            )}

            {/* QR Code */}
            {clinicId && <ClinicQRCode clinicId={clinicId} clinicName={clinicName} />}
          </div>
        </div>
      </div>
    </>
  );
}
