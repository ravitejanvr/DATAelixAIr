import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TimelineStep {
  label: string;
  status: "done" | "active" | "pending";
}

interface ConsultationTimelineProps {
  steps: TimelineStep[];
}

export default function ConsultationTimeline({ steps }: ConsultationTimelineProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors",
              step.status === "done" && "bg-chip-medication text-chip-medication-text",
              step.status === "active" && "bg-primary/10 text-primary ring-1 ring-primary/20",
              step.status === "pending" && "bg-muted text-muted-foreground/50"
            )}
          >
            {step.status === "done" && <CheckCircle className="h-3 w-3" />}
            {step.status === "active" && <Loader2 className="h-3 w-3 animate-spin" />}
            {step.status === "pending" && <Circle className="h-3 w-3" />}
            {step.label}
          </motion.div>
          {i < steps.length - 1 && (
            <div className={cn(
              "w-3 h-px",
              step.status === "done" ? "bg-chip-medication-text/30" : "bg-border"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}
