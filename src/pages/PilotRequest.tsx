import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

export default function PilotRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clinic_name: "",
    location: "",
    speciality: "",
    estimated_patient_volume: "",
    contact_name: "",
    contact_email: user?.email || "",
    contact_phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clinic_name || !form.location || !form.speciality || !form.contact_name || !form.contact_email) {
      toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("pilot_requests" as any).insert(form as any);
      if (error) throw new Error(error.message);
      setSubmitted(true);
      toast({ title: "Request submitted", description: "We'll review your pilot request shortly." });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <SEO title="Pilot Request Submitted — DATAelixAIr" description="Your pilot request has been received." />
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Request Submitted</h2>
              <p className="text-sm text-muted-foreground">
                Thank you for your interest. Our team will review your pilot request and get back to you within 2–3 business days.
              </p>
              <Button onClick={() => navigate("/")} variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Request a Pilot — DATAelixAIr" description="Apply for a DATAelixAIr clinical AI pilot program." />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="text-xl">Request a Pilot</CardTitle>
            <CardDescription>Fill in your clinic details to apply for the DATAelixAIr™ pilot program.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs">Clinic Name *</Label>
                <Input value={form.clinic_name} onChange={e => setForm(p => ({ ...p, clinic_name: e.target.value }))} placeholder="e.g. Sunrise Clinic" />
              </div>
              <div>
                <Label className="text-xs">Location *</Label>
                <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Hyderabad, Telangana" />
              </div>
              <div>
                <Label className="text-xs">Speciality *</Label>
                <Select value={form.speciality} onValueChange={v => setForm(p => ({ ...p, speciality: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select speciality" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_practice">General Practice</SelectItem>
                    <SelectItem value="internal_medicine">Internal Medicine</SelectItem>
                    <SelectItem value="pediatrics">Pediatrics</SelectItem>
                    <SelectItem value="orthopedics">Orthopedics</SelectItem>
                    <SelectItem value="dermatology">Dermatology</SelectItem>
                    <SelectItem value="ent">ENT</SelectItem>
                    <SelectItem value="cardiology">Cardiology</SelectItem>
                    <SelectItem value="gynecology">Gynecology</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estimated Patient Volume (per day)</Label>
                <Input value={form.estimated_patient_volume} onChange={e => setForm(p => ({ ...p, estimated_patient_volume: e.target.value }))} placeholder="e.g. 30-50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact Name *</Label>
                  <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Contact Phone</Label>
                  <Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Contact Email *</Label>
                <Input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Submitting...</> : "Submit Pilot Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
