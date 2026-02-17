import { motion } from "framer-motion";

const bars = [35, 55, 45, 70, 60, 85, 50, 65];
const activeIndices = [3, 5, 7];

const HeroDashboard = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.5, duration: 1.2 }}
    className="relative"
  >
    <div className="bg-card border border-border rounded-[20px] p-7 shadow-card relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] gradient-teal" />

      <div className="absolute -top-4 right-6 bg-foreground text-background text-xs font-medium px-3.5 py-1.5 rounded-full tracking-wide">
        <span className="text-green-400 mr-1">●</span> AI Scribe Active
      </div>

      <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-mid mb-5 mt-2">
        Clinical Documentation AI
      </p>

      {/* Metrics — from pitch deck */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { val: "30", unit: "%", label: "Less Doc Time" },
          { val: "£50K", unit: "+", label: "Annual Savings" },
          { val: "99.5", unit: "%", label: "Accuracy" },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <div className="font-display text-3xl font-bold text-foreground leading-none">
              {m.val}<span className="text-primary">{m.unit}</span>
            </div>
            <div className="text-xs text-gray-mid mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-muted rounded-xl p-4 h-[100px] flex items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t transition-all ${
              activeIndices.includes(i) ? "gradient-teal-vertical" : "bg-gray-mid/50"
            }`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>

    {/* Mini cards */}
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div className="bg-card border border-border rounded-[14px] p-4 shadow-card">
        <div className="w-9 h-9 rounded-[10px] teal-muted-bg flex items-center justify-center text-base mb-2.5">🛡️</div>
        <p className="text-xs font-medium text-foreground">NHS DTAC</p>
        <p className="font-display text-lg font-bold text-primary mt-0.5">Compliant</p>
      </div>
      <div className="bg-card border border-border rounded-[14px] p-4 shadow-card">
        <div className="w-9 h-9 rounded-[10px] teal-muted-bg flex items-center justify-center text-base mb-2.5">⚡</div>
        <p className="text-xs font-medium text-foreground">Real-Time</p>
        <p className="font-display text-lg font-bold text-primary mt-0.5">Transcription</p>
      </div>
    </div>
  </motion.div>
);

export default HeroDashboard;
