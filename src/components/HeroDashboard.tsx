import { motion } from "framer-motion";
import { Brain, Activity, Shield, Zap, ArrowUpRight } from "lucide-react";

const metrics = [
  { label: "AI Accuracy", value: "99.2%", trend: "+2.1%", icon: Brain },
  { label: "Response Time", value: "12ms", trend: "-34%", icon: Zap },
  { label: "Compliance", value: "100%", trend: "Active", icon: Shield },
];

const nodes = [
  { x: 20, y: 25, label: "EHR", delay: 0 },
  { x: 80, y: 20, label: "Lab", delay: 0.2 },
  { x: 50, y: 50, label: "AI Engine", delay: 0.4, main: true },
  { x: 15, y: 75, label: "Imaging", delay: 0.6 },
  { x: 85, y: 75, label: "Billing", delay: 0.8 },
];

const connections = [
  [0, 2], [1, 2], [2, 3], [2, 4],
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
            AI Integration Hub
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
          <Activity className="w-3.5 h-3.5" />
          Live
        </div>
      </div>

      {/* Network Visualization */}
      <div className="px-7 pb-4">
        <div className="relative h-[160px] bg-muted/40 rounded-xl overflow-hidden">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--primary) / 0.15) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {connections.map(([from, to], i) => (
              <motion.line
                key={i}
                x1={`${nodes[from].x}%`} y1={`${nodes[from].y}%`}
                x2={`${nodes[to].x}%`} y2={`${nodes[to].y}%`}
                stroke="hsl(var(--primary))"
                strokeWidth="0.4"
                strokeOpacity="0.3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.8 + i * 0.2, duration: 0.8 }}
              />
            ))}
            {/* Animated data pulses along connections */}
            {connections.map(([from, to], i) => (
              <motion.circle
                key={`pulse-${i}`}
                r="1"
                fill="hsl(var(--primary))"
                initial={{ opacity: 0 }}
                animate={{
                  cx: [nodes[from].x, nodes[to].x],
                  cy: [nodes[from].y, nodes[to].y],
                  opacity: [0, 1, 1, 0],
                }}
                transition={{
                  delay: 1.5 + i * 0.3,
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              />
            ))}
          </svg>

          {/* Nodes */}
          {nodes.map((node, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 + node.delay, type: "spring", stiffness: 200 }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div className={`rounded-full flex items-center justify-center ${
                node.main
                  ? "w-12 h-12 gradient-teal shadow-teal"
                  : "w-8 h-8 bg-card border border-border shadow-sm"
              }`}>
                {node.main ? (
                  <Brain className="w-5 h-5 text-primary-foreground" />
                ) : (
                  <span className="text-[0.55rem] font-semibold text-foreground">{node.label}</span>
                )}
              </div>
              {node.main && (
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[0.6rem] font-bold text-primary whitespace-nowrap">
                  {node.label}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="px-7 pb-7">
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + i * 0.1 }}
              className="bg-muted/40 rounded-xl p-3 text-center"
            >
              <m.icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="font-display text-lg font-bold text-foreground leading-none">{m.value}</div>
              <div className="text-[0.6rem] text-muted-foreground mt-1">{m.label}</div>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                <ArrowUpRight className="w-2.5 h-2.5 text-primary" />
                <span className="text-[0.55rem] text-primary font-medium">{m.trend}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

export default HeroDashboard;
