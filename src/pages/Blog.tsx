import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ExternalLink, BookOpen, ShieldCheck, Workflow, Globe, FlaskConical } from "lucide-react";
import { Chip, ChipGroup } from "@/components/ui/chip";
import SEO from "@/components/SEO";

type Category = "All" | "Clinical AI" | "Patient Safety" | "Healthcare Workflow" | "Digital Health" | "Research & Evidence";

const categoryIcons: Record<Category, React.ReactNode> = {
  "All": null,
  "Clinical AI": <BookOpen className="h-3 w-3" />,
  "Patient Safety": <ShieldCheck className="h-3 w-3" />,
  "Healthcare Workflow": <Workflow className="h-3 w-3" />,
  "Digital Health": <Globe className="h-3 w-3" />,
  "Research & Evidence": <FlaskConical className="h-3 w-3" />,
};

const categories: Category[] = ["All", "Clinical AI", "Patient Safety", "Healthcare Workflow", "Digital Health", "Research & Evidence"];

const articles: {
  source: string;
  title: string;
  description: string;
  url: string;
  category: Category;
  date: string;
}[] = [
  {
    source: "McKinsey",
    title: "What to Expect in US Healthcare in 2026 and Beyond",
    description: "McKinsey examines the financial strain on US healthcare and where AI-driven opportunities are emerging across provider, payer, and services segments.",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/what-to-expect-in-us-healthcare",
    category: "Healthcare Workflow",
    date: "2026-01-15",
  },
  {
    source: "Nature Medicine",
    title: "Generative Artificial Intelligence in Medicine",
    description: "A comprehensive review of how generative AI models are being applied across diagnostics, drug discovery, and clinical decision support in modern medicine.",
    url: "https://www.nature.com/articles/s41591-025-03983-2",
    category: "Clinical AI",
    date: "2025-12-10",
  },
  {
    source: "McKinsey",
    title: "The Coming Evolution of Healthcare AI Toward a Modular Architecture",
    description: "Why the surge in AI healthcare tools is prompting a shift from point solutions to integrated, modular architectures and clinical-data foundries.",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/the-coming-evolution-of-healthcare-ai-toward-a-modular-architecture",
    category: "Digital Health",
    date: "2025-11-20",
  },
  {
    source: "WHO Europe",
    title: "AI Is Reshaping Health Systems: State of Readiness Across the WHO European Region",
    description: "The World Health Organisation assesses how prepared European health systems are to adopt and govern artificial intelligence responsibly.",
    url: "https://www.who.int/europe/publications/i/item/WHO-EURO-2025-12707-52481-81028",
    category: "Patient Safety",
    date: "2025-10-05",
  },
  {
    source: "Nature",
    title: "Advancing Healthcare AI Governance Through a Comprehensive Maturity Model",
    description: "A systematic review proposing a maturity model for healthcare organisations to assess and advance their AI governance frameworks.",
    url: "https://www.nature.com/articles/s41746-026-02418-7",
    category: "Research & Evidence",
    date: "2026-02-18",
  },
  {
    source: "McKinsey",
    title: "Agentic AI and the Race to a Touchless Revenue Cycle",
    description: "How agentic AI could cut healthcare providers' cost to collect by 30–60%, optimise payment accuracy, and refocus the workforce on patient experience.",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/agentic-ai-and-the-race-to-a-touchless-revenue-cycle",
    category: "Healthcare Workflow",
    date: "2026-03-01",
  },
];

const Blog = () => {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered = activeCategory === "All"
    ? [...articles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : articles
        .filter((a) => a.category === activeCategory)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <SEO
        title="Research & Insights — DATAelixAIr"
        description="Evidence-driven perspectives on clinical AI, patient safety, and healthcare innovation. Curated research from McKinsey, Nature, and WHO."
      />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">
              Knowledge Hub
            </p>
            <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Research &amp; <em className="not-italic text-primary">Insights</em>
            </h1>
            <p className="mt-4 text-muted-foreground font-light leading-relaxed max-w-xl">
              Evidence-driven perspectives on clinical AI, patient safety, and healthcare innovation.
            </p>
            <p className="mt-3 text-sm text-muted-foreground/70 leading-relaxed max-w-lg">
              This knowledge hub curates research, clinical insights, and digital health developments shaping the future of healthcare.
            </p>
          </motion.div>

          {/* Category chips */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-8"
          >
            <ChipGroup>
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  variant={activeCategory === cat ? "action" : "neutral"}
                  selected={activeCategory === cat}
                  icon={categoryIcons[cat]}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </Chip>
              ))}
            </ChipGroup>
          </motion.div>
        </div>
      </section>

      {/* Articles grid */}
      <section className="pb-24 bg-background">
        <div className="container mx-auto px-4">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filtered.map((article, i) => (
                <motion.a
                  key={article.title}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group border border-border rounded-[20px] p-8 bg-card hover:border-primary hover:-translate-y-1 hover:shadow-card-hover transition-all flex flex-col cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                      {article.source}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground/60 ml-auto">
                      {new Date(article.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-3 leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-sm text-muted-foreground font-light leading-relaxed flex-1">
                    {article.description}
                  </p>
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <span className="text-xs text-muted-foreground/50">{article.category}</span>
                    <span className="flex items-center gap-2 text-primary text-sm font-medium">
                      Read Article <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </motion.a>
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-16">No articles in this category yet.</p>
          )}

          <div className="mt-16 text-center">
            <p className="text-muted-foreground font-light mb-4">Want to collaborate on research or suggest a topic?</p>
            <Button variant="outline" asChild>
              <Link to="/contact">Get in Touch <ArrowRight className="ml-1" size={14} /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Blog;
