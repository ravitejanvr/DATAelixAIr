import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  CheckCircle, Pill, FlaskConical, FileText, CreditCard,
  Send, Download, Loader2, Printer, Building2, TestTube,
  User, RotateCcw, ExternalLink
} from "lucide-react";
import brainLogo from "@/assets/brain-logo-nobg.png";

interface FinalizationResults {
  consultation_id: string;
  prescriptions?: { id: string; drug_name: string; dosage?: string; frequency?: string; duration?: string; route?: string; instructions?: string }[];
  lab_orders?: { id: string; test_name: string; priority?: string; notes?: string }[];
  invoice?: { id: string; invoice_number: string; total: number; status: string; consultation_fee?: number; lab_charges?: any[] };
  report?: any;
  stages: { stage: string; status: string; count?: number; total?: number; error?: string }[];
  errors?: string[];
  ai_generated_prescriptions?: boolean;
  ai_generated_lab_orders?: boolean;
}

interface ConsultationCompleteProps {
  results: FinalizationResults;
  patientId: string;
  clinicId: string;
  visitId: string | null;
  patientName: string;
  onNewSession: () => void;
}

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25 },
};

export default function ConsultationComplete({
  results, patientId, clinicId, visitId, patientName, onNewSession,
}: ConsultationCompleteProps) {
  const { toast } = useToast();
  const [delivering, setDelivering] = useState<string | null>(null);
  const [deliveryResults, setDeliveryResults] = useState<Record<string, string>>({});
  const [markingPaid, setMarkingPaid] = useState(false);
  const [invoicePaid, setInvoicePaid] = useState(results.invoice?.status === "paid");
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const deliver = async (target: string) => {
    setDelivering(target);
    try {
      const { data, error } = await supabase.functions.invoke("deliver-consultation-outputs", {
        body: {
          consultation_id: results.consultation_id,
          patient_id: patientId,
          clinic_id: clinicId,
          visit_id: visitId,
          delivery_targets: [target],
          delivery_method: "link",
          prescription_ids: (results.prescriptions || []).map(p => p.id),
          lab_order_ids: (results.lab_orders || []).map(l => l.id),
        },
      });
      if (error) throw new Error(error.message);
      setDeliveryResults(prev => ({ ...prev, [target]: "sent" }));
      toast({ title: `Sent to ${target}`, description: "Delivery initiated successfully." });
    } catch (err: any) {
      setDeliveryResults(prev => ({ ...prev, [target]: "failed" }));
      toast({ title: "Delivery failed", description: err.message, variant: "destructive" });
    } finally {
      setDelivering(null);
    }
  };

  const markAsPaid = async (paymentMode: string) => {
    if (!results.invoice?.id) return;
    setMarkingPaid(true);
    try {
      const { error } = await supabase.from("invoices")
        .update({ status: "paid", payment_mode: paymentMode })
        .eq("id", results.invoice.id);
      if (error) throw new Error(error.message);
      setInvoicePaid(true);
      toast({ title: "Payment recorded", description: `Invoice marked as paid via ${paymentMode}.` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setMarkingPaid(false);
    }
  };

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      const addHeader = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 32, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("DATAelixAIr", 15, 15);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        
        doc.text(`${dateStr}  ${timeStr}`, 195, 15, { align: "right" });
        doc.text(`Consultation ID: ${results.consultation_id?.slice(0, 8) || "N/A"}`, 195, 22, { align: "right" });
      };

      const addFooter = () => {
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 280, 210, 17, "F");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Generated by DATAelixAIr · This is an AI-assisted document for clinician review", 105, 287, { align: "center" });
      };

      // ═══ PAGE 1: Health Record / Clinical Summary ═══
      addHeader();
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      let y = 42;
      doc.text("Health Record", 15, y);
      y += 10;

      doc.setFontSize(11);
      doc.text(`Patient: ${patientName}`, 15, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Date: ${dateStr}  ${timeStr}`, 15, y);
      y += 6;
      doc.text(`Consultation ID: ${results.consultation_id || "N/A"}`, 15, y);
      y += 10;

      // Stage summary
      doc.setFillColor(241, 245, 249);
      doc.rect(10, y - 4, 190, 8, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Finalization Summary", 15, y);
      y += 10;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      results.stages.forEach((s) => {
        const icon = s.status === "saved" || s.status === "created" || s.status === "generated" || s.status === "complete" || s.status === "passed" ? "✓" : s.status === "skipped" ? "–" : "✗";
        doc.text(`${icon}  ${s.stage.replace(/_/g, " ")} — ${s.status}${s.count ? ` (${s.count})` : ""}`, 18, y);
        y += 6;
      });
      y += 5;

      // Invoice summary on health record page
      if (results.invoice) {
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 4, 190, 8, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Invoice", 15, y);
        y += 10;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Invoice #: ${results.invoice.invoice_number || "N/A"}`, 15, y);
        y += 6;
        doc.text(`Total: ₹${results.invoice.total}`, 15, y);
        doc.text(`Status: ${invoicePaid ? "PAID" : "PENDING"}`, 100, y);
        y += 6;
        if (results.invoice.consultation_fee) {
          doc.text(`Consultation Fee: ₹${results.invoice.consultation_fee}`, 15, y);
          y += 6;
        }
      }
      addFooter();

      // ═══ PAGE 2: Prescription ═══
      if (results.prescriptions?.length) {
        doc.addPage();
        addHeader();
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        y = 42;
        doc.text("Prescription", 15, y);
        if (results.ai_generated_prescriptions) {
          doc.setFontSize(8);
          doc.setTextColor(59, 130, 246);
          doc.text("AI Generated", 75, y);
          doc.setTextColor(30, 41, 59);
        }
        y += 4;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Patient: ${patientName}  ·  Date: ${dateStr}`, 15, y);
        y += 10;

        // Table header
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const cols = [15, 65, 95, 120, 145, 170];
        doc.text("Drug Name", cols[0], y);
        doc.text("Dosage", cols[1], y);
        doc.text("Frequency", cols[2], y);
        doc.text("Duration", cols[3], y);
        doc.text("Route", cols[4], y);
        doc.text("Instructions", cols[5], y);
        y += 2;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, y, 195, y);
        y += 6;

        doc.setFont("helvetica", "normal");
        results.prescriptions.forEach((rx) => {
          if (y > 265) { addFooter(); doc.addPage(); addHeader(); y = 42; }
          doc.text((rx.drug_name || "").substring(0, 25), cols[0], y);
          doc.text(rx.dosage || "", cols[1], y);
          doc.text(rx.frequency || "", cols[2], y);
          doc.text(rx.duration || "", cols[3], y);
          doc.text(rx.route || "oral", cols[4], y);
          doc.text((rx.instructions || "").substring(0, 15), cols[5], y);
          y += 8;
        });
        addFooter();
      }

      // ═══ PAGE 3: Lab Orders ═══
      if (results.lab_orders?.length) {
        doc.addPage();
        addHeader();
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        y = 42;
        doc.text("Lab Orders", 15, y);
        if (results.ai_generated_lab_orders) {
          doc.setFontSize(8);
          doc.setTextColor(59, 130, 246);
          doc.text("AI Generated", 65, y);
          doc.setTextColor(30, 41, 59);
        }
        y += 4;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Patient: ${patientName}  ·  Date: ${dateStr}`, 15, y);
        y += 10;

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Test Name", 15, y);
        doc.text("Priority", 110, y);
        doc.text("Notes", 145, y);
        y += 2;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, y, 195, y);
        y += 6;

        doc.setFont("helvetica", "normal");
        results.lab_orders.forEach((lo) => {
          if (y > 265) { addFooter(); doc.addPage(); addHeader(); y = 42; }
          doc.text((lo.test_name || "").substring(0, 45), 15, y);
          doc.text(lo.priority || "routine", 110, y);
          doc.text((lo.notes || "").substring(0, 30), 145, y);
          y += 8;
        });
        addFooter();
      }

      // Add page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, 195, 292, { align: "right" });
      }

      doc.save(`DATAelixAIr_${patientName.replace(/\s/g, "_")}_${dateStr.replace(/\s/g, "")}.pdf`);
      toast({ title: "PDF Downloaded", description: "Report with health record, prescription & lab orders saved." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const stageStatus = (stage: string) => results.stages.find(s => s.stage === stage);

  return (
    <motion.div
      ref={printRef}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto w-full space-y-4 p-4"
    >
      {/* Branded Header */}
      <ClinicalCard className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
        <div className="flex flex-col items-center text-center py-6 space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <img src={brainLogo} alt="DATAelixAIr" className="h-12 w-12" />
            <div className="text-left">
              <h1 className="text-lg font-bold text-foreground tracking-tight">DATAelixAIr</h1>
              
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.35 }}
            className="h-14 w-14 rounded-full bg-chip-medication flex items-center justify-center"
          >
            <CheckCircle className="h-7 w-7 text-chip-medication-text" />
          </motion.div>
          <h2 className="text-lg font-bold text-foreground">Consultation Finalized</h2>
          <p className="text-sm text-muted-foreground">
            {patientName} · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>

          {/* Stage Summary */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {results.stages.map((s, i) => (
              <motion.div key={s.stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${s.status === "saved" || s.status === "created" || s.status === "generated" || s.status === "complete" || s.status === "passed"
                    ? "border-chip-medication-border text-chip-medication-text"
                    : s.status === "skipped"
                      ? "border-border text-muted-foreground"
                      : "border-chip-alert-border text-chip-alert-text"
                  }`}
                >
                  {s.stage.replace(/_/g, " ")} · {s.status}
                </Badge>
              </motion.div>
            ))}
          </div>
        </div>
      </ClinicalCard>

      {/* Prescription Summary */}
      {results.prescriptions && results.prescriptions.length > 0 && (
        <motion.div {...fadeIn} transition={{ delay: 0.4 }}>
          <ClinicalCard>
            <ClinicalCardHeader
              title="Prescription"
              icon={<Pill className="h-4 w-4" />}
              badge={
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[10px]">{results.prescriptions.length} items</Badge>
                  {results.ai_generated_prescriptions && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">AI Generated</Badge>}
                </div>
              }
            />
            <div className="mt-3 space-y-2">
              {results.prescriptions.map((rx) => (
                <div key={rx.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                  <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{rx.drug_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[rx.dosage, rx.frequency, rx.duration, rx.route].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Lab Orders Summary */}
      {results.lab_orders && results.lab_orders.length > 0 && (
        <motion.div {...fadeIn} transition={{ delay: 0.5 }}>
          <ClinicalCard>
            <ClinicalCardHeader
              title="Lab Orders"
              icon={<FlaskConical className="h-4 w-4" />}
              badge={
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[10px]">{results.lab_orders.length} tests</Badge>
                  {results.ai_generated_lab_orders && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">AI Generated</Badge>}
                </div>
              }
            />
            <div className="mt-3 space-y-2">
              {results.lab_orders.map((lo) => (
                <div key={lo.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                  <FlaskConical className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{lo.test_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Priority: {lo.priority || "routine"}{lo.notes ? ` · ${lo.notes}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Invoice / Checkout */}
      {results.invoice && (
        <motion.div {...fadeIn} transition={{ delay: 0.6 }}>
          <ClinicalCard>
            <ClinicalCardHeader
              title="Invoice"
              icon={<CreditCard className="h-4 w-4" />}
              badge={
                <Badge
                  variant="outline"
                  className={`text-[10px] ${invoicePaid ? "border-chip-medication-border text-chip-medication-text" : "border-chip-lab-border text-chip-lab-text"}`}
                >
                  {invoicePaid ? "Paid" : "Pending"}
                </Badge>
              }
            />
            <div className="mt-2 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{results.invoice.invoice_number}</span>
                <span className="text-lg font-bold text-foreground">₹{results.invoice.total}</span>
              </div>

              {!invoicePaid && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground w-full mb-1">Select payment method:</p>
                  {["cash", "upi", "card"].map(mode => (
                    <Button
                      key={mode}
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 rounded-lg capitalize"
                      onClick={() => markAsPaid(mode)}
                      disabled={markingPaid}
                    >
                      {markingPaid ? <Loader2 className="h-3 w-3 animate-spin" /> : mode}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Report */}
      {stageStatus("report")?.status === "generated" && (
        <motion.div {...fadeIn} transition={{ delay: 0.7 }}>
          <ClinicalCard>
            <ClinicalCardHeader
              title="Clinical Report"
              icon={<FileText className="h-4 w-4" />}
              badge={<Badge variant="outline" className="text-[10px] border-chip-medication-border text-chip-medication-text">Ready</Badge>}
            />
            <p className="text-xs text-muted-foreground mt-1">Full clinical summary including vitals, diagnosis, prescription, and lab orders.</p>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Delivery Actions */}
      <motion.div {...fadeIn} transition={{ delay: 0.8 }}>
        <ClinicalCard className="border-primary/15">
          <ClinicalCardHeader
            title="Send Results"
            icon={<Send className="h-4 w-4" />}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {[
              { target: "patient", label: "Patient", icon: User },
              { target: "pharmacy", label: "Pharmacy", icon: Building2 },
              { target: "lab", label: "Lab", icon: TestTube },
              { target: "admin", label: "Admin", icon: ExternalLink },
            ].map(({ target, label, icon: Icon }) => (
              <Button
                key={target}
                variant={deliveryResults[target] === "sent" ? "default" : "outline"}
                size="sm"
                className="h-12 flex-col gap-1 text-xs rounded-xl"
                onClick={() => deliver(target)}
                disabled={delivering === target || deliveryResults[target] === "sent"}
              >
                {delivering === target ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : deliveryResults[target] === "sent" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {label}
              </Button>
            ))}
          </div>
        </ClinicalCard>
      </motion.div>

      {/* Actions */}
      <motion.div {...fadeIn} transition={{ delay: 0.9 }} className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 h-11 rounded-xl gap-2" onClick={onNewSession}>
          <RotateCcw className="h-4 w-4" /> New Consultation
        </Button>
        <Button
          variant="default"
          className="h-11 rounded-xl gap-2"
          onClick={downloadPDF}
          disabled={downloading}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PDF
        </Button>
        <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </motion.div>

      {/* Branding Footer */}
      <div className="text-center pt-2 pb-4">
        <p className="text-[10px] text-muted-foreground">
          Generated by <span className="font-semibold text-primary">DATAelixAIr</span> · AI-assisted clinical document for clinician review
        </p>
      </div>

      {/* Errors */}
      {results.errors && results.errors.length > 0 && (
        <div className="p-3 rounded-lg border border-chip-alert-border bg-chip-alert text-[11px] text-chip-alert-text space-y-1">
          <p className="font-semibold">Some steps had issues:</p>
          {results.errors.map((e, i) => <p key={i}>• {e}</p>)}
        </div>
      )}
    </motion.div>
  );
}
