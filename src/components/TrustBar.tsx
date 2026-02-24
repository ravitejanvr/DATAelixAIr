import { Lock, ShieldCheck, Globe } from "lucide-react";

const items = [
  { icon: Lock, label: "TLS 1.3 Secured" },
  { icon: Globe, label: "DPDP / GDPR Aligned" },
  { icon: ShieldCheck, label: "Clinician-Controlled AI" },
];

const TrustBar = () => (
  <div className="bg-foreground/[0.03] border-b border-border">
    <div className="container mx-auto px-4">
      <div className="flex items-center justify-center gap-4 md:gap-8 py-2 overflow-x-auto">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 shrink-0">
            <item.icon size={13} className="text-primary" />
            <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TrustBar;
