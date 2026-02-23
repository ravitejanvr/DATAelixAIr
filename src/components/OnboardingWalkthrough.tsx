import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Stethoscope, Mic, FileText, Pill, Share2, ArrowRight, CheckCircle2 } from "lucide-react";

const ONBOARDING_KEY = "dataelixair_onboarding_done";

const steps = [
  {
    title: "Enter Patient Details",
    description: "Fill in the patient's demographics, conditions, symptoms and current medications. You can type or use the voice recorder.",
    icon: Stethoscope,
    tip: "Tip: Use comma-separated values for multiple conditions or medications.",
  },
  {
    title: "Voice-to-Text Capture",
    description: "Click the microphone button to dictate patient notes. Our AI will automatically extract structured fields from your speech.",
    icon: Mic,
    tip: "Tip: Speak naturally — mention name, age, complaints, and medications.",
  },
  {
    title: "Review CDSS Results",
    description: "After analysis, review the AI-generated SOAP notes, risk assessment, drug recommendations, and PubMed-backed evidence.",
    icon: FileText,
    tip: "Tip: Each recommendation includes an evidence level and citations.",
  },
  {
    title: "Generate Prescriptions",
    description: "Click 'Generate Prescription' to create a printable medication order with dosage, frequency, and interaction warnings.",
    icon: Pill,
    tip: "Tip: You can edit drugs before printing or saving.",
  },
  {
    title: "Share Reports",
    description: "Export consultation reports as bilingual PDFs (English + Hindi/Telugu) and share via WhatsApp with one click.",
    icon: Share2,
    tip: "Tip: Translated reports preserve medical terminology in English.",
  },
];

export default function OnboardingWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
  };

  const current = steps[step];
  const Icon = current.icon;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Step {step + 1} of {steps.length}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-1.5" />

        <div className="space-y-4 mt-2">
          <p className="text-sm text-foreground leading-relaxed">{current.description}</p>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-primary font-medium">{current.tip}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleFinish}>
              Skip Tour
            </Button>
            <Button className="flex-1" onClick={handleNext}>
              {step < steps.length - 1 ? (
                <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
              ) : (
                <>Get Started <CheckCircle2 className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
