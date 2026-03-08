import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, CreditCard, Pill, FlaskConical, Save, Loader2,
  Plus, Trash2, CheckCircle, Building2, IndianRupee, TestTube
} from "lucide-react";

interface ClinicSettings {
  id?: string;
  clinic_id: string;
  consultation_fee: number;
  followup_fee: number;
  currency: string;
  payment_methods: string[];
  lab_margin: number;
  default_prescription_templates: PrescriptionTemplate[];
  doctor_templates: PrescriptionTemplate[];
}

interface PrescriptionTemplate {
  name: string;
  drugs: { drug_name: string; dosage: string; frequency: string; duration: string; instructions: string }[];
}

interface LabCatalogItem {
  id?: string;
  test_name: string;
  test_code: string;
  category: string;
  price: number;
  external_lab_partner: string;
  is_active: boolean;
}

const PAYMENT_OPTIONS = ["cash", "upi", "card", "netbanking", "insurance"];
const LAB_CATEGORIES = ["general", "hematology", "biochemistry", "microbiology", "immunology", "radiology", "pathology"];

const fadeIn = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } };

export default function ClinicAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [clinicId, setClinicId] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "templates" | "lab">("general");

  // Settings state
  const [settings, setSettings] = useState<ClinicSettings>({
    clinic_id: "",
    consultation_fee: 500,
    followup_fee: 300,
    currency: "INR",
    payment_methods: ["cash", "upi"],
    lab_margin: 0,
    default_prescription_templates: [],
    doctor_templates: [],
  });

  // Lab catalog
  const [labCatalog, setLabCatalog] = useState<LabCatalogItem[]>([]);
  const [newLabItem, setNewLabItem] = useState<LabCatalogItem>({
    test_name: "", test_code: "", category: "general", price: 0, external_lab_partner: "", is_active: true,
  });

  // Template builder
  const [newTemplate, setNewTemplate] = useState<PrescriptionTemplate>({ name: "", drugs: [] });
  const [newTemplateDrug, setNewTemplateDrug] = useState({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "" });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get clinic ID from profile
      const { data: profile } = await supabase.from("profiles").select("clinic_id, clinic_name").eq("user_id", user!.id).maybeSingle();
      if (!profile?.clinic_id) { setLoading(false); return; }
      setClinicId(profile.clinic_id);
      setClinicName(profile.clinic_name || "");

      // Load settings
      const { data: settingsData } = await supabase.from("clinic_settings")
        .select("*").eq("clinic_id", profile.clinic_id).maybeSingle();

      if (settingsData) {
        setSettings({
          id: settingsData.id,
          clinic_id: settingsData.clinic_id,
          consultation_fee: Number(settingsData.consultation_fee) || 500,
          followup_fee: Number(settingsData.followup_fee) || 300,
          currency: settingsData.currency || "INR",
          payment_methods: Array.isArray(settingsData.payment_methods) ? settingsData.payment_methods as string[] : ["cash", "upi"],
          lab_margin: Number(settingsData.lab_margin) || 0,
          default_prescription_templates: Array.isArray(settingsData.default_prescription_templates) ? settingsData.default_prescription_templates as unknown as PrescriptionTemplate[] : [],
          doctor_templates: Array.isArray(settingsData.doctor_templates) ? settingsData.doctor_templates as unknown as PrescriptionTemplate[] : [],
        });
      } else {
        setSettings(prev => ({ ...prev, clinic_id: profile.clinic_id }));
      }

      // Load lab catalog
      const { data: labData } = await supabase.from("lab_catalog")
        .select("*").eq("clinic_id", profile.clinic_id).order("test_name");
      if (labData) setLabCatalog(labData.map(l => ({
        id: l.id, test_name: l.test_name, test_code: l.test_code || "",
        category: l.category || "general", price: Number(l.price) || 0,
        external_lab_partner: l.external_lab_partner || "", is_active: l.is_active !== false,
      })));
    } catch (err: any) {
      toast({ title: "Failed to load settings", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const saveSettings = async () => {
    if (!clinicId) return;
    setSaving(true);
    try {
      const payload = {
        clinic_id: clinicId,
        consultation_fee: settings.consultation_fee,
        followup_fee: settings.followup_fee,
        currency: settings.currency,
        payment_methods: settings.payment_methods as unknown as import("@/integrations/supabase/types").Json,
        lab_margin: settings.lab_margin,
        default_prescription_templates: settings.default_prescription_templates as unknown as import("@/integrations/supabase/types").Json,
        doctor_templates: settings.doctor_templates as unknown as import("@/integrations/supabase/types").Json,
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        const { error } = await supabase.from("clinic_settings").update(payload).eq("id", settings.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("clinic_settings").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      // Also sync consultation fee to workflow config
      await supabase.from("clinic_workflow_config")
        .upsert({ clinic_id: clinicId, default_consultation_fee: settings.consultation_fee }, { onConflict: "clinic_id" });

      toast({ title: "Settings saved", description: "Clinic configuration updated successfully." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const addLabItem = async () => {
    if (!clinicId || !newLabItem.test_name.trim()) return;
    try {
      const { data, error } = await supabase.from("lab_catalog").insert({
        clinic_id: clinicId,
        test_name: newLabItem.test_name.trim(),
        test_code: newLabItem.test_code.trim() || null,
        category: newLabItem.category,
        price: newLabItem.price,
        external_lab_partner: newLabItem.external_lab_partner.trim() || null,
        is_active: true,
      }).select("id").single();
      if (error) throw new Error(error.message);
      setLabCatalog(prev => [...prev, { ...newLabItem, id: data.id }]);
      setNewLabItem({ test_name: "", test_code: "", category: "general", price: 0, external_lab_partner: "", is_active: true });
      toast({ title: "Test added", description: `${newLabItem.test_name} added to lab catalog.` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const removeLabItem = async (id: string) => {
    try {
      const { error } = await supabase.from("lab_catalog").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setLabCatalog(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const addTemplate = () => {
    if (!newTemplate.name.trim() || newTemplate.drugs.length === 0) return;
    setSettings(prev => ({
      ...prev,
      default_prescription_templates: [...prev.default_prescription_templates, { ...newTemplate }],
    }));
    setNewTemplate({ name: "", drugs: [] });
    toast({ title: "Template added", description: "Don't forget to save settings." });
  };

  const removeTemplate = (idx: number) => {
    setSettings(prev => ({
      ...prev,
      default_prescription_templates: prev.default_prescription_templates.filter((_, i) => i !== idx),
    }));
  };

  const addDrugToTemplate = () => {
    if (!newTemplateDrug.drug_name.trim()) return;
    setNewTemplate(prev => ({ ...prev, drugs: [...prev.drugs, { ...newTemplateDrug }] }));
    setNewTemplateDrug({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  };

  const togglePaymentMethod = (method: string) => {
    setSettings(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(method)
        ? prev.payment_methods.filter(m => m !== method)
        : [...prev.payment_methods, method],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinicId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <ClinicalCard className="max-w-md p-8 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">No Clinic Assigned</h2>
          <p className="text-sm text-muted-foreground">Your account is not associated with a clinic. Contact your administrator.</p>
        </ClinicalCard>
      </div>
    );
  }

  return (
    <>
      <SEO title="Clinic Settings — DATAelixAIr" description="Configure clinic fees, templates, and lab catalog" />
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Clinic Settings
            </h1>
            <p className="text-sm text-muted-foreground">{clinicName || "Configure your clinic"}</p>
          </div>
          <Button onClick={saveSettings} disabled={saving} className="gap-2 rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border">
          {([
            { key: "general" as const, label: "Fees & Payment", icon: CreditCard },
            { key: "templates" as const, label: "Rx Templates", icon: Pill },
            { key: "lab" as const, label: "Lab Catalog", icon: FlaskConical },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── General Settings Tab ── */}
        <AnimatePresence mode="wait">
          {activeTab === "general" && (
            <motion.div key="general" {...fadeIn} className="space-y-4">
              {/* Consultation Fees */}
              <ClinicalCard>
                <ClinicalCardHeader title="Consultation Fees" icon={<IndianRupee className="h-4 w-4" />} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Consultation Fee (₹)</Label>
                    <Input
                      type="number"
                      value={settings.consultation_fee}
                      onChange={e => setSettings(prev => ({ ...prev, consultation_fee: Number(e.target.value) || 0 }))}
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Follow-up Fee (₹)</Label>
                    <Input
                      type="number"
                      value={settings.followup_fee}
                      onChange={e => setSettings(prev => ({ ...prev, followup_fee: Number(e.target.value) || 0 }))}
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Lab Margin (%)</Label>
                    <Input
                      type="number"
                      value={settings.lab_margin}
                      onChange={e => setSettings(prev => ({ ...prev, lab_margin: Number(e.target.value) || 0 }))}
                      className="mt-1 rounded-lg"
                    />
                  </div>
                </div>
              </ClinicalCard>

              {/* Payment Methods */}
              <ClinicalCard>
                <ClinicalCardHeader title="Payment Methods" icon={<CreditCard className="h-4 w-4" />} />
                <div className="flex flex-wrap gap-2 mt-3">
                  {PAYMENT_OPTIONS.map(method => (
                    <Chip
                      key={method}
                      variant={settings.payment_methods.includes(method) ? "medication" : "neutral"}
                      selected={settings.payment_methods.includes(method)}
                      onClick={() => togglePaymentMethod(method)}
                      className="capitalize"
                    >
                      {method}
                    </Chip>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Selected methods will appear in the checkout screen during billing.
                </p>
              </ClinicalCard>

              {/* Currency */}
              <ClinicalCard>
                <ClinicalCardHeader title="Currency" icon={<IndianRupee className="h-4 w-4" />} />
                <div className="flex gap-2 mt-3">
                  {["INR", "USD", "GBP", "EUR"].map(cur => (
                    <Chip
                      key={cur}
                      variant={settings.currency === cur ? "medication" : "neutral"}
                      selected={settings.currency === cur}
                      onClick={() => setSettings(prev => ({ ...prev, currency: cur }))}
                    >
                      {cur}
                    </Chip>
                  ))}
                </div>
              </ClinicalCard>
            </motion.div>
          )}

          {/* ── Prescription Templates Tab ── */}
          {activeTab === "templates" && (
            <motion.div key="templates" {...fadeIn} className="space-y-4">
              {/* Existing Templates */}
              {settings.default_prescription_templates.map((tpl, idx) => (
                <ClinicalCard key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">{tpl.name}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-chip-alert-text" onClick={() => removeTemplate(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.drugs.map((d, di) => (
                      <Chip key={di} variant="medication" size="sm">
                        {d.drug_name} {d.dosage} {d.frequency}
                      </Chip>
                    ))}
                  </div>
                </ClinicalCard>
              ))}

              {/* New Template Builder */}
              <ClinicalCard className="border-primary/15">
                <ClinicalCardHeader title="Add Template" icon={<Plus className="h-4 w-4" />} />
                <div className="space-y-3 mt-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Template Name</Label>
                    <Input
                      value={newTemplate.name}
                      onChange={e => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Viral Fever Standard"
                      className="mt-1 rounded-lg"
                    />
                  </div>

                  {/* Drugs in template */}
                  {newTemplate.drugs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {newTemplate.drugs.map((d, i) => (
                        <Chip key={i} variant="medication" size="sm">
                          {d.drug_name} {d.dosage}
                        </Chip>
                      ))}
                    </div>
                  )}

                  {/* Add drug to template */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <Input
                      value={newTemplateDrug.drug_name}
                      onChange={e => setNewTemplateDrug(prev => ({ ...prev, drug_name: e.target.value }))}
                      placeholder="Drug name"
                      className="rounded-lg text-xs"
                    />
                    <Input
                      value={newTemplateDrug.dosage}
                      onChange={e => setNewTemplateDrug(prev => ({ ...prev, dosage: e.target.value }))}
                      placeholder="Dosage"
                      className="rounded-lg text-xs"
                    />
                    <Input
                      value={newTemplateDrug.frequency}
                      onChange={e => setNewTemplateDrug(prev => ({ ...prev, frequency: e.target.value }))}
                      placeholder="Freq"
                      className="rounded-lg text-xs"
                    />
                    <Input
                      value={newTemplateDrug.duration}
                      onChange={e => setNewTemplateDrug(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="Duration"
                      className="rounded-lg text-xs"
                    />
                    <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1" onClick={addDrugToTemplate}>
                      <Plus className="h-3 w-3" /> Drug
                    </Button>
                  </div>

                  <Button onClick={addTemplate} disabled={!newTemplate.name.trim() || newTemplate.drugs.length === 0} className="rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> Add Template
                  </Button>
                </div>
              </ClinicalCard>

              {settings.default_prescription_templates.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No templates yet. Create your first prescription template above.
                </div>
              )}
            </motion.div>
          )}

          {/* ── Lab Catalog Tab ── */}
          {activeTab === "lab" && (
            <motion.div key="lab" {...fadeIn} className="space-y-4">
              {/* Add Lab Test */}
              <ClinicalCard className="border-primary/15">
                <ClinicalCardHeader title="Add Lab Test" icon={<Plus className="h-4 w-4" />} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Test Name</Label>
                    <Input
                      value={newLabItem.test_name}
                      onChange={e => setNewLabItem(prev => ({ ...prev, test_name: e.target.value }))}
                      placeholder="e.g., CBC"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Test Code</Label>
                    <Input
                      value={newLabItem.test_code}
                      onChange={e => setNewLabItem(prev => ({ ...prev, test_code: e.target.value }))}
                      placeholder="e.g., 85025"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price (₹)</Label>
                    <Input
                      type="number"
                      value={newLabItem.price}
                      onChange={e => setNewLabItem(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <select
                      value={newLabItem.category}
                      onChange={e => setNewLabItem(prev => ({ ...prev, category: e.target.value }))}
                      className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-border bg-background"
                    >
                      {LAB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">External Lab</Label>
                    <Input
                      value={newLabItem.external_lab_partner}
                      onChange={e => setNewLabItem(prev => ({ ...prev, external_lab_partner: e.target.value }))}
                      placeholder="Partner name"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addLabItem} disabled={!newLabItem.test_name.trim()} className="w-full rounded-xl gap-2">
                      <Plus className="h-4 w-4" /> Add Test
                    </Button>
                  </div>
                </div>
              </ClinicalCard>

              {/* Lab Catalog List */}
              {labCatalog.length > 0 ? (
                <ClinicalCard>
                  <ClinicalCardHeader
                    title="Lab Catalog"
                    icon={<TestTube className="h-4 w-4" />}
                    badge={<Badge variant="outline" className="text-[10px]">{labCatalog.length} tests</Badge>}
                  />
                  <div className="mt-3 space-y-2">
                    {labCatalog.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/50 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <Chip variant="lab" size="sm">{item.test_name}</Chip>
                          {item.test_code && <span className="text-[10px] text-muted-foreground font-mono">{item.test_code}</span>}
                          <Badge variant="outline" className="text-[9px] capitalize">{item.category}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-foreground">₹{item.price}</span>
                          {item.external_lab_partner && <span className="text-[10px] text-muted-foreground">{item.external_lab_partner}</span>}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-chip-alert-text" onClick={() => removeLabItem(item.id!)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ClinicalCard>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No lab tests configured. Add tests above to build your clinic's lab catalog.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
