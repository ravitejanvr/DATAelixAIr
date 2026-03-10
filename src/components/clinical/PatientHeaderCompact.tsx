import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";

interface PatientHeaderCompactProps {
  patientName?: string;
  age?: number | null;
  gender?: string | null;
  visitId?: string | null;
  allergies?: string[];
  chronicConditions?: string[];
  onChangePatient?: () => void;
}

export default function PatientHeaderCompact({
  patientName,
  age,
  gender,
  visitId,
  allergies = [],
  chronicConditions = [],
  onChangePatient,
}: PatientHeaderCompactProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground truncate">
          {patientName || "Select Patient"}
          {patientName && (
            <span className="text-muted-foreground font-medium ml-2">
              | {age || "?"} {gender?.charAt(0)?.toUpperCase() || "?"}
            </span>
          )}
          {visitId && <span className="text-primary ml-2">| Visit #{visitId.slice(0, 4)}</span>}
        </p>
        {onChangePatient && patientName && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onChangePatient}>
            Change
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {allergies.slice(0, 3).map((allergy) => (
          <Chip key={allergy} variant="alert" size="sm">
            Allergy: {allergy}
          </Chip>
        ))}
        {chronicConditions.slice(0, 3).map((condition) => (
          <Chip key={condition} variant="diagnosis" size="sm">
            Condition: {condition}
          </Chip>
        ))}
        {allergies.length === 0 && chronicConditions.length === 0 && (
          <Badge variant="outline" className="text-[10px]">
            No allergies/conditions recorded
          </Badge>
        )}
      </div>
    </div>
  );
}
