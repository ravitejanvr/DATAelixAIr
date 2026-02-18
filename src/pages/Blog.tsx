import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";

const articles = [
  {
    source: "McKinsey",
    title: "What to Expect in US Healthcare in 2026 and Beyond",
    description: "McKinsey examines the financial strain on US healthcare and where AI-driven opportunities are emerging across provider, payer, and services segments.",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/what-to-expect-in-us-healthcare",
  },
  {
    source: "Nature Medicine",
    title: "Generative Artificial Intelligence in Medicine",
    description: "A comprehensive review of how generative AI models are being applied across diagnostics, drug discovery, and clinical decision support in modern medicine.",
    url: "https://www.nature.com/articles/s41591-025-03983-2",
  },
  {
    source: "McKinsey",
    title: "The Coming Evolution of Healthcare AI Toward a Modular Architecture",
    description: "Why the surge in AI healthcare tools is prompting a shift from point solutions to integrated, modular architectures and clinical-data foundries.",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/the-coming-evolution-of-healthcare-ai-toward-a-modular-architecture",
  },
  {
    source: "WHO Europe",
    title: "AI Is Reshaping Health Systems: State of Readiness Across the WHO European Region",
    description: "The World Health Organisation assesses how prepared European health systems are to adopt and govern artificial intelligence responsibly.",
    url: "https://www.who.int/europe/publications/i/item/WHO-EURO-2025-12707-52481-81028",
  },
  {
    source: "Nature",
    title: "Advancing Healthcare AI Governance Through a Comprehensive Maturity Model",
    description: "A systematic review proposing a maturity model for healthcare organisations to assess and advance their AI governance frameworks.",
    url: "https://www.nature.com/articles/s41746-026-02418-7",
  },
  {
    source: "McKinsey",
    title: "Agentic AI and the Race to a Touchless Revenue Cycle",
    description: "How agentic AI could cut healthcare providers' cost to collect by 30–60%, optimise payment accuracy, and refocus the workforce on patient experience.",
    url: "https://www.mckinsey.com/industries/healthcare/our-insights/agentic-ai-and-the-race-to-a-touchless-revenue-cycle",
  },
];

const Blog = () => (
  <div>
    <section className="pt-32 pb-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Blog & Insights</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Latest Trends in <em className="not-italic text-primary">Healthcare AI</em>
          </h1>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed">
            Curated articles from trusted sources on how AI is transforming hospitals and clinical practice worldwide.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((article, i) => (
            <motion.a
              key={article.title}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group border border-border rounded-[20px] p-8 bg-card hover:border-primary hover:-translate-y-1 hover:shadow-card-hover transition-all flex flex-col cursor-pointer"
            >
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg teal-muted-bg teal-muted-border border text-primary self-start mb-4">
                {article.source}
              </span>
              <h3 className="font-display text-lg font-bold text-foreground mb-3 leading-snug">
                {article.title}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed flex-1">
                {article.description}
              </p>
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border text-primary text-sm font-medium">
                Read Article <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </motion.a>
          ))}
        </div>

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

export default Blog;
