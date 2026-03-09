import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { ClinicalCard, ClinicalCardHeader, SkeletonCard } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  Receipt, Plus, Trash2, Printer, Search, IndianRupee,
  Clock, CheckCircle2, AlertCircle
} from "lucide-react";

interface LineItem { description: string; amount: string; }

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [consultationFee, setConsultationFee] = useState("500");
  const [procedures, setProcedures] = useState<LineItem[]>([]);
  const [labCharges, setLabCharges] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  // Summary stats
  const pendingCount = recentInvoices.filter(i => i.status === "pending").length;
  const paidToday = recentInvoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
  const outstandingTotal = recentInvoices.filter(i => i.status === "pending").reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);

  useEffect(() => {
    if (!user) return;
    loadPatients();
    loadRecentInvoices();
  }, [user]);

  const loadPatients = async () => {
    const { data } = await supabase.from("patients").select("id, name, age, gender, phone").order("created_at", { ascending: false });
    setPatients(data || []);
  };

  const loadRecentInvoices = async () => {
    setLoadingInvoices(true);
    const { data } = await supabase.from("invoices").select("*, patients(name)").order("created_at", { ascending: false }).limit(15) as any;
    setRecentInvoices(data || []);
    setLoadingInvoices(false);
  };

  const total = () => {
    const fee = parseFloat(consultationFee) || 0;
    const procTotal = procedures.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const labTotal = labCharges.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    return Math.max(0, fee + procTotal + labTotal - (parseFloat(discount) || 0));
  };

  const saveInvoice = async () => {
    if (!selectedPatient || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice", {
        body: {
          patient_id: selectedPatient.id, consultation_fee: consultationFee,
          procedures: procedures.filter(p => p.description),
          lab_charges: labCharges.filter(l => l.description),
          discount, payment_mode: paymentMode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Invoice saved", description: `${data.invoice_number} — ₹${data.total}` });
      loadRecentInvoices();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Invoice</title><style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto}table{width:100%;border-collapse:collapse}td,th{padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:13px}.total{font-weight:bold;font-size:15px}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const filtered = patients.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search)
  );

  const summaryCards = [
    { label: "Pending Invoices", value: pendingCount, icon: Clock, accent: "text-chip-lab-text", bg: "bg-chip-lab" },
    { label: "Paid Today", value: `₹${paidToday}`, icon: CheckCircle2, accent: "text-chip-medication-text", bg: "bg-chip-medication" },
    { label: "Outstanding", value: `₹${outstandingTotal}`, icon: AlertCircle, accent: "text-chip-alert-text", bg: "bg-chip-alert" },
  ];

  return (
    <>
      <SEO title="Billing — DATAelixAIr" description="Consultation billing" />
      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Billing
          </h1>
          <p className="text-xs text-muted-foreground">Simple consultation billing</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          {summaryCards.map(s => (
            <ClinicalCard key={s.label}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.accent}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">{loadingInvoices ? "—" : s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            </ClinicalCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Patient Select */}
          <ClinicalCard>
            <ClinicalCardHeader title="Select Patient" icon={<Search className="h-4 w-4" />} />
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8 text-xs rounded-xl" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {filtered.slice(0, 15).map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className={`w-full text-left p-2 rounded-xl text-sm transition-colors ${selectedPatient?.id === p.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                >
                  <p className="font-medium text-xs">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.phone || ""}</p>
                </button>
              ))}
            </div>
          </ClinicalCard>

          {/* Invoice Form */}
          <div className="lg:col-span-2 space-y-4">
            {selectedPatient ? (
              <ClinicalCard>
                <ClinicalCardHeader title={`Invoice — ${selectedPatient.name}`} icon={<IndianRupee className="h-4 w-4" />} />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Consultation Fee (₹)</label>
                      <Input value={consultationFee} onChange={e => setConsultationFee(e.target.value)} className="h-8 mt-1 rounded-xl text-xs" type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Payment Mode</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {["cash", "upi", "card"].map(m => (
                          <Chip key={m} variant={paymentMode === m ? "action" : "neutral"} selected={paymentMode === m} onClick={() => setPaymentMode(m)} size="sm" className="capitalize">{m}</Chip>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Procedures */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-muted-foreground font-medium">Procedures</label>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setProcedures([...procedures, { description: "", amount: "" }])}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {procedures.map((p, i) => (
                      <div key={i} className="flex gap-2 mb-1.5">
                        <Input value={p.description} onChange={e => { const n = [...procedures]; n[i].description = e.target.value; setProcedures(n); }} placeholder="Description" className="h-7 text-xs flex-1 rounded-lg" />
                        <Input value={p.amount} onChange={e => { const n = [...procedures]; n[i].amount = e.target.value; setProcedures(n); }} placeholder="₹" className="h-7 text-xs w-20 rounded-lg" type="number" />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setProcedures(procedures.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>

                  {/* Lab */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-muted-foreground font-medium">Lab Charges</label>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setLabCharges([...labCharges, { description: "", amount: "" }])}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {labCharges.map((l, i) => (
                      <div key={i} className="flex gap-2 mb-1.5">
                        <Input value={l.description} onChange={e => { const n = [...labCharges]; n[i].description = e.target.value; setLabCharges(n); }} placeholder="Test" className="h-7 text-xs flex-1 rounded-lg" />
                        <Input value={l.amount} onChange={e => { const n = [...labCharges]; n[i].amount = e.target.value; setLabCharges(n); }} placeholder="₹" className="h-7 text-xs w-20 rounded-lg" type="number" />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setLabCharges(labCharges.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">Discount (₹)</label>
                    <Input value={discount} onChange={e => setDiscount(e.target.value)} className="h-8 mt-1 w-28 rounded-xl text-xs" type="number" />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-xl font-bold text-primary">₹{total()}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveInvoice} disabled={saving} className="flex-1 rounded-xl">{saving ? "Saving..." : "Save Invoice"}</Button>
                    <Button variant="outline" onClick={handlePrint} className="rounded-xl"><Printer className="h-4 w-4" /></Button>
                  </div>
                </div>
              </ClinicalCard>
            ) : (
              <ClinicalCard className="py-14 text-center">
                <Receipt className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select a patient to generate an invoice</p>
              </ClinicalCard>
            )}

            {/* Recent Invoices as cards */}
            {recentInvoices.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Recent Invoices</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentInvoices.map((inv: any) => (
                    <ClinicalCard key={inv.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{(inv.patients as any)?.name || "Patient"}</p>
                          <p className="text-[10px] text-muted-foreground">{inv.invoice_number} · {new Date(inv.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">₹{inv.total}</p>
                          <Chip variant={inv.status === "paid" ? "medication" : "lab"} size="sm">{inv.status || "pending"}</Chip>
                        </div>
                      </div>
                    </ClinicalCard>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden print template */}
        <div ref={printRef} className="hidden">
          {selectedPatient && (
            <div>
              <h2>DATAelixAIr — Invoice</h2>
              <p>Patient: {selectedPatient.name}</p>
              <p>Date: {new Date().toLocaleDateString()}</p>
              <table>
                <thead><tr><th>Item</th><th>Amount</th></tr></thead>
                <tbody>
                  <tr><td>Consultation Fee</td><td>₹{consultationFee}</td></tr>
                  {procedures.filter(p => p.description).map((p, i) => <tr key={i}><td>{p.description}</td><td>₹{p.amount}</td></tr>)}
                  {labCharges.filter(l => l.description).map((l, i) => <tr key={i}><td>{l.description}</td><td>₹{l.amount}</td></tr>)}
                  {parseFloat(discount) > 0 && <tr><td>Discount</td><td>-₹{discount}</td></tr>}
                </tbody>
              </table>
              <p className="total">Total: ₹{total()}</p>
              <p>Payment: {paymentMode}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
