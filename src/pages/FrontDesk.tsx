import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, FileText, CreditCard, Send, Loader2, Pill,
  FlaskConical, Building2, TestTube, Printer, Download,
  CheckCircle, Clock, User, Phone, Languages, Eye,
  RefreshCw, ChevronRight, Mail, MessageSquare
} from "lucide-react";

interface FrontDeskConsultation {
  id: string;
  patient_id: string;
  clinic_id: string;
  visit_id: string | null;
  chief_complaint: string;
  soap_assessment: string;
  soap_plan: string;
  status: string;
  created_at: string;
  doctor_id: string;
  patients: { name: string; age: number | null; gender: string | null; phone: string | null } | null;
}

interface InvoiceData {
  id: string;
  invoice_number: string | null;
  total: number | null;
  status: string | null;
  payment_mode: string | null;
  consultation_fee: number | null;
  discount: number | null;
  lab_charges: any;
}

export default function FrontDesk() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [consultations, setConsultations] = useState<FrontDeskConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<FrontDeskConsultation | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("queue");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.clinic_id) {
        setClinicId(data.clinic_id);
        fetchConsultations(data.clinic_id);
      }
    });
  }, [user]);

  const fetchConsultations = async (cId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("consultations")
      .select("id, patient_id, clinic_id, visit_id, chief_complaint, soap_assessment, soap_plan, status, created_at, doctor_id, patients(name, age, gender, phone)")
      .eq("clinic_id", cId)
      .in("status", ["awaiting_frontdesk", "report_generated", "complete"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setConsultations(data as any);
    setLoading(false);
  };

  const selectConsultation = async (c: FrontDeskConsultation) => {
    setSelectedConsultation(c);
    setActiveTab("detail");
    // Fetch related data in parallel
    const [rxRes, labRes, invRes] = await Promise.all([
      supabase.from("prescriptions").select("*").eq("consultation_id", c.id),
      c.visit_id ? supabase.from("lab_orders").select("*").eq("visit_id", c.visit_id) : Promise.resolve({ data: [] }),
      c.visit_id ? supabase.from("invoices").select("*").eq("visit_id", c.visit_id).maybeSingle() : supabase.from("invoices").select("*").eq("consultation_id", c.id).maybeSingle(),
    ]);
    setPrescriptions(rxRes.data || []);
    setLabOrders((labRes as any).data || []);
    setInvoice(invRes.data as InvoiceData | null);
  };

  const generateReport = async () => {
    if (!selectedConsultation) return;
    setProcessing("report");
    try {
      const { data, error } = await supabase.functions.invoke("generate-patient-report", {
        body: { consultation_id: selectedConsultation.id, visit_id: selectedConsultation.visit_id },
      });
      if (error) throw new Error(error.message);
      // Update status
      await supabase.from("consultations").update({ status: "report_generated" }).eq("id", selectedConsultation.id);
      setSelectedConsultation(prev => prev ? { ...prev, status: "report_generated" } : null);
      toast({ title: "Report generated", description: "Patient report is ready for delivery." });
    } catch (err: any) {
      toast({ title: "Report failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const generateInvoice = async () => {
    if (!selectedConsultation || !clinicId) return;
    setProcessing("invoice");
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice", {
        body: {
          consultation_id: selectedConsultation.id,
          patient_id: selectedConsultation.patient_id,
          clinic_id: clinicId,
          visit_id: selectedConsultation.visit_id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.invoice) setInvoice(data.invoice);
      toast({ title: "Invoice generated", description: `Invoice #${data?.invoice?.invoice_number || "N/A"}` });
    } catch (err: any) {
      toast({ title: "Invoice failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const markAsPaid = async (mode: string) => {
    if (!invoice?.id) return;
    setProcessing("payment");
    try {
      await supabase.from("invoices").update({ status: "paid", payment_mode: mode }).eq("id", invoice.id);
      setInvoice(prev => prev ? { ...prev, status: "paid", payment_mode: mode } : null);
      // Send notification
      if (selectedConsultation) {
        await sendNotification("payment_completed", { amount: String(invoice.total || 0) });
      }
      toast({ title: "Payment recorded", description: `Marked as paid via ${mode}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const sendNotification = async (event: string, extra: Record<string, string> = {}) => {
    if (!selectedConsultation || !clinicId) return;
    try {
      await supabase.functions.invoke("send-patient-update", {
        body: {
          patient_id: selectedConsultation.patient_id,
          visit_id: selectedConsultation.visit_id,
          clinic_id: clinicId,
          trigger_event: event,
          extra_vars: extra,
        },
      });
    } catch { /* non-blocking */ }
  };

  const deliverReport = async (method: "sms" | "email" | "link") => {
    if (!selectedConsultation) return;
    setProcessing(`deliver_${method}`);
    try {
      const { data, error } = await supabase.functions.invoke("send-report", {
        body: {
          consultation_id: selectedConsultation.id,
          visit_id: selectedConsultation.visit_id,
          delivery_method: method,
        },
      });
      if (error) throw new Error(error.message);
      toast({ title: `Report sent via ${method}`, description: data?.report_link ? `Link: ${data.report_link}` : "Delivery initiated." });
      await sendNotification("report_ready", { report_link: data?.report_link || "" });
    } catch (err: any) {
      toast({ title: "Delivery failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const forwardToPharmacy = async () => {
    if (!selectedConsultation || !clinicId) return;
    setProcessing("pharmacy");
    try {
      const rxIds = prescriptions.map(p => p.id);
      const { error } = await supabase.functions.invoke("deliver-consultation-outputs", {
        body: {
          consultation_id: selectedConsultation.id,
          patient_id: selectedConsultation.patient_id,
          clinic_id: clinicId,
          visit_id: selectedConsultation.visit_id,
          delivery_targets: ["pharmacy"],
          prescription_ids: rxIds,
        },
      });
      if (error) throw new Error(error.message);
      await sendNotification("prescription_sent");
      toast({ title: "Sent to pharmacy", description: "Prescription forwarded to preferred pharmacy." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const forwardToLab = async () => {
    if (!selectedConsultation || !clinicId) return;
    setProcessing("lab");
    try {
      const labIds = labOrders.map(l => l.id);
      const { error } = await supabase.functions.invoke("deliver-consultation-outputs", {
        body: {
          consultation_id: selectedConsultation.id,
          patient_id: selectedConsultation.patient_id,
          clinic_id: clinicId,
          visit_id: selectedConsultation.visit_id,
          delivery_targets: ["lab"],
          lab_order_ids: labIds,
        },
      });
      if (error) throw new Error(error.message);
      await sendNotification("lab_ordered");
      toast({ title: "Sent to lab", description: "Lab orders forwarded to preferred lab." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const downloadPDF = async () => {
    if (!selectedConsultation) return;
    setProcessing("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const patientName = selectedConsultation.patients?.name || "Patient";

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 32, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("DATAelixAIr\u2122", 15, 15);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      
      doc.text(dateStr, 195, 15, { align: "right" });

      let y = 42;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Patient: ${patientName}`, 15, y);
      if (selectedConsultation.patients?.age) doc.text(`Age: ${selectedConsultation.patients.age}`, 120, y);
      y += 8;
      if (selectedConsultation.patients?.gender) { doc.setFontSize(10); doc.text(`Gender: ${selectedConsultation.patients.gender}`, 15, y); y += 8; }

      // Consultation Summary
      if (selectedConsultation.chief_complaint) {
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 4, 190, 8, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Consultation Summary", 15, y);
        y += 10;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Chief Complaint: ${selectedConsultation.chief_complaint}`, 15, y);
        y += 6;
        if (selectedConsultation.soap_assessment) {
          const lines = doc.splitTextToSize(`Assessment: ${selectedConsultation.soap_assessment}`, 180);
          doc.text(lines, 15, y);
          y += lines.length * 5 + 4;
        }
        if (selectedConsultation.soap_plan) {
          const lines = doc.splitTextToSize(`Plan: ${selectedConsultation.soap_plan}`, 180);
          doc.text(lines, 15, y);
          y += lines.length * 5 + 4;
        }
      }

      // Prescriptions
      if (prescriptions.length > 0) {
        y += 4;
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 4, 190, 8, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Prescription", 15, y);
        y += 10;
        doc.setFontSize(8);
        prescriptions.forEach(rx => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "bold");
          doc.text(rx.drug_name, 15, y);
          doc.setFont("helvetica", "normal");
          doc.text(`${rx.dosage || ""} · ${rx.frequency || ""} · ${rx.duration || ""} · ${rx.route || "oral"}`, 70, y);
          if (rx.instructions) { y += 4; doc.text(`  Instructions: ${rx.instructions}`, 15, y); }
          y += 7;
        });
      }

      // Lab Orders
      if (labOrders.length > 0) {
        y += 4;
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 4, 190, 8, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Lab Orders", 15, y);
        y += 10;
        doc.setFontSize(8);
        labOrders.forEach(lo => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "normal");
          doc.text(`• ${lo.test_name} (${lo.priority || "routine"})`, 15, y);
          y += 6;
        });
      }

      // Invoice
      if (invoice) {
        y += 4;
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 4, 190, 8, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Invoice", 15, y);
        y += 10;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Invoice #: ${invoice.invoice_number || "N/A"}`, 15, y);
        doc.text(`Total: ₹${invoice.total || 0}`, 100, y);
        doc.text(`Status: ${invoice.status === "paid" ? "PAID" : "PENDING"}`, 150, y);
        y += 8;
      }

      // Digital Signature
      y += 10;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, y, 80, y);
      doc.line(120, y, 195, y);
      y += 5;
      doc.setFontSize(8);
      doc.text("Doctor Signature", 15, y);
      doc.text("Front Desk Verification", 120, y);
      y += 5;
      doc.setFontSize(7);
      doc.text(`Digitally signed · ${dateStr}`, 15, y);
      doc.text(`Verified by front desk · ${dateStr}`, 120, y);

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 280, 210, 17, "F");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Generated by DATAelixAIr · This is an AI-assisted document for clinician review", 105, 287, { align: "center" });
        doc.text(`Page ${i} of ${pageCount}`, 195, 292, { align: "right" });
      }

      doc.save(`DATAelixAIr_${patientName.replace(/\s/g, "_")}_Report.pdf`);
      toast({ title: "PDF Downloaded" });
    } catch (err: any) {
      toast({ title: "PDF failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = consultations.filter(c => c.status === "awaiting_frontdesk").length;
  const completedCount = consultations.filter(c => c.status === "complete" || c.status === "report_generated").length;

  return (
    <>
      <SEO title="Front Desk — DATAelixAIr" description="Front desk consultation processing dashboard" />
      <div className="p-4 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Front Desk
            </h1>
            <p className="text-xs text-muted-foreground">Process consultations, generate reports, and manage billing</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> {pendingCount} pending
            </Badge>
            <Button variant="outline" size="sm" onClick={() => clinicId && fetchConsultations(clinicId)} className="h-8 gap-1">
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="queue" className="gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" /> Queue
              {pendingCount > 0 && <Badge className="ml-1 h-5 w-5 p-0 text-[10px] justify-center bg-primary">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="detail" className="gap-1" disabled={!selectedConsultation}>
              <FileText className="h-3.5 w-3.5" /> Detail
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Completed ({completedCount})
            </TabsTrigger>
          </TabsList>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-2 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : consultations.filter(c => c.status === "awaiting_frontdesk").length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No consultations awaiting processing</p>
              </div>
            ) : (
              consultations.filter(c => c.status === "awaiting_frontdesk").map(c => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => selectConsultation(c)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {c.patients?.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.patients?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.patients?.age ? `${c.patients.age}y` : ""} · {c.chief_complaint || "No complaint"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Awaiting</Badge>
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* Detail Tab */}
          <TabsContent value="detail" className="mt-4">
            {selectedConsultation ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Consultation Details */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4" /> Patient
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <p className="text-base font-semibold">{selectedConsultation.patients?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConsultation.patients?.age ? `${selectedConsultation.patients.age}y` : ""} · {selectedConsultation.patients?.gender || ""}
                      </p>
                      {selectedConsultation.patients?.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{selectedConsultation.patients.phone}</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Consultation Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedConsultation.chief_complaint && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Chief Complaint</p>
                          <p className="text-sm">{selectedConsultation.chief_complaint}</p>
                        </div>
                      )}
                      {selectedConsultation.soap_assessment && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Assessment</p>
                          <p className="text-sm">{selectedConsultation.soap_assessment}</p>
                        </div>
                      )}
                      {selectedConsultation.soap_plan && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Plan</p>
                          <p className="text-sm">{selectedConsultation.soap_plan}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Prescriptions */}
                  {prescriptions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Pill className="h-4 w-4" /> Prescription ({prescriptions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5">
                        {prescriptions.map(rx => (
                          <div key={rx.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                            <Pill className="h-3 w-3 text-primary shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium">{rx.drug_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {[rx.dosage, rx.frequency, rx.duration, rx.route].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Lab Orders */}
                  {labOrders.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FlaskConical className="h-4 w-4" /> Lab Orders ({labOrders.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5">
                        {labOrders.map(lo => (
                          <div key={lo.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                            <FlaskConical className="h-3 w-3 text-primary shrink-0" />
                            <p className="text-xs font-medium">{lo.test_name}</p>
                            <Badge variant="outline" className="text-[9px] ml-auto">{lo.priority || "routine"}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="space-y-4">
                  {/* Generate Report */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button className="w-full gap-2" onClick={generateReport} disabled={!!processing}>
                        {processing === "report" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        Generate Report
                      </Button>

                      <Button className="w-full gap-2" variant="outline" onClick={generateInvoice} disabled={!!processing || !!invoice}>
                        {processing === "invoice" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        {invoice ? `Invoice: ₹${invoice.total}` : "Generate Invoice"}
                      </Button>

                      <Button className="w-full gap-2" variant="outline" onClick={downloadPDF} disabled={!!processing}>
                        {processing === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Download PDF
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Invoice & Payment */}
                  {invoice && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CreditCard className="h-4 w-4" /> Invoice
                          <Badge variant="outline" className={`ml-auto text-[10px] ${invoice.status === "paid" ? "border-green-500/30 text-green-600" : "border-amber-500/30 text-amber-600"}`}>
                            {invoice.status === "paid" ? "Paid" : "Pending"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs text-muted-foreground">{invoice.invoice_number}</span>
                          <span className="text-lg font-bold">₹{invoice.total || 0}</span>
                        </div>
                        {invoice.status !== "paid" && (
                          <div className="flex gap-2">
                            {["cash", "upi", "card"].map(mode => (
                              <Button key={mode} variant="outline" size="sm" className="flex-1 capitalize text-xs" onClick={() => markAsPaid(mode)} disabled={!!processing}>
                                {processing === "payment" ? <Loader2 className="h-3 w-3 animate-spin" /> : mode}
                              </Button>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Delivery */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Send className="h-4 w-4" /> Send to Patient
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => deliverReport("sms")} disabled={!!processing}>
                          <MessageSquare className="h-3 w-3" /> SMS
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => deliverReport("email")} disabled={!!processing}>
                          <Mail className="h-3 w-3" /> Email
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => deliverReport("link")} disabled={!!processing}>
                          <Eye className="h-3 w-3" /> Link
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Forward to Pharmacy / Lab */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Forward</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {prescriptions.length > 0 && (
                        <Button variant="outline" className="w-full gap-2 text-xs" onClick={forwardToPharmacy} disabled={!!processing}>
                          {processing === "pharmacy" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Building2 className="h-3 w-3" />}
                          Send Rx to Pharmacy
                        </Button>
                      )}
                      {labOrders.length > 0 && (
                        <Button variant="outline" className="w-full gap-2 text-xs" onClick={forwardToLab} disabled={!!processing}>
                          {processing === "lab" ? <Loader2 className="h-3 w-3 animate-spin" /> : <TestTube className="h-3 w-3" />}
                          Send Orders to Lab
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Mark Complete */}
                  <Button
                    className="w-full gap-2"
                    onClick={async () => {
                      await supabase.from("consultations").update({ status: "complete" }).eq("id", selectedConsultation.id);
                      setSelectedConsultation(prev => prev ? { ...prev, status: "complete" } : null);
                      if (clinicId) fetchConsultations(clinicId);
                      toast({ title: "Consultation marked complete" });
                    }}
                    disabled={selectedConsultation.status === "complete"}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {selectedConsultation.status === "complete" ? "Completed" : "Mark Complete"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Select a consultation from the queue</p>
              </div>
            )}
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="space-y-2 mt-4">
            {consultations.filter(c => c.status === "complete" || c.status === "report_generated").map(c => (
              <Card key={c.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => selectConsultation(c)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.patients?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{c.chief_complaint || "—"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("en-IN")}
                  </span>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
