import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { Stethoscope, User, ShieldCheck, Scale, Brain, Globe, FileCheck, Settings, MapPin, Search, Loader2, Star, X } from "lucide-react";

interface ClinicResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  user_ratings_total: number;
  open_now: boolean | null;
}

function ClinicSelector({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClinicResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchClinics = async (searchQuery: string) => {
    if (!searchQuery.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("places-search", {
        body: { query: searchQuery },
      });
      if (!error && data?.clinics) {
        setResults(data.clinics);
        setShowDropdown(true);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  };

  const handleNearby = async () => {
    if (!navigator.geolocation) return;
    setAutoDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data, error } = await supabase.functions.invoke("places-search", {
            body: { lat: pos.coords.latitude, lon: pos.coords.longitude, type: "nearby" },
          });
          if (!error && data?.clinics) {
            setResults(data.clinics);
            setShowDropdown(true);
          }
        } catch {
          // silent
        } finally {
          setAutoDetecting(false);
        }
      },
      () => setAutoDetecting(false)
    );
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (value) onChange(""); // clear selection when typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClinics(val), 400);
  };

  const selectClinic = (clinic: ClinicResult) => {
    onChange(clinic.name);
    setQuery(clinic.name);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative space-y-1.5">
      <Label className="text-sm flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5 text-primary" /> Clinic / Hospital
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={value || query}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search clinic or hospital..."
            className="pl-9 pr-8"
          />
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setQuery(""); setResults([]); }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-primary" />}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleNearby} disabled={autoDetecting} className="shrink-0 text-xs px-2">
          {autoDetecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </Button>
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.place_id}
              type="button"
              onClick={() => selectClinic(c)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
            >
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{c.address}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {c.rating && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {c.rating}
                    <span className="text-muted-foreground">({c.user_ratings_total})</span>
                  </span>
                )}
                {c.open_now !== null && (
                  <span className={`text-[10px] ${c.open_now ? "text-green-600" : "text-red-500"}`}>
                    {c.open_now ? "Open" : "Closed"}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"doctor" | "patient" | "admin">("doctor");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const userRole = roles?.[0]?.role;
      if (userRole === "patient") {
        navigate("/patient-portal");
      } else {
        navigate("/dashboard");
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role, clinic_name: clinicName },
        emailRedirectTo: window.location.origin + (role === "patient" ? "/patient-portal" : "/dashboard"),
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else if (data.session) {
      // Update profile with clinic name
      if (clinicName) {
        await supabase.from("profiles").update({ clinic_name: clinicName }).eq("user_id", data.user!.id);
      }
      navigate(role === "patient" ? "/patient-portal" : "/dashboard");
    } else {
      toast({ title: "Check your email", description: "We sent a verification link to confirm your account." });
    }
  };

  const regulations = [
    { icon: ShieldCheck, label: "HIPAA & UK GDPR" },
    { icon: Scale, label: "EU AI Act Art. 6" },
    { icon: Globe, label: "India DPDP 2023" },
    { icon: Brain, label: "WHO AI Ethics" },
    { icon: FileCheck, label: "IEEE 7000" },
  ];

  return (
    <>
      <SEO title="Login — DATAelixAIr CDSS" description="Sign in to access the AI-powered Clinical Decision Support System (CDSS)." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="text-center space-y-2">
            <img src={brainLogo} alt="DATAelixAIr" className="h-12 mx-auto" />
            <CardTitle className="text-2xl font-bold">Clinical Decision Support System</CardTitle>
            <span className="inline-block px-3 py-1 text-xs font-mono rounded-full bg-primary/10 text-primary">
              Prototype
            </span>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">I am a…</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole("doctor")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          role === "doctor"
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        <Stethoscope className={`h-5 w-5 ${role === "doctor" ? "text-primary" : ""}`} />
                        <span className="text-xs font-medium">Healthcare Professional</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("patient")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          role === "patient"
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        <User className={`h-5 w-5 ${role === "patient" ? "text-primary" : ""}`} />
                        <span className="text-xs font-medium">Patient</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("admin")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          role === "admin"
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        <Settings className={`h-5 w-5 ${role === "admin" ? "text-primary" : ""}`} />
                        <span className="text-xs font-medium">Admin</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder={role === "doctor" ? "Dr. Ravi Kumar" : "Your full name"} />
                  </div>

                  {/* Clinic Locator - shown for doctors and admins */}
                  {(role === "doctor" || role === "admin") && (
                    <ClinicSelector value={clinicName} onChange={setClinicName} />
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Regulatory compliance badges */}
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {regulations.map((r) => (
                  <span key={r.label} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-primary/5 border border-primary/10 text-muted-foreground">
                    <r.icon className="h-3 w-3 text-primary" />
                    {r.label}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-center text-muted-foreground leading-relaxed">
                Data encrypted with TLS 1.3 · No PHI stored in demo · HL7 FHIR R4 ready · MCI Telemedicine 2020 aligned ·
                Audit trails per ISO 27001 · AI transparency per EU AI Act Article 13
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
