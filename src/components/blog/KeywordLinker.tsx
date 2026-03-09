import { Link } from "react-router-dom";
import { ReactNode } from "react";

/** Maps clinical keywords to internal platform pages */
const KEYWORD_LINKS: Record<string, { label: string; path: string }> = {
  "ai documentation": { label: "AI Documentation", path: "/clinical" },
  "clinical documentation": { label: "Clinical Documentation", path: "/clinical" },
  "clinical decision support": { label: "Clinical Decision Support", path: "/vision" },
  "patient safety": { label: "Patient Safety", path: "/vision" },
  "drug interaction": { label: "Drug Interaction Detection", path: "/vision" },
  "drug interactions": { label: "Drug Interaction Detection", path: "/vision" },
  "clinical workflow": { label: "Clinical Workflow", path: "/clinical" },
  "clinical governance": { label: "Clinical Governance", path: "/vision" },
  "soap notes": { label: "SOAP Notes", path: "/clinical" },
  "ai copilot": { label: "AI Copilot", path: "/vision" },
  "prescription": { label: "Prescription Management", path: "/clinical" },
  "interoperability": { label: "Interoperability", path: "/vision" },
  "workflow automation": { label: "Workflow Automation", path: "/vision" },
  "medical records": { label: "Medical Records", path: "/clinical" },
  "clinical notes": { label: "Clinical Notes", path: "/clinical" },
};

/**
 * Takes plain text and returns React nodes with keyword phrases
 * auto-linked to relevant platform pages. Only links each keyword once.
 */
export function linkifyText(text: string): ReactNode[] {
  if (!text) return [text];

  const linked = new Set<string>();
  let result: ReactNode[] = [text];

  for (const [keyword, { path }] of Object.entries(KEYWORD_LINKS)) {
    if (linked.has(keyword)) continue;
    const regex = new RegExp(`(${keyword})`, "gi");

    const newResult: ReactNode[] = [];
    let didLink = false;

    for (const segment of result) {
      if (typeof segment !== "string") {
        newResult.push(segment);
        continue;
      }

      const parts = segment.split(regex);
      for (const part of parts) {
        if (part.toLowerCase() === keyword && !didLink) {
          didLink = true;
          linked.add(keyword);
          newResult.push(
            <Link
              key={`kw-${keyword}`}
              to={path}
              className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors font-medium"
            >
              {part}
            </Link>
          );
        } else {
          newResult.push(part);
        }
      }
    }

    result = newResult;
  }

  return result;
}

/** Wrapper component for rendering linkified text */
export default function KeywordLinker({ text }: { text: string }) {
  return <>{linkifyText(text)}</>;
}
