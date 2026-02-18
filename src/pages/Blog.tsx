import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";

const articles = [
  {
    source: "CapTech",
    title: "2026 Healthcare Trends: Strategic Imperatives for Effective AI",
    description: "Explores how health systems should prioritise AI investments in 2026, covering operational efficiency, clinical decision support, and the role of leadership in driving adoption.",
    url: "https://www.captechconsulting.com/insights/2026-healthcare-trends-strategic-imperatives-for-effective-ai",
  },
  {
    source: "BCG",
    title: "How AI Agents and Tech Will Transform Health Care in 2026",
    description: "Boston Consulting Group outlines how autonomous AI agents, ambient documentation, and new care models will reshape the healthcare landscape over the coming year.",
    url: "https://www.bcg.com/publications/2025/how-ai-agents-tech-will-transform-health-care-in-2026",
  },
  {
    source: "Nature",
    title: "The Landscape of AI Implementation in US Hospitals",
    description: "A comprehensive look at adoption patterns, barriers, and early outcomes as US hospitals integrate artificial intelligence into clinical and operational workflows.",
    url: "https://www.nature.com/articles/s41746-025-01532-8",
  },
  {
    source: "Scientific American",
    title: "AI Is Entering Health Care, and Nurses Are Being Asked to Trust It",
    description: "An examination of how frontline clinicians — especially nurses — are experiencing the AI transition, and what trust, training, and transparency mean in practice.",
    url: "https://www.scientificamerican.com/article/ai-is-entering-health-care-and-nurses-are-being-asked-to-trust-it/",
  },
  {
    source: "Global Healthcare Resource",
    title: "Six Healthcare Trends to Watch in 2026",
    description: "From precision medicine to AI-powered diagnostics, this article highlights the six macro trends that will define how healthcare organisations operate and innovate in 2026.",
    url: "https://www.globalhealthcareresource.com/six-healthcare-trends-to-watch-in-2026/",
  },
  {
    source: "Cigna Newsroom",
    title: "Top Health Care Trends for 2026",
    description: "Cigna's outlook on the forces shaping healthcare — including the growing role of AI in preventive care, member engagement, and operational transformation.",
    url: "https://newsroom.cigna.com/top-health-care-trends-for-2026",
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
