import { motion } from "framer-motion";
import { ShieldCheck, Zap, Activity, TrendingUp, Users } from "lucide-react";

const data = [
  { label: "Mon", value: 35 },
  { label: "Tue", value: 55 },
  { label: "Wed", value: 45 },
  { label: "Thu", value: 70 },
  { label: "Fri", value: 60 },
  { label: "Sat", value: 85 },
  { label: "Sun", value: 50 },
  { label: "Avg", value: 65 },
];

const HeroDashboard = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.5, duration: 1.2 }}
    className="relative"
  >
    <div className="bg-card border border-border rounded-[20px] p-7 shadow-card relative overflow-hidden">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] gradient-teal" />

      <div className="absolute -top-4 right-6 bg-foreground text-background text-xs font-medium px-3.5 py-1.5 rounded-full tracking-wide flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-green-400" />
        <span>Live Dashboard</span>
      </div>

      <div className="flex items-center gap-2 mb-5 mt-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-mid">
          Hospital Performance Overview
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { val: "+38", unit: "%", label: "Productivity", icon: TrendingUp },
          { val: "+22", unit: "%", label: "Revenue", icon: Activity },
          { val: "99", unit: "%", label: "Uptime", icon: Zap },
        ].map((m) => (
          <div key={m.label} className="text-center bg-muted/40 rounded-xl p-3">
            <m.icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
            <div className="font-display text-2xl font-bold text-foreground leading-none">
              {m.val}<span className="text-primary">{m.unit}</span>
            </div>
            <div className="text-xs text-gray-mid mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-muted rounded-xl p-4 h-[110px] flex items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-md transition-all ${
                d.value >= 65 ? "gradient-teal-vertical shadow-[0_0_12px_hsl(var(--teal)/0.3)]" : "bg-gray-mid/30"
              }`}
              style={{ height: `${d.value}%` }}
            />
            <span className="text-[0.6rem] text-gray-mid">{d.label}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Mini cards */}
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div className="bg-card border border-border rounded-[14px] p-4 shadow-card">
        <div className="w-9 h-9 rounded-[10px] teal-muted-bg flex items-center justify-center mb-2.5">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <p className="text-xs font-medium text-foreground">HIPAA Compliant</p>
        <p className="font-display text-lg font-bold text-primary mt-0.5">Active</p>
      </div>
      <div className="bg-card border border-border rounded-[14px] p-4 shadow-card">
        <div className="w-9 h-9 rounded-[10px] teal-muted-bg flex items-center justify-center mb-2.5">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <p className="text-xs font-medium text-foreground">AI Inference</p>
        <p className="font-display text-lg font-bold text-primary mt-0.5">12ms</p>
      </div>
    </div>
  </motion.div>
);

export default HeroDashboard;
