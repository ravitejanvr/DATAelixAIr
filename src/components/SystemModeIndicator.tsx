import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getSystemMode, onSystemModeChange, type SystemMode } from "@/services/system_mode";
import { getEngineConfig, onEngineConfigChange, type EngineConfig, type EngineVersion } from "@/services/engine_registry";
import { Activity, FlaskConical, Shield, Cpu } from "lucide-react";

export interface SystemModeIndicatorProps {
  /**
   * The engine that actually executed for the current consultation, read
   * from PipelineResult.engine_audit.engine_version. When provided, this is
   * shown instead of the static registry default — per-request reality
   * takes priority over configured intent. Omit only when no pipeline run
   * has produced a result yet (idle state).
   */
  engineVersion?: EngineVersion | null;
}

/**
 * Displays the current system execution mode AND active engine version.
 * Always visible when rendered — no hidden states.
 */
export default function SystemModeIndicator({ engineVersion }: SystemModeIndicatorProps = {}) {
  const [mode, setMode] = useState<SystemMode>(getSystemMode());
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(getEngineConfig());

  useEffect(() => {
    const unsub1 = onSystemModeChange(setMode);
    const unsub2 = onEngineConfigChange(setEngineConfig);
    return () => { unsub1(); unsub2(); };
  }, []);

  const config = MODE_DISPLAY[mode.type] ?? MODE_DISPLAY.LIVE_PIPELINE;
  // Per-request reality (engine_audit) over static config — the static
  // default is only a stand-in before any consultation has run.
  const displayedEngine = engineVersion ?? engineConfig.active_engine;

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
        title={
          engineVersion
            ? `Engine: ${displayedEngine.toUpperCase()} (actually executed)`
            : `Engine: ${displayedEngine.toUpperCase()} (configured default — no consultation run yet)`
        }
      >
        <Cpu className="h-3 w-3" />
        {displayedEngine.toUpperCase()}
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
