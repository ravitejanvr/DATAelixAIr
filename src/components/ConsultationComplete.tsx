import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Pill, FlaskConical, FileText, CreditCard,
  Send, Download, Loader2, Printer, Building2, TestTube,
  User, RotateCcw, ExternalLink
} from "lucide-react";

interface FinalizationResults {
  consultation_id: string;
  prescriptions?: { id: string; drug_name: string }[];
  lab_orders?: { id: string; test_name: string }[];
  invoice?: { id: string; invoice_number: string; total: number; status: string };
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

  const stageStatus = (stage: string) => results.stages.find(s => s.stage === stage);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto w-full space-y-4 p-4"
    >
      {/* Success Header */}
      <ClinicalCard className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
        <div className="flex flex-col items-center text-center py-6 space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            className="h-16 w-16 rounded-full bg-chip-medication flex items-center justify-center"
          >
            <CheckCircle className="h-8 w-8 text-chip-medication-text" />
          </motion.div>
          <h2 className="text-lg font-bold text-foreground">Consultation Finalized</h2>
          <p className="text-sm text-muted-foreground">
            {patientName} · All outputs generated successfully
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
              badge={<Badge variant="outline" className="text-[10px]">{results.prescriptions.length} items</Badge>}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {results.prescriptions.map(rx => (
                <Chip key={rx.id} variant="medication" size="sm">{rx.drug_name}</Chip>
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
              badge={<Badge variant="outline" className="text-[10px]">{results.lab_orders.length} tests</Badge>}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {results.lab_orders.map(lo => (
                <Chip key={lo.id} variant="lab" size="sm">{lo.test_name}</Chip>
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
        <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </motion.div>

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
