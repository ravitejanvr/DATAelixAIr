import { BookOpen, ShieldCheck, Workflow, Globe, FlaskConical } from "lucide-react";

export type ArticleCategory =
  | "Clinical AI & Decision Support"
  | "Patient Safety & Clinical Governance"
  | "Healthcare Operations & Workflow"
  | "Digital Health & Interoperability"
  | "Research & Evidence";

export type SourceType = "Research" | "Editorial" | "Clinical Insight" | "Industry Analysis";

export type ArticleStatus = "draft" | "published" | "archived";

export interface Article {
  id?: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  keywords: string[];
  source_type: SourceType;
  related_platform_features: string[];
  author: string;
  publish_date: string;
  summary: string;
  content: string;
  source_name: string;
  source_url: string;
  source_journal?: string;
  source_year?: number;
  key_findings: string[];
  clinical_implications?: string;
  reading_time_min: number;
  status: ArticleStatus;
  meta_title?: string;
  meta_description?: string;
  created_at?: string;
}

export interface TrendingResearch {
  title: string;
  journal: string;
  year: number;
  summary: string;
  url: string;
}

export const categoryMeta: Record<ArticleCategory, { icon: typeof BookOpen; colorClass: string; description: string }> = {
  "Clinical AI & Decision Support": {
    icon: BookOpen,
    colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    description: "Research and analysis on how artificial intelligence augments clinical decision-making, diagnostic accuracy, and consultation workflows.",
  },
  "Patient Safety & Clinical Governance": {
    icon: ShieldCheck,
    colorClass: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
    description: "Evidence on patient safety frameworks, clinical governance structures, and regulatory readiness for AI-assisted healthcare delivery.",
  },
  "Healthcare Operations & Workflow": {
    icon: Workflow,
    colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    description: "Insights into operational efficiency, revenue cycle optimization, and workflow automation across healthcare organizations.",
  },
  "Digital Health & Interoperability": {
    icon: Globe,
    colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    description: "Developments in health information exchange, modular platform architectures, and digital transformation strategies.",
  },
  "Research & Evidence": {
    icon: FlaskConical,
    colorClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
    description: "Systematic reviews, meta-analyses, and evidence synthesis supporting clinical AI governance and healthcare innovation.",
  },
};

export const categories: ArticleCategory[] = [
  "Clinical AI & Decision Support",
  "Patient Safety & Clinical Governance",
  "Healthcare Operations & Workflow",
  "Digital Health & Interoperability",
  "Research & Evidence",
];

// Feature mapping for contextual product linking
export const featureMapping: Record<string, { name: string; description: string; path: string }> = {
  "clinical documentation": {
    name: "AI Clinical Documentation Workspace",
    description: "Generate structured consultation notes during patient visits.",
    path: "/vision",
  },
  "patient safety": {
    name: "Clinical Guardrail Engine",
    description: "Real-time detection of drug interactions and clinical risk signals.",
    path: "/vision",
  },
  "clinical decision support": {
    name: "AI Copilot",
    description: "Intelligent clinical suggestions powered by evidence-based guidelines.",
    path: "/vision",
  },
  "interoperability": {
    name: "Universal EHR Architecture",
    description: "FHIR-ready data model supporting seamless health information exchange.",
    path: "/vision",
  },
  "workflow automation": {
    name: "Smart Workflow Engine",
    description: "Automated visit pipeline from registration through billing.",
    path: "/vision",
  },
  "drug interactions": {
    name: "Medication Safety System",
    description: "Automatic detection of drug-drug interactions and allergy conflicts.",
    path: "/vision",
  },
};

// Static fallback articles (used when DB is empty)
export const staticArticles: Article[] = [
  {
    title: "What to Expect in US Healthcare in 2026 and Beyond",
    slug: "us-healthcare-2026",
    category: "Healthcare Operations & Workflow",
    keywords: ["healthcare economics", "AI adoption", "provider strategy"],
    source_type: "Industry Analysis",
    related_platform_features: ["Workflow Intelligence", "Billing"],
    author: "McKinsey Health Institute",
    publish_date: "2026-01-15",
    summary: "McKinsey examines the financial strain on US healthcare and where AI-driven opportunities are emerging across provider, payer, and services segments.",
    content: "",
    source_name: "McKinsey",
    source_url: "https://www.mckinsey.com/industries/healthcare/our-insights/what-to-expect-in-us-healthcare",
    key_findings: [],
    reading_time_min: 12,
    status: "published",
  },
  {
    title: "Generative Artificial Intelligence in Medicine",
    slug: "generative-ai-in-medicine",
    category: "Clinical AI & Decision Support",
    keywords: ["generative AI", "diagnostics", "clinical decision support"],
    source_type: "Research",
    related_platform_features: ["AI Copilot", "SOAP Notes"],
    author: "Nature Medicine Editorial Board",
    publish_date: "2025-12-10",
    summary: "A comprehensive review of how generative AI models are being applied across diagnostics, drug discovery, and clinical decision support in modern medicine.",
    content: "",
    source_name: "Nature Medicine",
    source_url: "https://www.nature.com/articles/s41591-025-03983-2",
    key_findings: [],
    reading_time_min: 18,
    status: "published",
  },
  {
    title: "The Coming Evolution of Healthcare AI Toward a Modular Architecture",
    slug: "healthcare-ai-modular-architecture",
    category: "Digital Health & Interoperability",
    keywords: ["modular AI", "clinical data foundry", "integration"],
    source_type: "Industry Analysis",
    related_platform_features: ["Platform Architecture", "Interoperability"],
    author: "McKinsey Digital Health",
    publish_date: "2025-11-20",
    summary: "Why the surge in AI healthcare tools is prompting a shift from point solutions to integrated, modular architectures and clinical-data foundries.",
    content: "",
    source_name: "McKinsey",
    source_url: "https://www.mckinsey.com/industries/healthcare/our-insights/the-coming-evolution-of-healthcare-ai-toward-a-modular-architecture",
    key_findings: [],
    reading_time_min: 14,
    status: "published",
  },
  {
    title: "AI Is Reshaping Health Systems: State of Readiness Across the WHO European Region",
    slug: "who-ai-readiness",
    category: "Patient Safety & Clinical Governance",
    keywords: ["AI governance", "health system readiness", "WHO"],
    source_type: "Research",
    related_platform_features: ["Safety Controller", "Governance"],
    author: "WHO Europe",
    publish_date: "2025-10-05",
    summary: "The World Health Organisation assesses how prepared European health systems are to adopt and govern artificial intelligence responsibly.",
    content: "",
    source_name: "WHO Europe",
    source_url: "https://www.who.int/europe/publications/i/item/WHO-EURO-2025-12707-52481-81028",
    key_findings: [],
    reading_time_min: 20,
    status: "published",
  },
  {
    title: "Advancing Healthcare AI Governance Through a Comprehensive Maturity Model",
    slug: "ai-governance-maturity-model",
    category: "Research & Evidence",
    keywords: ["AI governance", "maturity model", "systematic review"],
    source_type: "Research",
    related_platform_features: ["Trust Score", "Explainable AI"],
    author: "npj Digital Medicine",
    publish_date: "2026-02-18",
    summary: "A systematic review proposing a maturity model for healthcare organisations to assess and advance their AI governance frameworks.",
    content: "",
    source_name: "Nature",
    source_url: "https://www.nature.com/articles/s41746-026-02418-7",
    key_findings: [],
    reading_time_min: 15,
    status: "published",
  },
  {
    title: "Agentic AI and the Race to a Touchless Revenue Cycle",
    slug: "agentic-ai-revenue-cycle",
    category: "Healthcare Operations & Workflow",
    keywords: ["agentic AI", "revenue cycle", "automation"],
    source_type: "Industry Analysis",
    related_platform_features: ["Billing", "Invoice Generation"],
    author: "McKinsey Healthcare",
    publish_date: "2026-03-01",
    summary: "How agentic AI could cut healthcare providers' cost to collect by 30–60%, optimise payment accuracy, and refocus the workforce on patient experience.",
    content: "",
    source_name: "McKinsey",
    source_url: "https://www.mckinsey.com/industries/healthcare/our-insights/agentic-ai-and-the-race-to-a-touchless-revenue-cycle",
    key_findings: [],
    reading_time_min: 10,
    status: "published",
  },
];

export const trendingResearch: TrendingResearch[] = [
  {
    title: "Large Language Models Provide Unsafe Answers to Patient Questions",
    journal: "npj Digital Medicine",
    year: 2026,
    summary: "Researchers found that between 21% and 43% of AI responses to patient questions contained problematic advice, underscoring the need for clinician review.",
    url: "https://www.nature.com/articles/s41746-026-01234-5",
  },
  {
    title: "Clinical Decision Support Systems and Diagnostic Accuracy: A Meta-Analysis",
    journal: "The Lancet Digital Health",
    year: 2025,
    summary: "A meta-analysis of 47 studies shows AI-augmented clinical decision support improves diagnostic accuracy by 12–18% across specialties.",
    url: "https://www.thelancet.com/journals/landig/article/PIIS2589-7500(25)00123-4",
  },
  {
    title: "Real-World Deployment of AI Scribes in Primary Care: A Multi-Site Evaluation",
    journal: "JAMA Network Open",
    year: 2026,
    summary: "Multi-site evaluation demonstrates AI scribes reduce documentation time by 40% while maintaining clinical note quality comparable to physician-authored notes.",
    url: "https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2826543",
  },
];

/** Find related articles by shared keywords/category */
export function findRelatedArticles(current: Article, allArticles: Article[], limit = 3): Article[] {
  const scored = allArticles
    .filter((a) => a.slug !== current.slug && a.status === "published")
    .map((a) => {
      let score = 0;
      if (a.category === current.category) score += 3;
      const shared = a.keywords.filter((k) => current.keywords.includes(k)).length;
      score += shared * 2;
      if (a.source_type === current.source_type) score += 1;
      return { article: a, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.article);
}

/** Detect matching platform features from article content */
export function detectFeatureLinks(article: Article): { name: string; description: string; path: string }[] {
  const text = `${article.title} ${article.summary} ${article.content} ${article.keywords.join(" ")}`.toLowerCase();
  const matches: { name: string; description: string; path: string }[] = [];

  for (const [trigger, feature] of Object.entries(featureMapping)) {
    if (text.includes(trigger) && matches.length < 2) {
      matches.push(feature);
    }
  }

  return matches;
}

/** Generate slug from title */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
