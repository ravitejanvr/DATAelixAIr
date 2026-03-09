import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { ClinicalCard, SkeletonCard } from "@/components/ui/clinical-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  Users, Plus, Search, User, Phone, Calendar, Loader2, ChevronRight, AlertTriangle
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
      doctor_id: user!.id, name: newName.trim(),
      age: newAge ? parseInt(newAge) : null, gender: newGender, phone: newPhone || null,
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
    p.name.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search)
  );

  return (
    <>
      <SEO title="Patients — DATAelixAIr" description="Patient registry" />
      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Patients</h1>
            <p className="text-xs text-muted-foreground">{patients.length} registered</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-xl"><Plus className="h-3.5 w-3.5" /> Register</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Register Patient</DialogTitle></DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-3">
                <div>
                  <Label className="text-xs">Phone (returning patient lookup)</Label>
                  <Input value={newPhone} onChange={e => handlePhoneChange(e.target.value)} placeholder="+91..." className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Patient name" className="mt-1 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Age</Label>
                    <Input type="number" value={newAge} onChange={e => setNewAge(e.target.value)} placeholder="Age" className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs">Gender</Label>
                    <Select value={newGender} onValueChange={setNewGender}>
                      <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Visit Type</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["walk-in", "appointment", "follow-up", "emergency"].map(vt => (
                      <Chip key={vt} variant={newVisitType === vt ? "action" : "neutral"} selected={newVisitType === vt} onClick={() => setNewVisitType(vt)} size="sm" className="capitalize">
                        {vt}
                      </Chip>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-xl" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : "Register Patient"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Bar — prominent */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 h-11 text-sm rounded-2xl bg-muted/50 border-border focus:bg-background"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Patient Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} lines={3} />)}
          </div>
        ) : filtered.length === 0 ? (
          <ClinicalCard className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{search ? "No patients match" : "No patients yet"}</p>
            <p className="text-xs text-muted-foreground mt-1">{search ? "Try a different search" : "Register your first patient"}</p>
          </ClinicalCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(patient => (
              <ClinicalCard
                key={patient.id}
                className="cursor-pointer hover:shadow-md transition-all group"
                onClick={() => navigate(`/patients/${patient.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-foreground truncate">{patient.name}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {patient.age && <span>{patient.age}y</span>}
                      {patient.gender && <span className="capitalize">{patient.gender}</span>}
                      {patient.phone && (
                        <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {patient.phone}</span>
                      )}
                    </div>

                    {/* Allergy & Medication chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {patient.allergies && patient.allergies.length > 0 && (
                        <Chip variant="alert" size="sm">
                          <AlertTriangle className="h-3 w-3 mr-0.5" /> Allergies
                        </Chip>
                      )}
                      {patient.current_medications && patient.current_medications.length > 0 && (
                        <Chip variant="medication" size="sm">
                          {patient.current_medications.length} meds
                        </Chip>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(patient.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </ClinicalCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
