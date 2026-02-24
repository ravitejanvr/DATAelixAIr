import { motion } from "framer-motion";
import { Mic, FileText, Pill, ClipboardList, ArrowRight } from "lucide-react";

const steps = [
  { icon: Mic, label: "Record Consultation", detail: "Voice capture during patient visit" },
  { icon: FileText, label: "AI Clinical Notes", detail: "SOAP notes generated automatically" },
  { icon: Pill, label: "Prescription Draft", detail: "Medications, dosage & interactions" },
  { icon: ClipboardList, label: "Patient Summary", detail: "Shareable report for follow-up" },
];

const HeroDashboard = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.5, duration: 1 }}
  >
    <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
      {/* Top accent */}
      <div className="h-[3px] gradient-teal" />

      <div className="px-6 pt-5 pb-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Consultation Workflow
        </span>
      </div>

      {/* Workflow steps */}
      <div className="px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.12, type: "spring", stiffness: 200 }}
              className="relative bg-muted/40 rounded-xl p-4 text-center group hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/20"
            >
              <div className="w-10 h-10 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mb-2.5">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs font-bold text-foreground leading-tight">{s.label}</p>
              <p className="text-[0.6rem] text-muted-foreground mt-1 leading-snug">{s.detail}</p>

              {/* Arrow connector (hidden on last item and mobile) */}
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 z-10" />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="mx-6 mb-6 teal-muted-bg border teal-muted-border rounded-xl px-5 py-3 flex items-center justify-between"
      >
        <p className="text-[0.65rem] text-muted-foreground">
          <span className="font-semibold text-foreground">End-to-end in under 60 seconds</span> — from voice to structured clinical output
        </p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[0.6rem] font-medium text-primary">Live</span>
        </div>
      </motion.div>
    </div>
  </motion.div>
);

export default HeroDashboard;
