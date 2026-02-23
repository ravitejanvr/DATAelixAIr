import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Stethoscope, User, Building2, Globe, Languages, ArrowRight, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const WELCOME_DISMISSED_KEY = "dataelixair_welcome_dismissed";

const countries = [
  { value: "IN", label: "India", region: "South Asia" },
  { value: "GB", label: "United Kingdom", region: "Europe" },
  { value: "US", label: "United States", region: "North America" },
  { value: "AE", label: "UAE", region: "Middle East" },
  { value: "SA", label: "Saudi Arabia", region: "Middle East" },
  { value: "SG", label: "Singapore", region: "Southeast Asia" },
  { value: "AU", label: "Australia", region: "Oceania" },
  { value: "OTHER", label: "Other", region: "Global" },
];

const languages = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "te", label: "Telugu" },
  { value: "ta", label: "Tamil" },
  { value: "ar", label: "Arabic" },
];

export default function WelcomePopup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");

  useEffect(() => {
    const browserLang = navigator.language.split("-")[0];
    const match = languages.find(l => l.value === browserLang);
    if (match) setLanguage(match.value);

    const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    localStorage.setItem("dataelixair_role", role);
    localStorage.setItem("dataelixair_country", country);
    localStorage.setItem("dataelixair_language", language);
    setOpen(false);

    if (role === "doctor" || role === "patient") {
      navigate("/auth");
    } else if (role === "partner") {
      navigate("/contact");
    }
  };

  const handleSkip = () => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); setOpen(v); }}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Welcome to DATAelixAIr™
                </DialogTitle>
                <DialogDescription>
                  Help us personalise your experience. Tell us about yourself.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">I am a…</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "doctor", label: "Healthcare Professional", icon: Stethoscope },
                      { value: "patient", label: "Patient", icon: User },
                      { value: "partner", label: "Investor / Partner", icon: Building2 },
                    ].map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setRole(r.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                          role === r.value
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        <r.icon className={`h-6 w-6 ${role === r.value ? "text-primary" : ""}`} />
                        <span className="text-xs font-medium leading-tight">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleSkip}>
                    Skip for now
                  </Button>
                  <Button className="flex-1" onClick={handleContinue} disabled={!role}>
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Languages className="h-5 w-5 text-primary" />
                  Your Preferences
                </DialogTitle>
                <DialogDescription>
                  Set your region and language for a tailored experience.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">
                    <Globe className="h-3.5 w-3.5 inline mr-1" /> Country / Region
                  </Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger><SelectValue placeholder="Select your country" /></SelectTrigger>
                    <SelectContent>
                      {countries.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label} <span className="text-muted-foreground text-xs">({c.region})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-2 block">
                    <Languages className="h-3.5 w-3.5 inline mr-1" /> Preferred Language
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {languages.map(l => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Your data is protected under HIPAA, UK GDPR & India DPDP standards. We do not store personal data without consent.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={handleContinue}>
                    Get Started <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
