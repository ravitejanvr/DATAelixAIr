import { Link } from "react-router-dom";
import { ArrowRight, Cpu } from "lucide-react";
import type { ArticleCategory } from "@/lib/blog-data";

interface ProductInsight {
  heading: string;
  body: string;
  featureName: string;
  featurePath: string;
}

const INSIGHTS_BY_CATEGORY: Record<string, ProductInsight> = {
  "Clinical AI & Decision Support": {
    heading: "How DATAelixAIr Approaches This",
    body: "DATAelixAIr structures consultation recordings into clinician-reviewed SOAP notes and surfaces evidence-based suggestions — keeping the physician in control while reducing documentation burden.",
    featureName: "Clinical Documentation Workspace",
    featurePath: "/clinical",
  },
  "Patient Safety & Clinical Governance": {
    heading: "How DATAelixAIr Addresses Safety",
    body: "The platform runs real-time drug interaction checks, allergy cross-referencing, and clinical risk pattern detection during every consultation — with every alert logged in an immutable audit trail.",
    featureName: "Clinical Guardrail Engine",
    featurePath: "/vision",
  },
  "Healthcare Operations & Workflow": {
    heading: "How DATAelixAIr Optimises Workflow",
    body: "From QR-based patient intake to automated queue management and structured visit timelines, DATAelixAIr reduces administrative overhead so clinicians can focus on patient care.",
    featureName: "Smart Workflow Engine",
    featurePath: "/vision",
  },
  "Digital Health & Interoperability": {
    heading: "How DATAelixAIr Enables Connectivity",
    body: "Built on a modular, FHIR-aligned data architecture, DATAelixAIr ensures clinical data flows seamlessly between departments and systems without manual re-entry.",
    featureName: "Universal EHR Architecture",
    featurePath: "/vision",
  },
  "Research & Evidence": {
    heading: "How DATAelixAIr Uses Evidence",
    body: "The platform integrates PubMed citations and guideline-backed recommendations directly into consultation workflows, supporting evidence-informed clinical practice without extra research time.",
    featureName: "AI Copilot",
    featurePath: "/vision",
  },
};

interface Props {
  category: ArticleCategory;
}

export default function ProductInsightBlock({ category }: Props) {
  const insight = INSIGHTS_BY_CATEGORY[category] || INSIGHTS_BY_CATEGORY["Clinical AI & Decision Support"];

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-5 my-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Cpu className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="font-display text-sm font-bold text-foreground">{insight.heading}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {insight.body}
      </p>
      <Link
        to={insight.featurePath}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline underline-offset-2 transition-colors"
      >
        Learn about {insight.featureName} <ArrowRight size={12} />
      </Link>
    </div>
  );
}
