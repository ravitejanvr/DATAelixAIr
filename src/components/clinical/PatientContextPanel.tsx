import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { Chip, ChipGroup, PresetChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, FileText, Search, User } from "lucide-react";

interface PatientContextPanelProps {
  patientSelected: boolean;
  symptoms: string[];
  filteredSymptoms: string[];
  symptomSearch: string;
  onSymptomSearchChange: (v: string) => void;
  onToggleSymptom: (symptom: string) => void;
  selectedDuration: string;
  durationOptions: string[];
  onDurationSelect: (v: string) => void;
  priorMeds: string[];
  medicationOptions: string[];
  onTogglePriorMed: (v: string) => void;
  vitals: Record<string, any> | null;
  onVitalChange: (field: string, value: string) => void;
  allergies: string[];
  medicationHistory: string[];
  previousReportsCount?: number;
}

const vitalFields = [
  { key: "temperature", label: "Temp °F" },
  { key: "bp_systolic", label: "BP SYS" },
  { key: "bp_diastolic", label: "BP DIA" },
  { key: "pulse", label: "Pulse" },
  { key: "spo2", label: "SpO₂" },
  { key: "respiratory_rate", label: "RR" },
];

export default function PatientContextPanel(props: PatientContextPanelProps) {
  const {
    patientSelected,
    symptoms,
    filteredSymptoms,
    symptomSearch,
    onSymptomSearchChange,
    onToggleSymptom,
    selectedDuration,
    durationOptions,
    onDurationSelect,
    priorMeds,
    medicationOptions,
    onTogglePriorMed,
    vitals,
    onVitalChange,
    allergies,
    medicationHistory,
    previousReportsCount = 0,
  } = props;

  if (!patientSelected) {
    return (
      <ClinicalCard className="p-3">
        <div className="text-xs text-muted-foreground">Select a patient to start consultation context.</div>
      </ClinicalCard>
    );
  }

  return (
    <div className="space-y-2">
      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Patient Snapshot" icon={<User className="h-3.5 w-3.5" />} />
        <div className="flex flex-wrap gap-1">
          {allergies.slice(0, 3).map((a) => (
            <Chip key={a} variant="alert" size="sm">{a}</Chip>
          ))}
          {allergies.length === 0 && <Badge variant="outline" className="text-[10px]">No allergy alerts</Badge>}
        </div>
      </ClinicalCard>

      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Vitals" icon={<Activity className="h-3.5 w-3.5" />} />
        <div className="grid grid-cols-2 gap-1.5">
          {vitalFields.map((field) => (
            <Input
              key={field.key}
              value={vitals?.[field.key] ?? ""}
              onChange={(e) => onVitalChange(field.key, e.target.value)}
              placeholder={field.label}
              className="h-8 text-xs"
            />
          ))}
        </div>
      </ClinicalCard>

      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Symptoms" icon={<Search className="h-3.5 w-3.5" />} />
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={symptomSearch}
            onChange={(e) => onSymptomSearchChange(e.target.value)}
            placeholder="Search symptoms"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {filteredSymptoms.slice(0, 12).map((symptom) => (
            <Chip
              key={symptom}
              variant="symptom"
              selected={symptoms.includes(symptom)}
              onClick={() => onToggleSymptom(symptom)}
              size="sm"
            >
              {symptom}
            </Chip>
          ))}
        </div>
        <div className="mt-2">
          <ChipGroup label="Duration">
            {durationOptions.map((duration) => (
              <Chip
                key={duration}
                variant="neutral"
                selected={selectedDuration === duration}
                size="sm"
                onClick={() => onDurationSelect(duration)}
              >
                {duration}
              </Chip>
            ))}
          </ChipGroup>
        </div>
      </ClinicalCard>

      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Medication History" icon={<FileText className="h-3.5 w-3.5" />} />
        <PresetChipGroup
          label="Taken Medications"
          options={medicationOptions}
          selected={priorMeds}
          onToggle={onTogglePriorMed}
          variant="medication"
          allowCustom
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {medicationHistory.slice(0, 5).map((med) => (
            <Chip key={med} variant="medication" size="sm">{med}</Chip>
          ))}
          <Badge variant="outline" className="text-[10px]">Reports: {previousReportsCount}</Badge>
        </div>
      </ClinicalCard>
    </div>
  );
}
