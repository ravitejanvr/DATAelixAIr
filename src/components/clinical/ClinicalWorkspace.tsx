import { useMemo, useState } from "react";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pill, Stethoscope } from "lucide-react";
import type { SoapSections } from "@/layers/ai-agents/api";

interface MedicationSuggestion {
  label: string;
  genericName: string;
}

interface ClinicalWorkspaceProps {
  soapSections: SoapSections;
  onUpdateSoap: (section: keyof SoapSections, value: string) => void;
  selectedDiagnoses: string[];
  selectedTests: string[];
  selectedMedications: Array<{ drug_name: string; dose: string; frequency: string; duration: string }>;
  onRemoveDiagnosis: (diagnosis: string) => void;
  onRemoveLab: (lab: string) => void;
  onRemoveMedication: (index: number) => void;
  medicationQuery: string;
  onMedicationQueryChange: (value: string) => void;
  medicationSuggestions: MedicationSuggestion[];
  medicationLoading: boolean;
  onSelectMedicationSuggestion: (item: MedicationSuggestion) => void;
}

export default function ClinicalWorkspace({
  soapSections,
  onUpdateSoap,
  selectedDiagnoses,
  selectedTests,
  selectedMedications,
  onRemoveDiagnosis,
  onRemoveLab,
  onRemoveMedication,
  medicationQuery,
  onMedicationQueryChange,
  medicationSuggestions,
  medicationLoading,
  onSelectMedicationSuggestion,
}: ClinicalWorkspaceProps) {
  const [openSuggestionList, setOpenSuggestionList] = useState(false);

  const planSummary = useMemo(
    () => `${selectedMedications.length} meds • ${selectedTests.length} labs`,
    [selectedMedications.length, selectedTests.length],
  );

  return (
    <div className="space-y-2 pb-20">
      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Subjective" icon={<Stethoscope className="h-3.5 w-3.5" />} />
        <Textarea
          value={soapSections["Visit Summary"]}
          onChange={(e) => onUpdateSoap("Visit Summary", e.target.value)}
          className="min-h-[84px] text-xs"
          placeholder="Auto-updated from symptoms and doctor input"
        />
      </ClinicalCard>

      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Objective" />
        <Textarea
          value={soapSections["Findings"]}
          onChange={(e) => onUpdateSoap("Findings", e.target.value)}
          className="min-h-[84px] text-xs"
          placeholder="Auto-updated from vitals"
        />
      </ClinicalCard>

      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Assessment" badge={<Badge variant="outline" className="text-[10px]">{selectedDiagnoses.length} selected</Badge>} />
        <Textarea
          value={soapSections["Provisional Diagnosis"]}
          onChange={(e) => onUpdateSoap("Provisional Diagnosis", e.target.value)}
          className="min-h-[84px] text-xs"
          placeholder="Copilot diagnosis suggestions appear on the right"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedDiagnoses.slice(0, 6).map((diagnosis) => (
            <Chip key={diagnosis} variant="diagnosis" size="sm" selected removable onRemove={() => onRemoveDiagnosis(diagnosis)}>
              {diagnosis}
            </Chip>
          ))}
        </div>
      </ClinicalCard>

      <ClinicalCard className="p-3">
        <ClinicalCardHeader title="Plan" badge={<Badge variant="outline" className="text-[10px]">{planSummary}</Badge>} />

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Medication Search</p>
            <div className="relative">
              <Input
                value={medicationQuery}
                onFocus={() => setOpenSuggestionList(true)}
                onChange={(e) => {
                  onMedicationQueryChange(e.target.value);
                  setOpenSuggestionList(true);
                }}
                placeholder='Type medication (e.g. "para")'
                className="h-8 text-xs"
              />
              {openSuggestionList && medicationQuery.trim().length > 1 && (
                <div className="absolute left-0 right-0 top-9 z-10 rounded-lg border border-border bg-popover p-1 shadow-lg max-h-44 overflow-auto">
                  {medicationLoading ? (
                    <div className="p-2 text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Searching…</div>
                  ) : medicationSuggestions.length > 0 ? (
                    medicationSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.label}-${suggestion.genericName}`}
                        type="button"
                        onClick={() => {
                          onSelectMedicationSuggestion(suggestion);
                          setOpenSuggestionList(false);
                        }}
                        className="w-full text-left p-2 rounded-md text-xs hover:bg-muted"
                      >
                        {suggestion.label}
                      </button>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground">No suggestions found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {selectedMedications.slice(0, 6).map((rx, index) => (
              <Chip key={`${rx.drug_name}-${index}`} variant="medication" size="sm" selected removable onRemove={() => onRemoveMedication(index)}>
                {rx.drug_name} {rx.dose}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {selectedTests.slice(0, 6).map((test) => (
              <Chip key={test} variant="lab" size="sm" selected removable onRemove={() => onRemoveLab(test)}>
                {test}
              </Chip>
            ))}
          </div>

          <Textarea
            value={soapSections["Treatment Plan"]}
            onChange={(e) => onUpdateSoap("Treatment Plan", e.target.value)}
            className="min-h-[84px] text-xs"
            placeholder="Prescriptions, lab orders, and patient advice"
          />
          <Textarea
            value={soapSections["Advice"]}
            onChange={(e) => onUpdateSoap("Advice", e.target.value)}
            className="min-h-[64px] text-xs"
            placeholder="Patient advice"
          />
        </div>
      </ClinicalCard>
    </div>
  );
}
