import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  LogOut, Loader2, FileText, Pill, Calendar, Activity,
  User, Clock, ShieldCheck, ChevronRight
} from "lucide-react";
import PatientTrustBanner from "@/components/PatientTrustBanner";

interface PatientRecord {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  blood_group: string | null;
  allergies: string[] | null;
  current_medications: string[] | null;
}

interface ConsultationRecord {
  id: string;
  chief_complaint: string | null;
  ai_summary: string | null;
  status: string | null;
  created_at: string;
  follow_up_date: string | null;
  soap_plan: string | null;
}

interface PrescriptionRecord {
  id: string;
  drug_name: string;
  dosage: string;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  created_at: string;
}

export default function PatientPortal() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);

  useEffect(() => {
    fetchPatientData();
  }, [user]);

  const fetchPatientData = async () => {
    if (!user) return;
    setLoading(true);

    // Get patient record linked to this user
    const { data: patientData } = await supabase
      .from("patients")
      .select("*")
      .eq("patient_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!patientData) {
      setLoading(false);
      return;
    }

    setPatient(patientData);

    // Fetch consultations and prescriptions in parallel
    const [consultsRes, prescRes] = await Promise.all([
      supabase
        .from("consultations")
        .select("id, chief_complaint, ai_summary, status, created_at, follow_up_date, soap_plan")
        .eq("patient_id", patientData.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("prescriptions")
        .select("id, drug_name, dosage, frequency, duration, instructions, created_at")
        .eq("patient_id", patientData.id)
        .order("created_at", { ascending: false }),
    ]);

    setConsultations(consultsRes.data || []);
    setPrescriptions(prescRes.data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO title="My Health Records — DATAelixAIr" description="View your consultations, prescriptions and health records" />

      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={brainLogo} alt="Logo" className="h-8" />
          <div>
            <h1 className="text-sm font-bold text-foreground">My Health Portal</h1>
            <p className="text-xs text-muted-foreground">DATAelixAIr™ Patient Access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {!patient ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <User className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">No Records Found</h3>
              <p className="text-sm text-muted-foreground/80 max-w-md mt-2">
                Your doctor hasn't linked your account yet. Please ask your healthcare provider to connect your patient record.
              </p>
              <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">Your data is protected under HIPAA, UK GDPR & India DPDP standards.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Patient info card */}
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">{patient.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {patient.age && `${patient.age} years`}{patient.gender && ` • ${patient.gender}`}
                      {patient.blood_group && ` • ${patient.blood_group}`}
                    </p>
                  </div>
                </div>
                {patient.allergies && patient.allergies.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-destructive">Allergies:</span>
                    {patient.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                )}
                {patient.current_medications && patient.current_medications.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground">Medications:</span>
                    {patient.current_medications.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <Activity className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">{consultations.length}</p>
                  <p className="text-xs text-muted-foreground">Consultations</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <Pill className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">{prescriptions.length}</p>
                  <p className="text-xs text-muted-foreground">Prescriptions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">
                    {consultations.filter(c => c.follow_up_date && new Date(c.follow_up_date) > new Date()).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </CardContent>
              </Card>
            </div>

            {/* Consultations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> My Consultations
                </CardTitle>
                <CardDescription>View your clinical visit summaries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {consultations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No consultations yet.</p>
                ) : (
                  consultations.map(c => (
                    <div key={c.id} className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {c.chief_complaint || "General Consultation"}
                          </p>
                          {c.ai_summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.ai_summary}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(c.created_at).toLocaleDateString()}</span>
                            {c.follow_up_date && (
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Follow-up: {new Date(c.follow_up_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{c.status || "draft"}</Badge>
                      </div>
                      {c.soap_plan && (
                        <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                          <p className="text-xs font-semibold text-primary">Plan</p>
                          <p className="text-xs text-foreground">{c.soap_plan}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Prescriptions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" /> My Prescriptions
                </CardTitle>
                <CardDescription>View your current and past prescriptions</CardDescription>
              </CardHeader>
              <CardContent>
                {prescriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No prescriptions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {prescriptions.map(p => (
                      <div key={p.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.drug_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.dosage}{p.frequency && ` • ${p.frequency}`}{p.duration && ` • ${p.duration}`}
                          </p>
                          {p.instructions && <p className="text-xs text-muted-foreground mt-0.5 italic">{p.instructions}</p>}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trust & Privacy banner */}
            <PatientTrustBanner />
          </>
        )}
      </main>
    </>
  );
}
