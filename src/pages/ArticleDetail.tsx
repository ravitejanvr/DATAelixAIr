import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, ExternalLink, Calendar, ArrowRight,
  Stethoscope, FileText, ShieldCheck, Lightbulb, Zap, Building2, SearchX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import EvidenceSourcesPanel from "@/components/blog/EvidenceSourcesPanel";
import RelatedArticles from "@/components/blog/RelatedArticles";
import ArticleSkeleton from "@/components/blog/ArticleSkeleton";
import ArticleErrorBoundary from "@/components/blog/ArticleErrorBoundary";
import {
  staticArticles,
  categoryMeta,
  findRelatedArticles,
  detectFeatureLinks,
  type Article,
  type ArticleCategory,
} from "@/lib/blog-data";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import ProductInsightBlock from "@/components/blog/ProductInsightBlock";
import KeywordLinker from "@/components/blog/KeywordLinker";

// Safe accessor for article fields with defaults
function safe(article: Article) {
  return {
    title: article.title || "Untitled Article",
    slug: article.slug || "",
    summary: article.summary || "",
    content: article.content || "",
    author: article.author || "DATAelixAIr Research",
    publish_date: article.publish_date || new Date().toISOString().split("T")[0],
    reading_time_min: article.reading_time_min || 5,
    category: (article.category || "Research & Evidence") as ArticleCategory,
    keywords: article.keywords || [],
    key_findings: article.key_findings || [],
    clinical_implications: article.clinical_implications || "",
    source_type: article.source_type || "Editorial",
    source_name: article.source_name || "",
    source_url: article.source_url || "",
    meta_title: article.meta_title || `${article.title || "Article"} — DATAelixAIr`,
    meta_description: article.meta_description || article.summary || "",
    related_platform_features: article.related_platform_features || [],
  };
}

// Platform features for sidebar
const PLATFORM_FEATURES = [
  {
    name: "Clinical Documentation Workspace",
    description: "AI-powered consultation recording and structured clinical note generation.",
    icon: FileText,
    path: "/clinical",
  },
  {
    name: "Clinical Guardrail Engine",
    description: "Real-time drug interaction detection, allergy alerts, and clinical risk signals.",
    icon: ShieldCheck,
    path: "/vision",
  },
  {
    name: "AI Copilot",
    description: "Evidence-based clinical suggestions integrated into consultation workflows.",
    icon: Lightbulb,
    path: "/vision",
  },
];

// Generate a clinic scenario based on article content
function generateClinicScenario(article: Article): { title: string; scenario: string } {
  const cat = article.category;
  const scenarios: Record<string, { title: string; scenario: string }> = {
    "Clinical AI & Decision Support": {
      title: "How This Applies in a Private Clinic",
      scenario: `A physician in a busy outpatient clinic records a 10-minute patient consultation. The AI documentation system transcribes and structures the conversation into SOAP notes, flags potential drug interactions from the patient's medication history, and surfaces relevant clinical guidelines — all within seconds of the consultation ending. The physician reviews, edits if needed, and confirms. Documentation time drops from 15 minutes to under 2 minutes per patient.`,
    },
    "Patient Safety & Clinical Governance": {
      title: "Real-World Safety in Clinical Practice",
      scenario: `During a routine prescription, the system detects a potential contraindication between a newly prescribed medication and the patient's existing treatment plan. The clinician receives an immediate, evidence-backed alert with the specific interaction risk and alternative options. Every alert and clinician response is logged in an immutable audit trail, supporting clinical governance requirements without adding administrative burden.`,
    },
    "Healthcare Operations & Workflow": {
      title: "Streamlining Daily Clinic Operations",
      scenario: `A front desk staff member registers a walk-in patient using a QR code-based intake form. The patient's vitals are recorded digitally, and the system automatically assigns a queue token. The doctor sees a pre-populated clinical context before the consultation begins — chief complaint, vitals, and relevant medical history — reducing intake-to-consultation time by 60%.`,
    },
    "Digital Health & Interoperability": {
      title: "Connecting Clinical Data Seamlessly",
      scenario: `A multi-specialty clinic uses a FHIR-ready data structure that allows lab results, prescription records, and consultation notes to flow between departments without manual re-entry. When a patient returns for a follow-up, the treating physician instantly sees the complete visit timeline — previous diagnoses, test results, and treatment outcomes — enabling more informed clinical decisions.`,
    },
    "Research & Evidence": {
      title: "Evidence-Informed Clinical Practice",
      scenario: `A physician managing a complex case reviews the AI-generated clinical summary, which includes relevant PubMed citations and guideline-backed treatment recommendations. Rather than spending time searching medical literature, the clinician gets curated evidence integrated directly into the consultation workflow — supporting better outcomes while maintaining clinical autonomy.`,
    },
  };
  return scenarios[cat] || scenarios["Clinical AI & Decision Support"];
}

function ArticleNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <SearchX className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Article Not Found</h1>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          This article may have been removed, unpublished, or the link may be incorrect. 
          Browse our Research & Insights hub for the latest content.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link to="/blog">
            <ArrowLeft size={14} className="mr-1" /> Browse All Articles
          </Link>
        </Button>
        <Button asChild>
          <Link to="/pilot-request">Request Pilot Access</Link>
        </Button>
      </div>
    </div>
  );
}

function ArticleDetailInner() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [allArticles, setAllArticles] = useState<Article[]>(staticArticles);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadArticle();
  }, [slug]);

  const loadArticle = async () => {
    setLoading(true);
    setNotFound(false);

    try {
      // Only fetch published articles
      const { data: dbArticles } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("status", "published") as any;

      const dbList: Article[] = (dbArticles || []).map((a: any) => ({
        ...a,
        publish_date: a.publish_date || a.created_at || new Date().toISOString().split("T")[0],
        source_name: a.source_name || "",
        source_url: a.source_url || "",
        keywords: a.keywords || [],
        key_findings: a.key_findings || [],
        related_platform_features: a.related_platform_features || [],
      }));

      const publishedStatic = staticArticles.filter((s) => s.status === "published");
      const combined = [
        ...dbList,
        ...publishedStatic.filter((s) => !dbList.some((d) => d.slug === s.slug)),
      ];
      setAllArticles(combined);

      const found = combined.find((a) => a.slug === slug) || null;
      setArticle(found);
      if (!found) setNotFound(true);
    } catch {
      // Fallback to static published articles
      const publishedStatic = staticArticles.filter((s) => s.status === "published");
      setAllArticles(publishedStatic);
      const found = publishedStatic.find((a) => a.slug === slug) || null;
      setArticle(found);
      if (!found) setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ArticleSkeleton />;
  if (notFound || !article) return <ArticleNotFound />;

  const s = safe(article);
  const meta = categoryMeta[s.category] || categoryMeta["Research & Evidence"];
  const Icon = meta.icon;
  const related = findRelatedArticles(article, allArticles);
  const capabilities = detectFeatureLinks(article);
  const clinicScenario = generateClinicScenario(article);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: s.title,
    description: s.summary,
    author: { "@type": "Person", name: s.author },
    datePublished: s.publish_date,
    publisher: { "@type": "Organization", name: "DATAelixAIr" },
    keywords: s.keywords.join(", "),
  };

  return (
    <div>
      <SEO title={s.meta_title} description={s.meta_description} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <section className="pt-28 pb-8 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft size={14} /> Back to Research & Insights
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${meta.colorClass}`}>
                <Icon className="h-3 w-3" />
                {s.category}
              </span>
              {s.source_type === "Research" && s.source_name && (
                <span className="text-[0.6rem] font-medium uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                  {s.source_name}
                </span>
              )}
            </div>

            <h1 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.15] tracking-tight text-foreground mb-4 max-w-3xl">
              {s.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {(() => {
                  try {
                    return new Date(s.publish_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                  } catch {
                    return s.publish_date;
                  }
                })()}
              </span>
              <span className="flex items-center gap-1"><Clock size={14} /> {s.reading_time_min} min read</span>
              <span>{s.author}</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main content + sidebar */}
      <section className="pb-12 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid lg:grid-cols-[1fr_280px] gap-8">
            {/* Main article */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>

              {/* Section 1: Problem / Summary */}
              {s.summary && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-md bg-destructive/10 flex items-center justify-center">
                      <Stethoscope className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <h2 className="font-display text-base font-bold text-foreground">The Problem</h2>
                  </div>
                  <p className="text-[0.95rem] text-muted-foreground font-light leading-relaxed border-l-2 border-primary/30 pl-4">
                    {s.summary}
                  </p>
                </div>
              )}

              {/* Section 2: Evidence / Key Findings */}
              {s.key_findings.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h2 className="font-display text-base font-bold text-foreground">Evidence</h2>
                  </div>
                  <ul className="space-y-2.5">
                    {s.key_findings.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5 shrink-0">
                          {i + 1}
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Section 3: Insight / Content */}
              {s.content && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                      <Lightbulb className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h2 className="font-display text-base font-bold text-foreground">Insight</h2>
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{s.content}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Section 4: Clinical Implications */}
              {s.clinical_implications && (
                <div className="mb-8 p-5 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-base font-bold text-foreground">Clinical Implication</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.clinical_implications}</p>
                </div>
              )}

              {/* Section 5: Related Platform Capability (inline) */}
              {capabilities.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                      <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="font-display text-base font-bold text-foreground">Related Platform Capability</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Technology designed to address the challenges described in this research:
                  </p>
                  <div className="space-y-2">
                    {capabilities.slice(0, 2).map((cap) => (
                      <Link
                        key={cap.name}
                        to={cap.path}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all group"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{cap.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{cap.description}</p>
                        </div>
                        <ArrowRight size={14} className="text-primary mt-1 shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinic Scenario block */}
              <div className="mb-8 rounded-xl border border-border bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-base font-bold text-foreground">{clinicScenario.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  {clinicScenario.scenario}
                </p>
              </div>

              {/* External source */}
              {s.source_url && (
                <div className="mb-8">
                  <Button variant="outline" size="sm" asChild>
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer">
                      Read Original Source <ExternalLink size={14} className="ml-1" />
                    </a>
                  </Button>
                </div>
              )}

              {/* Soft CTAs */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Button asChild>
                  <Link to="/vision">
                    Explore the Platform <ArrowRight size={14} className="ml-1" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/pilot-request">
                    Request Pilot Access <ArrowRight size={14} className="ml-1" />
                  </Link>
                </Button>
              </div>

              {/* Evidence panel */}
              <EvidenceSourcesPanel article={article} />
            </motion.div>

            {/* Sidebar */}
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="hidden lg:block space-y-5"
            >
              {/* Platform Features sidebar */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    Platform Features
                  </h3>
                  <div className="space-y-3">
                    {PLATFORM_FEATURES.map((feat) => {
                      const FeatIcon = feat.icon;
                      return (
                        <Link
                          key={feat.name}
                          to={feat.path}
                          className="block p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start gap-2">
                            <FeatIcon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                                {feat.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                {feat.description}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Keywords */}
              {s.keywords.length > 0 && (
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Topics</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {s.keywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{kw}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sidebar CTA */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-semibold text-foreground mb-1.5">
                    See how this applies to your clinic
                  </p>
                  <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                    Join our pilot programme and experience AI-assisted clinical workflows firsthand.
                  </p>
                  <Button size="sm" className="w-full" asChild>
                    <Link to="/pilot-request">
                      Request Pilot Access
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.aside>
          </div>
        </div>
      </section>

      {/* Related articles */}
      <section className="pb-12 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <RelatedArticles articles={related} />
        </div>
      </section>

      {/* Bottom pilot access banner */}
      <section className="py-12 bg-muted/40 border-t border-border/40">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              Ready to see AI-assisted clinical workflows in action?
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto leading-relaxed">
              DATAelixAIr is designed for private clinics looking to reduce documentation time,
              improve patient safety, and modernise clinical operations. Join our pilot programme.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild>
                <Link to="/pilot-request">
                  Request Pilot Access <ArrowRight size={14} className="ml-1" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/vision">
                  Explore the Platform
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

export default function ArticleDetail() {
  return (
    <ArticleErrorBoundary>
      <ArticleDetailInner />
    </ArticleErrorBoundary>
  );
}
