import { BookOpen, ShieldCheck, Workflow, Globe, FlaskConical } from "lucide-react";

export type ArticleCategory =
  | "Clinical AI & Decision Support"
  | "Patient Safety & Clinical Governance"
  | "Healthcare Operations & Workflow"
  | "Digital Health & Interoperability"
  | "Research & Evidence";

export type SourceType = "Research" | "Editorial" | "Clinical Insight" | "Industry Analysis";

export interface Article {
  title: string;
  category: ArticleCategory;
  keywords: string[];
  source_type: SourceType;
  related_platform_features: string[];
  author: string;
  publish_date: string;
  summary: string;
  source: string;
  url: string;
  reading_time_min: number;
}

export interface TrendingResearch {
  title: string;
  journal: string;
  year: number;
  summary: string;
  url: string;
}

export const categoryMeta: Record<ArticleCategory, { icon: typeof BookOpen; colorClass: string }> = {
  "Clinical AI & Decision Support": { icon: BookOpen, colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" },
  "Patient Safety & Clinical Governance": { icon: ShieldCheck, colorClass: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400" },
  "Healthcare Operations & Workflow": { icon: Workflow, colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
  "Digital Health & Interoperability": { icon: Globe, colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  "Research & Evidence": { icon: FlaskConical, colorClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400" },
};

export const categories: ArticleCategory[] = [
  "Clinical AI & Decision Support",
  "Patient Safety & Clinical Governance",
  "Healthcare Operations & Workflow",
  "Digital Health & Interoperability",
  "Research & Evidence",
];

export const articles: Article[] = [
  {
    title: "What to Expect in US Healthcare in 2026 and Beyond",
    category: "Healthcare Operations & Workflow",
    keywords: ["healthcare economics", "AI adoption", "provider strategy"],
    source_type: "Industry Analysis",
    related_platform_features: ["Workflow Intelligence", "Billing"],
    author: "McKinsey Health Institute",
    publish_date: "2026-01-15",
    summary: "McKinsey examines the financial strain on US healthcare and where AI-driven opportunities are emerging across provider, payer, and services segments.",
    source: "McKinsey",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/what-to-expect-in-us-healthcare",
    reading_time_min: 12,
  },
  {
    title: "Generative Artificial Intelligence in Medicine",
    category: "Clinical AI & Decision Support",
    keywords: ["generative AI", "diagnostics", "clinical decision support"],
    source_type: "Research",
    related_platform_features: ["AI Copilot", "SOAP Notes"],
    author: "Nature Medicine Editorial Board",
    publish_date: "2025-12-10",
    summary: "A comprehensive review of how generative AI models are being applied across diagnostics, drug discovery, and clinical decision support in modern medicine.",
    source: "Nature Medicine",
    url: "https://www.nature.com/articles/s41591-025-03983-2",
    reading_time_min: 18,
  },
  {
    title: "The Coming Evolution of Healthcare AI Toward a Modular Architecture",
    category: "Digital Health & Interoperability",
    keywords: ["modular AI", "clinical data foundry", "integration"],
    source_type: "Industry Analysis",
    related_platform_features: ["Platform Architecture", "Interoperability"],
    author: "McKinsey Digital Health",
    publish_date: "2025-11-20",
    summary: "Why the surge in AI healthcare tools is prompting a shift from point solutions to integrated, modular architectures and clinical-data foundries.",
    source: "McKinsey",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/the-coming-evolution-of-healthcare-ai-toward-a-modular-architecture",
    reading_time_min: 14,
  },
  {
    title: "AI Is Reshaping Health Systems: State of Readiness Across the WHO European Region",
    category: "Patient Safety & Clinical Governance",
    keywords: ["AI governance", "health system readiness", "WHO"],
    source_type: "Research",
    related_platform_features: ["Safety Controller", "Governance"],
    author: "WHO Europe",
    publish_date: "2025-10-05",
    summary: "The World Health Organisation assesses how prepared European health systems are to adopt and govern artificial intelligence responsibly.",
    source: "WHO Europe",
    url: "https://www.who.int/europe/publications/i/item/WHO-EURO-2025-12707-52481-81028",
    reading_time_min: 20,
  },
  {
    title: "Advancing Healthcare AI Governance Through a Comprehensive Maturity Model",
    category: "Research & Evidence",
    keywords: ["AI governance", "maturity model", "systematic review"],
    source_type: "Research",
    related_platform_features: ["Trust Score", "Explainable AI"],
    author: "npj Digital Medicine",
    publish_date: "2026-02-18",
    summary: "A systematic review proposing a maturity model for healthcare organisations to assess and advance their AI governance frameworks.",
    source: "Nature",
    url: "https://www.nature.com/articles/s41746-026-02418-7",
    reading_time_min: 15,
  },
  {
    title: "Agentic AI and the Race to a Touchless Revenue Cycle",
    category: "Healthcare Operations & Workflow",
    keywords: ["agentic AI", "revenue cycle", "automation"],
    source_type: "Industry Analysis",
    related_platform_features: ["Billing", "Invoice Generation"],
    author: "McKinsey Healthcare",
    publish_date: "2026-03-01",
    summary: "How agentic AI could cut healthcare providers' cost to collect by 30–60%, optimise payment accuracy, and refocus the workforce on patient experience.",
    source: "McKinsey",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/agentic-ai-and-the-race-to-a-touchless-revenue-cycle",
    reading_time_min: 10,
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
