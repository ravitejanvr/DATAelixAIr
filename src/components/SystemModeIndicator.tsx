import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getSystemMode, onSystemModeChange, type SystemMode } from "@/services/system_mode";
import { getEngineConfig, onEngineConfigChange, type EngineConfig } from "@/services/engine_registry";
import { Activity, FlaskConical, Shield, Cpu } from "lucide-react";

/**
 * Displays the current system execution mode AND active engine version.
 * Always visible when rendered — no hidden states.
 */
export default function SystemModeIndicator() {
  const [mode, setMode] = useState<SystemMode>(getSystemMode());
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(getEngineConfig());

  useEffect(() => {
    const unsub1 = onSystemModeChange(setMode);
    const unsub2 = onEngineConfigChange(setEngineConfig);
    return () => { unsub1(); unsub2(); };
  }, []);

  const config = MODE_DISPLAY[mode.type] ?? MODE_DISPLAY.LIVE_PIPELINE;

  return (
    <div className="flex items-center gap-1">
      <Badge
        variant="outline"
        className={`gap-1.5 text-[10px] font-mono ${config.className}`}
        title={`Source: ${mode.source} | Updated: ${mode.updatedAt}`}
      >
        <config.icon className="h-3 w-3" />
        {mode.label}
      </Badge>
      <Badge
        variant="outline"
        className="gap-1 text-[10px] font-mono border-primary/40 text-primary bg-primary/5"
        title={`Engine: ${engineConfig.active_engine.toUpperCase()} | Shadow: ${engineConfig.shadow_engine?.toUpperCase() || "none"}`}
      >
        <Cpu className="h-3 w-3" />
        {engineConfig.active_engine.toUpperCase()}
      </Badge>
    </div>
  );
}

const MODE_DISPLAY: Record<string, { icon: typeof Activity; className: string }> = {
  LIVE_PIPELINE: {
    icon: Activity,
    className: "border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  BENCHMARK: {
    icon: FlaskConical,
    className: "border-amber-500/40 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  },
  VALIDATION: {
    icon: Shield,
    className: "border-blue-500/40 text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  },
};
