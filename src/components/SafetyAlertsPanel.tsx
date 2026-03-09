/**
 * SafetyAlertsPanel — Displays clinical, medication, and diagnostic alerts
 * from the Global Clinical Safety Engine in the consultation cockpit.
 */

import { useState } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Pill,
  Stethoscope,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { severityColor } from "@/layers/safety/api";
import type {
  ClinicalAlert,
  MedicationAlertRecord,
  DiagnosticFlagRecord,
  SafetyEngineResult,
} from "@/layers/safety/api";

interface SafetyAlertsPanelProps {
  result?: SafetyEngineResult | null;
  clinicalAlerts?: ClinicalAlert[];
  medicationAlerts?: MedicationAlertRecord[];
  diagnosticFlags?: DiagnosticFlagRecord[];
  onAcknowledge?: (table: string, alertId: string) => void;
  loading?: boolean;
}

export function SafetyAlertsPanel({
  result,
  clinicalAlerts,
  medicationAlerts,
  diagnosticFlags,
  onAcknowledge,
  loading,
}: SafetyAlertsPanelProps) {
  const clinical = clinicalAlerts ?? result?.clinical_alerts ?? [];
  const medication = medicationAlerts ?? result?.medication_alerts ?? [];
  const diagnostic = diagnosticFlags ?? result?.diagnostic_flags ?? [];
  const summary = result?.summary;

  const totalAlerts = clinical.length + medication.length + diagnostic.length;

  const [clinicalOpen, setClinicalOpen] = useState(true);
  const [medicationOpen, setMedicationOpen] = useState(true);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <ShieldAlert className="h-4 w-4 animate-pulse" />
            Running Safety Engine...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (totalAlerts === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            No Safety Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Clinical Safety Engine found no concerns for this consultation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" />
            Safety Alerts ({totalAlerts})
          </span>
          {summary && (
            <div className="flex gap-1">
              {summary.critical_count > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {summary.critical_count} Critical
                </Badge>
              )}
              {summary.high_count > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 bg-orange-500 text-white">
                  {summary.high_count} High
                </Badge>
              )}
              {summary.warning_count > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-warning border-warning/30">
                  {summary.warning_count} Warning
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {/* Clinical Risk Alerts */}
        {clinical.length > 0 && (
          <Collapsible open={clinicalOpen} onOpenChange={setClinicalOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs font-medium text-foreground py-1">
              {clinicalOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <AlertTriangle className="h-3 w-3 text-destructive" />
              Clinical Risk ({clinical.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pl-5">
              {clinical.map((alert, i) => (
                <AlertItem
                  key={alert.id || i}
                  severity={alert.severity}
                  title={alert.title}
                  message={alert.message}
                  hint={alert.action_hint}
                  indicators={alert.matched_indicators}
                  acknowledged={!!alert.acknowledged_at}
                  onAcknowledge={
                    onAcknowledge && alert.id
                      ? () => onAcknowledge("clinical_alerts", alert.id!)
                      : undefined
                  }
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Medication Alerts */}
        {medication.length > 0 && (
          <Collapsible open={medicationOpen} onOpenChange={setMedicationOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs font-medium text-foreground py-1">
              {medicationOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Pill className="h-3 w-3 text-orange-500" />
              Medication Safety ({medication.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pl-5">
              {medication.map((alert, i) => (
                <AlertItem
                  key={alert.id || i}
                  severity={alert.severity}
                  title={alert.alert_type.replace(/_/g, " ")}
                  message={alert.message}
                  drugs={[alert.drug_a, alert.drug_b].filter(Boolean) as string[]}
                  acknowledged={!!alert.acknowledged_at}
                  onAcknowledge={
                    onAcknowledge && alert.id
                      ? () => onAcknowledge("medication_alerts", alert.id!)
                      : undefined
                  }
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Diagnostic Flags */}
        {diagnostic.length > 0 && (
          <Collapsible open={diagnosticOpen} onOpenChange={setDiagnosticOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs font-medium text-foreground py-1">
              {diagnosticOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Stethoscope className="h-3 w-3 text-blue-500" />
              Diagnostic Advisory ({diagnostic.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pl-5">
              {diagnostic.map((flag, i) => (
                <AlertItem
                  key={flag.id || i}
                  severity={flag.severity}
                  title={flag.flag_type.replace(/_/g, " ")}
                  message={flag.inconsistency_detail}
                  hint={flag.recommendation}
                  acknowledged={!!flag.acknowledged_at}
                  onAcknowledge={
                    onAcknowledge && flag.id
                      ? () => onAcknowledge("diagnostic_flags", flag.id!)
                      : undefined
                  }
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/30">
          Advisory only — does not override clinical judgment
        </p>
      </CardContent>
    </Card>
  );
}

function AlertItem({
  severity,
  title,
  message,
  hint,
  indicators,
  drugs,
  acknowledged,
  onAcknowledge,
}: {
  severity: string;
  title: string;
  message: string;
  hint?: string;
  indicators?: string[];
  drugs?: string[];
  acknowledged?: boolean;
  onAcknowledge?: () => void;
}) {
  return (
    <div className={`rounded-md border px-2.5 py-2 text-xs ${severityColor(severity)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="font-semibold capitalize">{title}</span>
          <p className="mt-0.5 text-[11px] opacity-90">{message}</p>
          {hint && (
            <p className="mt-1 text-[10px] flex items-start gap-1 opacity-75">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              {hint}
            </p>
          )}
          {indicators && indicators.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {indicators.map((ind) => (
                <Badge key={ind} variant="outline" className="text-[9px] px-1 py-0">
                  {ind}
                </Badge>
              ))}
            </div>
          )}
          {drugs && drugs.length > 0 && (
            <div className="flex gap-1 mt-1">
              {drugs.map((d) => (
                <Badge key={d} variant="secondary" className="text-[9px] px-1 py-0">
                  {d}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {onAcknowledge && !acknowledged && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAcknowledge}
            className="h-6 px-2 text-[10px] shrink-0"
          >
            Acknowledge
          </Button>
        )}
        {acknowledged && (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  );
}
