import { useState } from "react";
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
import { Stethoscope, User, ShieldCheck, Scale, Brain, Globe, FileCheck, Settings } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"doctor" | "patient" | "admin">("doctor");
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
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin + (role === "patient" ? "/patient-portal" : "/dashboard"),
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else if (data.session) {
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
