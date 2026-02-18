import { motion } from "framer-motion";
import { ShieldCheck, Heart, AlertTriangle, FileCheck, Globe, Users, BookOpen, TrendingUp } from "lucide-react";

const strategicPillars = [
  {
    icon: ShieldCheck,
    title: "Clinical Governance",
    highlight: "Integrated quality management",
    desc: "Systematic accountability, transparency & continuous improvement across all clinical services.",
  },
  {
    icon: Heart,
    title: "Patient Safety Culture",
    highlight: "Zero avoidable harm",
    desc: "Embedding safety into every workflow — from incident reporting to proactive risk mitigation.",
  },
  {
    icon: Globe,
    title: "WHO Action Plan 2021–2030",
    highlight: "7 strategic objectives",
    desc: "Aligned with WHO's vision: safer systems, engaged patients, workforce resilience & data-driven learning.",
  },
  {
    icon: Users,
    title: "Multi-Stakeholder Accountability",
    highlight: "Shared responsibility",
    desc: "Providers, regulators, patients & communities working together towards measurable safety outcomes.",
  },
];

const keyOutcomes = [
  { value: "50%+", label: "Avoidable harm preventable", icon: TrendingUp },
  { value: "134M", label: "Annual adverse events (LMICs)", icon: AlertTriangle },
  { value: "2030", label: "WHO target year", icon: Globe },
];

const conclusionPoints = [
  { icon: BookOpen, text: "Evidence-based policies driving systemic safety improvement" },
  { icon: FileCheck, text: "Continuous audit, learning & quality assurance cycles" },
  { icon: Heart, text: "Patient & family engagement as a core safety pillar" },
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
      <div className="px-7 pt-7 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Clinical Governance & Patient Safety
          </span>
        </div>
        <span className="text-[0.6rem] text-primary font-semibold uppercase tracking-widest">WHO Aligned</span>
      </div>

      {/* Strategic Pillars */}
      <div className="px-7 py-4">
        <div className="grid grid-cols-2 gap-3">
          {strategicPillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.1, type: "spring", stiffness: 180 }}
              className="bg-muted/40 rounded-xl p-4 group hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/20"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full teal-muted-bg border teal-muted-border flex items-center justify-center shrink-0">
                  <p.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <span className="text-[0.7rem] font-bold text-foreground leading-tight block">{p.title}</span>
                  <span className="text-[0.55rem] text-primary font-medium">{p.highlight}</span>
                </div>
              </div>
              <p className="text-[0.58rem] text-muted-foreground leading-relaxed pl-[42px]">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Key Outcomes */}
      <div className="px-7 pb-3">
        <div className="grid grid-cols-3 gap-3">
          {keyOutcomes.map((m, i) => (
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

      {/* Conclusion strip */}
      <div className="px-7 pb-7">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="teal-muted-bg border teal-muted-border rounded-xl p-4"
        >
          <p className="text-[0.6rem] font-semibold text-foreground mb-2.5 uppercase tracking-widest">Governance Vision</p>
          <div className="space-y-2">
            {conclusionPoints.map((c) => (
              <div key={c.text} className="flex items-start gap-2">
                <c.icon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[0.6rem] text-muted-foreground leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  </motion.div>
);

export default HeroDashboard;
