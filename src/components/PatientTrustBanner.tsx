import { ShieldCheck, Lock, Eye, Globe } from "lucide-react";

interface PatientTrustBannerProps {
  compact?: boolean;
}

const items = [
  { icon: Lock, text: "Your data is encrypted end-to-end" },
  { icon: ShieldCheck, text: "Only your doctor can access your records" },
  { icon: Eye, text: "AI assists your doctor — it does not make decisions" },
  { icon: Globe, text: "Compliant with HIPAA, GDPR & India DPDP" },
];

export default function PatientTrustBanner({ compact }: PatientTrustBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          Your data is encrypted and protected. Only your treating doctor can access your records.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/10 bg-primary/[0.03] p-4 space-y-2.5">
      <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        Your Privacy & Safety
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.text} className="flex items-start gap-2">
            <item.icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <span className="text-[11px] text-muted-foreground leading-tight">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
