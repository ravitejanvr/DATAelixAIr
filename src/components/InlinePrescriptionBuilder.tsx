import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pill, Plus, X, AlertTriangle, Star, Loader2 } from "lucide-react";

interface DrugEntry {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
}

const EMPTY_DRUG: DrugEntry = { drug_name: "", dosage: "", frequency: "Once daily", duration: "5 days", route: "Oral", instructions: "" };

const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Every 6 hours", "Every 8 hours", "Every 12 hours", "At bedtime", "As needed"];
const ROUTES = ["Oral", "Topical", "Intravenous", "Intramuscular", "Sublingual", "Inhaled", "Rectal"];

interface ExternalDrug {
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
}

interface InlinePrescriptionBuilderProps {
  patientId: string | null;
  consultationId: string | null;
  patientAllergies: string[];
  externalDrugs?: ExternalDrug[];
}

export default function InlinePrescriptionBuilder({ patientId, consultationId, patientAllergies, externalDrugs }: InlinePrescriptionBuilderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [drugs, setDrugs] = useState<DrugEntry[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [addedExternal, setAddedExternal] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    supabase.from("doctor_favorites").select("*").eq("doctor_id", user.id).then(({ data }) => {
      if (data) setFavorites(data);
    });
  }, [user]);

  // Auto-add drugs from Smart Suggestions panel
  useEffect(() => {
    if (!externalDrugs?.length) return;
    const newDrugs: DrugEntry[] = [];
    const newKeys = new Set(addedExternal);
    for (const ext of externalDrugs) {
      const key = `${ext.drug_name}|${ext.dose}`;
      if (!newKeys.has(key)) {
        newKeys.add(key);
        newDrugs.push({
          drug_name: ext.drug_name,
          dosage: ext.dose,
          frequency: ext.frequency || "Once daily",
          duration: ext.duration || "5 days",
          route: "Oral",
          instructions: "",
        });
      }
    }
    if (newDrugs.length > 0) {
      setAddedExternal(newKeys);
      setDrugs(prev => [...prev, ...newDrugs]);
    }
  }, [externalDrugs]);

  const addDrug = (template?: Partial<DrugEntry>) => {
    setDrugs(prev => [...prev, { ...EMPTY_DRUG, ...template }]);
  };

  const updateDrug = (i: number, field: keyof DrugEntry, value: string) => {
    setDrugs(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  };

  const removeDrug = (i: number) => setDrugs(prev => prev.filter((_, idx) => idx !== i));

  // Simple allergy check
  const checkAllergyConflict = (drugName: string): string | null => {
    const lower = drugName.toLowerCase();
    for (const a of patientAllergies) {
      if (lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower)) {
        return `⚠ Possible allergy conflict with "${a}"`;
      }
    }
    return null;
  };

  const savePrescriptions = async () => {
    if (!user || !patientId || !consultationId) {
      toast({ title: "Cannot save", description: "Save the consultation first to attach prescriptions.", variant: "destructive" });
      return;
    }
    const valid = drugs.filter(d => d.drug_name.trim());
    if (valid.length === 0) return;
    setSaving(true);
    try {
      const rows = valid.map(d => ({
        patient_id: patientId,
        doctor_id: user.id,
        consultation_id: consultationId,
        drug_name: d.drug_name,
        dosage: d.dosage,
        frequency: d.frequency,
        duration: d.duration,
        route: d.route,
        instructions: d.instructions,
      }));
      const { error } = await supabase.from("prescriptions").insert(rows);
      if (error) throw new Error(error.message);
      toast({ title: "Prescriptions saved" });
      setDrugs([]);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      {/* Favorites quick-add */}
      {favorites.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {favorites.slice(0, 6).map(f => (
            <button
              key={f.id}
              onClick={() => addDrug({ drug_name: f.generic_name, dosage: f.default_dose || "", frequency: f.frequency || "Once daily", duration: f.duration || "5 days", route: f.route || "Oral", instructions: f.instructions || "" })}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-background hover:border-primary/30 transition-colors text-[9px]"
            >
              <Star className="h-2 w-2 text-primary" />{f.generic_name}
            </button>
          ))}
        </div>
      )}

      {/* Drug cards */}
      {drugs.map((d, i) => {
        const allergyWarning = checkAllergyConflict(d.drug_name);
        return (
          <div key={i} className="p-2 rounded-lg border border-border bg-background space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                <Input value={d.drug_name} onChange={e => updateDrug(i, "drug_name", e.target.value)} placeholder="Medication name" className="h-7 text-[11px]" />
                <Input value={d.dosage} onChange={e => updateDrug(i, "dosage", e.target.value)} placeholder="Dose (e.g. 500mg)" className="h-7 text-[11px]" />
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 shrink-0" onClick={() => removeDrug(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Select value={d.frequency} onValueChange={v => updateDrug(i, "frequency", v)}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={d.duration} onChange={e => updateDrug(i, "duration", e.target.value)} placeholder="Duration" className="h-7 text-[10px]" />
              <Select value={d.route} onValueChange={v => updateDrug(i, "route", v)}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>{ROUTES.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input value={d.instructions} onChange={e => updateDrug(i, "instructions", e.target.value)} placeholder="Instructions (e.g. after food)" className="h-7 text-[10px]" />
            {allergyWarning && (
              <div className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" />{allergyWarning}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 flex-1" onClick={() => addDrug()}>
          <Plus className="h-3 w-3" /> Add Medication
        </Button>
        {drugs.length > 0 && (
          <Button size="sm" className="h-7 text-[10px] gap-1" onClick={savePrescriptions} disabled={saving || !consultationId}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pill className="h-3 w-3" />} Save Rx
          </Button>
        )}
      </div>
      {!consultationId && drugs.length > 0 && (
        <p className="text-[9px] text-muted-foreground">Save & finalize the consultation first to attach prescriptions.</p>
      )}
    </div>
  );
}
