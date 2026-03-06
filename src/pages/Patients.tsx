import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  Users, Plus, Search, User, Phone, Mail, Calendar, Loader2, ChevronRight
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  current_medications: string[] | null;
  allergies: string[] | null;
  created_at: string;
}

export default function Patients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Minimal intake form
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("male");
  const [newPhone, setNewPhone] = useState("");
  const [newVisitType, setNewVisitType] = useState("walk-in");

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, age, gender, phone, email, current_medications, allergies, created_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error loading patients", description: error.message, variant: "destructive" });
    else setPatients(data || []);
    setLoading(false);
  };

  // Auto-fetch returning patient by phone
  const handlePhoneChange = async (phone: string) => {
    setNewPhone(phone);
    if (phone.length >= 10) {
      const { data } = await supabase.from("patients").select("name, age, gender").eq("phone", phone).limit(1);
      if (data?.[0]) {
        setNewName(data[0].name);
        setNewAge(data[0].age?.toString() || "");
        setNewGender(data[0].gender || "male");
        toast({ title: "Returning patient found", description: `${data[0].name} auto-filled` });
      }
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("patients").insert({
      doctor_id: user!.id,
      name: newName.trim(),
      age: newAge ? parseInt(newAge) : null,
      gender: newGender,
      phone: newPhone || null,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Failed to add patient", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Patient registered" });
      setDialogOpen(false);
      setNewName(""); setNewAge(""); setNewGender("male"); setNewPhone(""); setNewVisitType("walk-in");
      fetchPatients();
    }
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  return (
    <>
      <SEO title="Patients — DATAelixAIr" description="Patient registry" />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold text-foreground">Patients</h2>
              <p className="text-sm text-muted-foreground">{patients.length} total patients</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Register Patient</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Register Patient</DialogTitle></DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-4">
                <div>
                  <Label>Phone (for returning patient lookup)</Label>
                  <Input value={newPhone} onChange={e => handlePhoneChange(e.target.value)} placeholder="+91..." />
                </div>
                <div>
                  <Label>Full Name *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Patient name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Age</Label>
                    <Input type="number" value={newAge} onChange={e => setNewAge(e.target.value)} placeholder="Age" />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={newGender} onValueChange={setNewGender}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Visit Type</Label>
                  <Select value={newVisitType} onValueChange={setNewVisitType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk-in">Walk-in</SelectItem>
                      <SelectItem value="appointment">Appointment</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : "Register Patient"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium text-foreground">{search ? "No patients match" : "No patients yet"}</p>
              <p className="text-sm text-muted-foreground mt-1">{search ? "Try a different search" : "Click 'Register Patient' to add your first patient"}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(patient => (
              <Card key={patient.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/patients/${patient.id}`)}>
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{patient.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {patient.age && <span>{patient.age}y</span>}
                        {patient.gender && <span className="capitalize">{patient.gender}</span>}
                        {patient.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {patient.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {patient.allergies && patient.allergies.length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">⚠️ Allergies</Badge>
                    )}
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(patient.created_at).toLocaleDateString()}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
