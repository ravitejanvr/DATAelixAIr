import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  ArrowLeft, User, Phone, Mail, Pill, AlertTriangle,
  Calendar, FileText, Stethoscope, Activity, Clock,
  LogOut, Loader2, ChevronRight, BookOpen, Beaker
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  abha_id: string | null;
  current_medications: string[] | null;
  allergies: string[] | null;
  medical_history: Json | null;
  language_preference: string | null;
  created_at: string;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  blood_group: string | null;
  smoking_status: string | null;
  alcohol_use: string | null;
  exercise_frequency: string | null;
  dietary_preference: string | null;
  occupation: string | null;
}

interface Consultation {
  id: string;
  chief_complaint: string | null;
  ai_summary: string | null;
  status: string | null;
  soap_subjective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  created_at: string;
  follow_up_date: string | null;
  tests_ordered: string[] | null;
  report_data: Json | null;
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    const [patientRes, consultRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id!).single(),
      supabase
        .from("consultations")
        .select("id, chief_complaint, ai_summary, status, soap_subjective, soap_assessment, soap_plan, created_at, follow_up_date, tests_ordered")
        .eq("patient_id", id!)
        .order("created_at", { ascending: false }),
    ]);

    if (patientRes.error) {
      toast({ title: "Patient not found", description: patientRes.error.message, variant: "destructive" });
      navigate("/patients");
      return;
    }
    setPatient(patientRes.data);
    setConsultations(consultRes.data || []);
    setLoading(false);
  };

  const statusColor: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    shared: "bg-purple-100 text-purple-800 border-purple-200",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) return null;

  return (
    <>
      <SEO title={`${patient.name} — DATAelixAIr`} description="Patient details and consultation history" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={brainLogo} alt="Logo" className="h-8" />
          <div>
            <h1 className="text-sm font-bold text-foreground">DATAelixAIr CDSS</h1>
            <p className="text-xs text-muted-foreground">Clinical Decision Support System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/clinical")}>
            <Stethoscope className="h-4 w-4 mr-1" /> CDSS Analysis
          </Button>
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Back + title */}
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/patients")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Patients
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Info Card */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{patient.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {patient.age && `${patient.age}y`} {patient.gender && `• ${patient.gender}`}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact */}
              {(patient.phone || patient.email) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h4>
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {patient.phone}
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {patient.email}
                    </div>
                  )}
                </div>
              )}

              {/* IDs */}
              {patient.abha_id && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">ABHA ID</h4>
                  <p className="text-sm font-mono">{patient.abha_id}</p>
                </div>
              )}

              {/* Medications */}
              {patient.current_medications && patient.current_medications.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Pill className="h-3 w-3" /> Current Medications
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {patient.current_medications.map((med, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{med}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergies */}
              {patient.allergies && patient.allergies.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" /> Allergies
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Vitals & Lifestyle */}
              {(patient.height_cm || patient.weight_kg || patient.blood_group) && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vitals</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {patient.height_cm && <span>Height: {patient.height_cm} cm</span>}
                    {patient.weight_kg && <span>Weight: {patient.weight_kg} kg</span>}
                    {patient.bmi && <span>BMI: {patient.bmi}</span>}
                    {patient.blood_group && <span>Blood: {patient.blood_group}</span>}
                  </div>
                </div>
              )}

              {(patient.smoking_status !== "unknown" || patient.alcohol_use !== "unknown" || patient.exercise_frequency !== "unknown") && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lifestyle</h4>
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {patient.smoking_status && patient.smoking_status !== "unknown" && (
                      <span>Smoking: <Badge variant="outline" className="text-[10px] ml-1">{patient.smoking_status}</Badge></span>
                    )}
                    {patient.alcohol_use && patient.alcohol_use !== "unknown" && (
                      <span>Alcohol: <Badge variant="outline" className="text-[10px] ml-1">{patient.alcohol_use}</Badge></span>
                    )}
                    {patient.exercise_frequency && patient.exercise_frequency !== "unknown" && (
                      <span>Exercise: <Badge variant="outline" className="text-[10px] ml-1">{patient.exercise_frequency}</Badge></span>
                    )}
                    {patient.dietary_preference && <span>Diet: {patient.dietary_preference}</span>}
                    {patient.occupation && <span>Occupation: {patient.occupation}</span>}
                  </div>
                </div>
              )}

              {/* Registered */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Registered {new Date(patient.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Run analysis button */}
              <Button className="w-full mt-2" onClick={() => navigate("/clinical", { state: { patient } })}>
                <Stethoscope className="h-4 w-4 mr-1" /> Clinical Insights
              </Button>
            </CardContent>
          </Card>

          {/* Consultation History / EHR Timeline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Consultation History
              </h3>
              <p className="text-sm text-muted-foreground">{consultations.length} consultations</p>
            </div>

            {consultations.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-lg font-medium text-foreground">No consultations yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Run a clinical analysis to create the first consultation record
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {consultations.map((c, idx) => {
                    const reportData = c.report_data as any;
                    return (
                    <div key={c.id} className="relative pl-12">
                      {/* Timeline dot */}
                      <div className={`absolute left-3.5 top-4 h-3 w-3 rounded-full border-2 border-card ${
                        c.status === "completed" ? "bg-green-500" :
                        c.status === "in_progress" ? "bg-blue-500" :
                        "bg-yellow-500"
                      }`} />

                      <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/consultations/${c.id}`)}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-foreground">
                                  {c.chief_complaint || "Clinical Assessment"}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                                  statusColor[c.status || "draft"] || statusColor.draft
                                }`}>
                                  {c.status || "draft"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(c.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2"
                              onClick={(e) => { e.stopPropagation(); navigate(`/prescriptions?consultation=${c.id}&patient=${patient.id}`); }}
                            >
                              <Pill className="h-3 w-3 mr-1" /> Rx
                            </Button>
                          </div>

                          {/* Structured Preview */}
                          <div className="space-y-2 text-sm">
                            {/* Diagnosis */}
                            {(reportData?.consultation?.diagnosis || c.soap_assessment) && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-muted-foreground min-w-[80px]">Diagnosis:</span>
                                <span className="text-foreground line-clamp-1">
                                  {reportData?.consultation?.diagnosis || c.soap_assessment}
                                </span>
                              </div>
                            )}

                            {/* Prescriptions */}
                            {reportData?.prescriptions && reportData.prescriptions.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-muted-foreground min-w-[80px]">Rx:</span>
                                <div className="flex flex-wrap gap-1">
                                  {reportData.prescriptions.slice(0, 2).map((rx: any, i: number) => (
                                    <Badge key={i} variant="outline" className="text-[10px]">
                                      {rx.drug_name}
                                    </Badge>
                                  ))}
                                  {c.report_data.prescriptions.length > 2 && (
                                    <Badge variant="outline" className="text-[10px]">
                                      +{c.report_data.prescriptions.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Lab Orders */}
                            {(c.report_data?.lab_orders && c.report_data.lab_orders.length > 0) || (c.tests_ordered && c.tests_ordered.length > 0) && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-muted-foreground min-w-[80px]">Tests:</span>
                                <div className="flex flex-wrap gap-1">
                                  {(c.report_data?.lab_orders || c.tests_ordered || []).slice(0, 2).map((test: any, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-[10px]">
                                      <Beaker className="h-2.5 w-2.5 mr-0.5" />
                                      {typeof test === 'string' ? test : test.test_name}
                                    </Badge>
                                  ))}
                                  {(c.report_data?.lab_orders || c.tests_ordered || []).length > 2 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      +{(c.report_data?.lab_orders || c.tests_ordered || []).length - 2}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Follow-up */}
                            {(c.follow_up_date || c.report_data?.consultation?.follow_up_date) && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-muted-foreground min-w-[80px]">Follow-up:</span>
                                <span className="text-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(c.report_data?.consultation?.follow_up_date || c.follow_up_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
