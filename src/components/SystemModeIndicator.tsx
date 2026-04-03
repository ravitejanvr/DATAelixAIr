import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getSystemMode, onSystemModeChange, type SystemMode } from "@/services/system_mode";
import { Activity, FlaskConical, Shield } from "lucide-react";

/**
 * Displays the current system execution mode.
 * Always visible when rendered — no hidden states.
 */
export default function SystemModeIndicator() {
  const [mode, setMode] = useState<SystemMode>(getSystemMode());

  useEffect(() => {
    const unsub = onSystemModeChange(setMode);
    return unsub;
  }, []);

  const config = MODE_DISPLAY[mode.type] ?? MODE_DISPLAY.LIVE_PIPELINE;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 text-[10px] font-mono ${config.className}`}
      title={`Source: ${mode.source} | Updated: ${mode.updatedAt}`}
    >
      <config.icon className="h-3 w-3" />
      {mode.label}
    </Badge>
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
