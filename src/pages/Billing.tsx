import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Receipt, Plus, Trash2, Printer, Search } from "lucide-react";

interface LineItem {
  description: string;
  amount: string;
}

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
  const printRef = useRef<HTMLDivElement>(null);

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
    const { data } = await supabase.from("invoices").select("*, patients(name)").order("created_at", { ascending: false }).limit(10) as any;
    setRecentInvoices(data || []);
  };

  const total = () => {
    const fee = parseFloat(consultationFee) || 0;
    const procTotal = procedures.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const labTotal = labCharges.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const disc = parseFloat(discount) || 0;
    return Math.max(0, fee + procTotal + labTotal - disc);
  };

  const saveInvoice = async () => {
    if (!selectedPatient || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice", {
        body: {
          patient_id: selectedPatient.id,
          consultation_fee: consultationFee,
          procedures: procedures.filter(p => p.description),
          lab_charges: labCharges.filter(l => l.description),
          discount,
          payment_mode: paymentMode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Invoice saved", description: `${data.invoice_number} — ₹${data.total}` });
      loadRecentInvoices();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
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

  return (
    <>
      <SEO title="Billing — DATAelixAIr" description="Generate invoices for consultations." />
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" /> Billing
        </h1>
        <p className="text-sm text-muted-foreground mb-6">Simple consultation billing. No insurance integration.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient select */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Select Patient</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-9" />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filtered.slice(0, 15).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left p-2 rounded-lg text-sm ${selectedPatient?.id === p.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.phone || ""}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Invoice form */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Invoice for {selectedPatient.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Consultation Fee (₹)</label>
                      <Input value={consultationFee} onChange={e => setConsultationFee(e.target.value)} className="h-9 mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Payment Mode</label>
                      <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="netbanking">Net Banking</option>
                      </select>
                    </div>
                  </div>

                  {/* Procedures */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] text-muted-foreground font-medium">Procedures</label>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setProcedures([...procedures, { description: "", amount: "" }])}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {procedures.map((p, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <Input value={p.description} onChange={e => { const n = [...procedures]; n[i].description = e.target.value; setProcedures(n); }} placeholder="Description" className="h-8 text-xs flex-1" />
                        <Input value={p.amount} onChange={e => { const n = [...procedures]; n[i].amount = e.target.value; setProcedures(n); }} placeholder="₹" className="h-8 text-xs w-24" type="number" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setProcedures(procedures.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>

                  {/* Lab charges */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] text-muted-foreground font-medium">Lab Charges</label>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setLabCharges([...labCharges, { description: "", amount: "" }])}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {labCharges.map((l, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <Input value={l.description} onChange={e => { const n = [...labCharges]; n[i].description = e.target.value; setLabCharges(n); }} placeholder="Test name" className="h-8 text-xs flex-1" />
                        <Input value={l.amount} onChange={e => { const n = [...labCharges]; n[i].amount = e.target.value; setLabCharges(n); }} placeholder="₹" className="h-8 text-xs w-24" type="number" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setLabCharges(labCharges.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">Discount (₹)</label>
                    <Input value={discount} onChange={e => setDiscount(e.target.value)} className="h-9 mt-1 w-32" type="number" />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-xl font-bold text-primary">₹{total()}</span>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={saveInvoice} disabled={saving} className="flex-1">
                      {saving ? "Saving..." : "Save Invoice"}
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                      <Printer className="h-4 w-4 mr-2" /> Print
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Select a patient to generate an invoice</p>
                </CardContent>
              </Card>
            )}

            {/* Recent invoices */}
            {recentInvoices.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Invoices</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentInvoices.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                        <div>
                          <p className="font-medium">{(inv.patients as any)?.name || "Patient"}</p>
                          <p className="text-[10px] text-muted-foreground">{inv.invoice_number} · {new Date(inv.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="font-bold text-primary">₹{inv.total}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
