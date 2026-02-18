import { motion } from "framer-motion";
import { ShieldCheck, Activity, Heart, FileCheck, AlertTriangle, TrendingUp } from "lucide-react";

const pillars = [
  { label: "Clinical Governance", icon: ShieldCheck, desc: "Integrated quality frameworks" },
  { label: "Patient Safety", icon: Heart, desc: "Reducing avoidable harm" },
  { label: "Risk Management", icon: AlertTriangle, desc: "Proactive risk mitigation" },
  { label: "Audit & Compliance", icon: FileCheck, desc: "Continuous quality assurance" },
];

const stats = [
  { value: "50%+", label: "Avoidable Harm Preventable", icon: TrendingUp },
  { value: "2030", label: "WHO Action Plan Target", icon: ShieldCheck },
  { value: "100%", label: "Audit Trail Coverage", icon: FileCheck },
];

const HeroDashboard = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.5, duration: 1.2 }}
    className="relative"
  >
    <div className="bg-card border border-border rounded-[20px] shadow-card relative overflow-hidden">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[3px] gradient-teal" />

      {/* Header */}
      <div className="px-7 pt-7 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Clinical Governance Hub
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
          <Activity className="w-3.5 h-3.5" />
          Active
        </div>
      </div>

      {/* Governance Pillars Grid */}
      <div className="px-7 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.12, type: "spring", stiffness: 200 }}
              className="relative bg-muted/40 rounded-xl p-4 group hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-full teal-muted-bg border teal-muted-border flex items-center justify-center">
                  <p.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[0.7rem] font-bold text-foreground leading-tight">{p.label}</span>
              </div>
              <p className="text-[0.6rem] text-muted-foreground leading-relaxed pl-[42px]">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-7 pb-7">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + i * 0.1 }}
              className="bg-muted/40 rounded-xl p-3 text-center"
            >
              <m.icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="font-display text-lg font-bold text-foreground leading-none">{m.value}</div>
              <div className="text-[0.55rem] text-muted-foreground mt-1 leading-tight">{m.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

export default HeroDashboard;
