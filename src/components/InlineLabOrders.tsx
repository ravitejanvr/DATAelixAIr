import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Plus, X, Loader2, Search } from "lucide-react";

const COMMON_TESTS = ["CBC", "HbA1c", "Lipid Profile", "LFT", "KFT", "Thyroid Profile", "Urine Routine", "Blood Sugar (Fasting)", "Blood Sugar (PP)", "ESR", "CRP", "Serum Creatinine", "Uric Acid"];

interface LabOrder {
  test_name: string;
  priority: "routine" | "urgent";
  notes: string;
}

interface InlineLabOrdersProps {
  patientId: string | null;
  visitId: string | null;
  clinicId: string | null;
}

export default function InlineLabOrders({ patientId, visitId, clinicId }: InlineLabOrdersProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = COMMON_TESTS.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()) && !orders.some(o => o.test_name === t));

  const addTest = (name: string) => {
    setOrders(prev => [...prev, { test_name: name, priority: "routine", notes: "" }]);
    setSearchQuery("");
  };

  const removeTest = (i: number) => setOrders(prev => prev.filter((_, idx) => idx !== i));

  const togglePriority = (i: number) => {
    setOrders(prev => prev.map((o, idx) => idx === i ? { ...o, priority: o.priority === "routine" ? "urgent" : "routine" } : o));
  };

  const saveOrders = async () => {
    if (!user || !patientId || !visitId || !clinicId) {
      toast({ title: "Cannot save", description: "Save the consultation first to attach lab orders.", variant: "destructive" });
      return;
    }
    if (orders.length === 0) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("order-lab-tests", {
        body: {
          patient_id: patientId,
          visit_id: visitId,
          clinic_id: clinicId,
          orders,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Lab orders saved (${data?.count || 0} tests)` });
      setOrders([]);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      {/* Search & quick-add */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search tests (CBC, HbA1c…)"
          className="h-7 text-[10px] pl-7"
        />
      </div>

      {searchQuery && filtered.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filtered.slice(0, 6).map(t => (
            <button key={t} onClick={() => addTest(t)} className="px-2 py-0.5 rounded-full border border-border bg-background hover:border-primary/30 text-[9px] transition-colors">
              <Plus className="h-2 w-2 inline mr-0.5" />{t}
            </button>
          ))}
        </div>
      )}

      {/* Added tests */}
      {orders.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5 p-1.5 rounded border border-border bg-background">
          <FlaskConical className="h-3 w-3 text-primary shrink-0" />
          <span className="text-[11px] font-medium text-foreground flex-1">{o.test_name}</span>
          <button onClick={() => togglePriority(i)}>
            <Badge variant="outline" className={`text-[8px] cursor-pointer ${o.priority === "urgent" ? "border-destructive/30 text-destructive" : ""}`}>
              {o.priority}
            </Badge>
          </button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeTest(i)}>
            <X className="h-2.5 w-2.5" />
          </Button>
        </div>
      ))}

      {orders.length > 0 && (
        <Button size="sm" className="h-7 text-[10px] gap-1 w-full" onClick={saveOrders} disabled={saving || !visitId}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Save Lab Orders ({orders.length})
        </Button>
      )}
      {!visitId && orders.length > 0 && (
        <p className="text-[9px] text-muted-foreground">Save & finalize the consultation first to attach lab orders.</p>
      )}
    </div>
  );
}
