import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  Users, Plus, Search, LogOut, ArrowLeft, Stethoscope, Activity,
  User, Phone, Mail, Calendar, Loader2, ChevronRight
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  abha_id: string | null;
  current_medications: string[] | null;
  allergies: string[] | null;
  created_at: string;
  language_preference: string | null;
}

export default function Patients() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New patient form
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("male");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newMedications, setNewMedications] = useState("");
  const [newAllergies, setNewAllergies] = useState("");
  const [newHeight, setNewHeight] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newBloodGroup, setNewBloodGroup] = useState("");
  const [newSmoking, setNewSmoking] = useState("unknown");
  const [newAlcohol, setNewAlcohol] = useState("unknown");
  const [newExercise, setNewExercise] = useState("unknown");

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, age, gender, phone, email, abha_id, current_medications, allergies, created_at, language_preference")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading patients", description: error.message, variant: "destructive" });
    } else {
      setPatients(data || []);
    }
    setLoading(false);
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
      email: newEmail || null,
      current_medications: newMedications ? newMedications.split(",").map(s => s.trim()) : [],
      allergies: newAllergies ? newAllergies.split(",").map(s => s.trim()) : [],
      height_cm: newHeight ? parseFloat(newHeight) : null,
      weight_kg: newWeight ? parseFloat(newWeight) : null,
      blood_group: newBloodGroup || "",
      smoking_status: newSmoking,
      alcohol_use: newAlcohol,
      exercise_frequency: newExercise,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Failed to add patient", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Patient added successfully" });
      setDialogOpen(false);
      resetForm();
      fetchPatients();
    }
  };

  const resetForm = () => {
    setNewName(""); setNewAge(""); setNewGender("male");
    setNewPhone(""); setNewEmail(""); setNewMedications(""); setNewAllergies("");
    setNewHeight(""); setNewWeight(""); setNewBloodGroup("");
    setNewSmoking("unknown"); setNewAlcohol("unknown"); setNewExercise("unknown");
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <SEO title="Patients — DATAelixAIr Clinical" description="Manage your patients" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={brainLogo} alt="Logo" className="h-8" />
          <div>
            <h1 className="text-sm font-bold text-foreground">DATAelixAIr CDSS</h1>
            <p className="text-xs text-muted-foreground">Clinical Decision Support System</p>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">PhD Prototype</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <Activity className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/clinical")}>
            <Stethoscope className="h-4 w-4 mr-1" /> CDSS Analysis
          </Button>
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Top bar */}
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
              <Button><Plus className="h-4 w-4 mr-1" /> Add Patient</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Full Name *</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Patient name" />
                  </div>
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
                  <div>
                    <Label>Phone</Label>
                    <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+91..." />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="patient@email.com" />
                  </div>
                  <div className="col-span-2">
                    <Label>Current Medications (comma-separated)</Label>
                    <Input value={newMedications} onChange={e => setNewMedications(e.target.value)} placeholder="Metformin, Amlodipine" />
                  </div>
                  <div className="col-span-2">
                    <Label>Allergies (comma-separated)</Label>
                    <Input value={newAllergies} onChange={e => setNewAllergies(e.target.value)} placeholder="Penicillin, Sulfa" />
                  </div>
                  <div>
                    <Label>Height (cm)</Label>
                    <Input type="number" value={newHeight} onChange={e => setNewHeight(e.target.value)} placeholder="170" />
                  </div>
                  <div>
                    <Label>Weight (kg)</Label>
                    <Input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="70" />
                  </div>
                  <div>
                    <Label>Blood Group</Label>
                    <Input value={newBloodGroup} onChange={e => setNewBloodGroup(e.target.value)} placeholder="O+" />
                  </div>
                  <div>
                    <Label>Smoking Status</Label>
                    <Select value={newSmoking} onValueChange={setNewSmoking}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="former">Former</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Alcohol Use</Label>
                    <Select value={newAlcohol} onValueChange={setNewAlcohol}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="occasional">Occasional</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Exercise</Label>
                    <Select value={newExercise} onValueChange={setNewExercise}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="sedentary">Sedentary</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : "Add Patient"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Patient list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium text-foreground">
                {search ? "No patients match your search" : "No patients yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Click \"Add Patient\" to register your first patient"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(patient => (
              <Card
                key={patient.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/patients/${patient.id}`)}
              >
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
                        {patient.phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="h-3 w-3" /> {patient.phone}
                          </span>
                        )}
                        {patient.email && (
                          <span className="flex items-center gap-0.5">
                            <Mail className="h-3 w-3" /> {patient.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {patient.current_medications && patient.current_medications.length > 0 && (
                      <div className="hidden md:flex gap-1">
                        {patient.current_medications.slice(0, 2).map((med, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{med}</Badge>
                        ))}
                        {patient.current_medications.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">+{patient.current_medications.length - 2}</Badge>
                        )}
                      </div>
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
      </main>
    </>
  );
}
