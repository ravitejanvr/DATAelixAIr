import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";

interface Capability {
  name: string;
  description: string;
  path: string;
}

interface Props {
  capabilities: Capability[];
}

export default function RelatedCapabilities({ capabilities }: Props) {
  if (!capabilities.length) return null;

  return (
    <div className="border border-border rounded-2xl p-6 bg-card">
      <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        Related Platform Capability
      </h3>
      <div className="space-y-3">
        {capabilities.map((cap) => (
          <Link
            key={cap.name}
            to={cap.path}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{cap.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cap.description}</p>
            </div>
            <ArrowRight size={14} className="text-primary mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  );
}
