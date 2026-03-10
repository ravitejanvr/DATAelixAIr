import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ProgressiveAction, ProgressiveConsultationStage } from "@/services/progressiveActionEngine";

interface ProgressiveActionBarProps {
  stage: ProgressiveConsultationStage;
  action: ProgressiveAction;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

export default function ProgressiveActionBar({ stage, action, disabled, loading, onClick }: ProgressiveActionBarProps) {
  return (
    <div className="sticky bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur px-3 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] capitalize">{stage.replace(/_/g, " ")}</Badge>
        <p className="text-[11px] text-muted-foreground flex-1">{action.description}</p>
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={disabled || loading} onClick={onClick}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {action.label}
        </Button>
      </div>
    </div>
  );
}
