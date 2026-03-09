/**
 * SafetyOverrideDialog — Clinical Safety Guardrail Layer
 * 
 * Displays safety alerts and requires explicit clinician confirmation
 * before proceeding with potentially risky actions. All overrides are
 * logged to audit_logs for governance.
 */

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, AlertCircle, Heart, Pill, Activity } from "lucide-react";
import { severityColor, type SafetyResults } from "@/layers/safety/api";

export interface SafetyAlert {
  id: string;
  type: "allergy" | "interaction" | "vitals" | "dose" | "emergency" | "context";
  severity: "warning" | "critical" | "blocking";
  title: string;
  message: string;
  actionHint?: string;
}

interface SafetyOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: SafetyAlert[];
  safetyResults?: SafetyResults;
  onConfirmOverride: (reason: string, acknowledgedAlerts: string[]) => void;
  onCancel: () => void;
  actionLabel?: string;
}

const alertIcons: Record<SafetyAlert["type"], React.ReactNode> = {
  allergy: <ShieldAlert className="h-5 w-5 text-destructive" />,
  interaction: <Pill className="h-5 w-5 text-amber-500" />,
  vitals: <Activity className="h-5 w-5 text-destructive" />,
  dose: <AlertCircle className="h-5 w-5 text-amber-500" />,
  emergency: <Heart className="h-5 w-5 text-destructive" />,
  context: <AlertTriangle className="h-5 w-5 text-muted-foreground" />,
};

export function SafetyOverrideDialog({
  open,
  onOpenChange,
  alerts,
  safetyResults,
  onConfirmOverride,
  onCancel,
  actionLabel = "Proceed with Override",
}: SafetyOverrideDialogProps) {
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");

  const criticalAlerts = alerts.filter((a) => a.severity === "critical" || a.severity === "blocking");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");

  const allCriticalAcknowledged =
    criticalAlerts.length === 0 ||
    criticalAlerts.every((a) => acknowledgedAlerts.includes(a.id));

  const canProceed =
    allCriticalAcknowledged && overrideReason.trim().length >= 10;

  const handleToggleAlert = (alertId: string) => {
    setAcknowledgedAlerts((prev) =>
      prev.includes(alertId)
        ? prev.filter((id) => id !== alertId)
        : [...prev, alertId]
    );
  };

  const handleConfirm = () => {
    onConfirmOverride(overrideReason, acknowledgedAlerts);
    setAcknowledgedAlerts([]);
    setOverrideReason("");
  };

  const handleCancel = () => {
    onCancel();
    setAcknowledgedAlerts([]);
    setOverrideReason("");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Clinical Safety Alerts Detected
          </AlertDialogTitle>
          <AlertDialogDescription>
            The following safety concerns require your review before proceeding.
            You must acknowledge all critical alerts and provide a clinical reason.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Critical Alerts */}
          {criticalAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Critical Alerts — Must Acknowledge
              </h4>
              {criticalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${severityColor(alert.severity)} space-y-2`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={alert.id}
                      checked={acknowledgedAlerts.includes(alert.id)}
                      onCheckedChange={() => handleToggleAlert(alert.id)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={alert.id}
                        className="flex items-center gap-2 font-medium cursor-pointer"
                      >
                        {alertIcons[alert.type]}
                        {alert.title}
                        <Badge variant="destructive" className="text-xs">
                          {alert.severity}
                        </Badge>
                      </label>
                      <p className="text-sm mt-1">{alert.message}</p>
                      {alert.actionHint && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Recommended: {alert.actionHint}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warning Alerts */}
          {warningAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Warnings — Review Recommended
              </h4>
              {warningAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${severityColor(alert.severity)}`}
                >
                  <div className="flex items-center gap-2">
                    {alertIcons[alert.type]}
                    <span className="font-medium">{alert.title}</span>
                  </div>
                  <p className="text-sm mt-1">{alert.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Safety Summary */}
          {safetyResults && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              <span className="font-medium">Safety Assessment:</span>{" "}
              Confidence: {safetyResults.confidence_level} |{" "}
              Manual Review: {safetyResults.requires_manual_review ? "Required" : "Optional"}
            </div>
          )}

          {/* Override Reason */}
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">
              Clinical Justification for Override{" "}
              <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Provide clinical reasoning for proceeding despite safety alerts (minimum 10 characters)..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be logged in the audit trail for compliance purposes.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancel — Review Again
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canProceed}
            className="bg-destructive hover:bg-destructive/90"
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Utility to convert SafetyResults from edge function into SafetyAlert array
 */
export function safetyResultsToAlerts(results: SafetyResults): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];

  // Allergy flags
  results.allergy_flags.forEach((flag, i) => {
    alerts.push({
      id: `allergy-${i}`,
      type: "allergy",
      severity: "critical",
      title: `Drug-Allergy Conflict: ${flag.medication}`,
      message: flag.message,
    });
  });

  // Interaction flags
  results.interaction_flags.forEach((flag, i) => {
    alerts.push({
      id: `interaction-${i}`,
      type: "interaction",
      severity: flag.severity === "severe" ? "critical" : "warning",
      title: `Drug Interaction: ${flag.drug_a} + ${flag.drug_b}`,
      message: flag.description,
    });
  });

  // Vitals dangers
  results.vitals_dangers.forEach((danger, i) => {
    alerts.push({
      id: `vitals-${i}`,
      type: "vitals",
      severity: danger.severity,
      title: `Abnormal Vital: ${danger.parameter}`,
      message: danger.message,
      actionHint: danger.action_hint,
    });
  });

  // Dose warnings
  results.dose_warnings.forEach((warning, i) => {
    alerts.push({
      id: `dose-${i}`,
      type: "dose",
      severity: "warning",
      title: `Dose Issue: ${warning.medication}`,
      message: warning.message,
    });
  });

  // Emergency patterns
  results.emergency_patterns.forEach((pattern, i) => {
    alerts.push({
      id: `emergency-${i}`,
      type: "emergency",
      severity: pattern.severity,
      title: pattern.pattern,
      message: pattern.message,
      actionHint: pattern.action_hint,
    });
  });

  // Context completeness issues
  results.context_completeness.issues.forEach((issue, i) => {
    alerts.push({
      id: `context-${i}`,
      type: "context",
      severity: issue.severity,
      title: `Missing: ${issue.field}`,
      message: issue.message,
    });
  });

  return alerts;
}
