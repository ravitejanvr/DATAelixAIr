import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Calendar } from "lucide-react";

const posts = [
  {
    date: "Feb 2026",
    category: "AI & Clinical Outcomes",
    title: "How AI Is Reshaping Patient Satisfaction in Hospitals",
    excerpt: "From predictive care pathways to real-time feedback loops, hospitals using AI are seeing measurable improvements in patient satisfaction scores. We explore the latest research and real-world applications.",
    readTime: "6 min read",
  },
  {
    date: "Jan 2026",
    category: "Regulations",
    title: "Navigating Healthcare AI Regulations: HIPAA, GDPR, and Beyond",
    excerpt: "As AI adoption in healthcare accelerates, so does regulatory scrutiny. A practical guide to the compliance landscape facing hospitals deploying AI solutions in 2026.",
    readTime: "8 min read",
  },
  {
    date: "Jan 2026",
    category: "Interoperability",
    title: "The State of HL7 FHIR Adoption: What Hospitals Need to Know",
    excerpt: "HL7 FHIR is becoming the backbone of healthcare data exchange. We break down adoption trends, implementation challenges, and why interoperability is critical for AI-driven care.",
    readTime: "5 min read",
  },
  {
    date: "Dec 2025",
    category: "Revenue Cycle",
    title: "AI-Powered Revenue Cycle Management: Early Results and Opportunities",
    excerpt: "Denial prediction, automated coding, and claims intelligence — early studies show AI can recover millions in lost revenue for hospitals. Here's what the data says.",
    readTime: "7 min read",
  },
  {
    date: "Dec 2025",
    category: "Data Security",
    title: "Zero-Trust Architecture for Healthcare: Why It Matters Now",
    excerpt: "Healthcare data breaches hit record highs in 2025. Zero-trust security models are emerging as the gold standard for protecting patient data in AI-enabled systems.",
    readTime: "6 min read",
  },
  {
    date: "Nov 2025",
    category: "Industry Trends",
    title: "The Rise of AI-First Hospitals: Lessons from Early Adopters",
    excerpt: "A small but growing number of hospitals are embedding AI into every workflow. We look at what's working, what's not, and what other facilities can learn from their journeys.",
    readTime: "9 min read",
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
            Insights, research, and perspectives on how AI is transforming hospitals and clinics around the world.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post, i) => (
            <motion.article
              key={post.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group border border-border rounded-[20px] p-8 bg-card hover:border-primary hover:-translate-y-1 hover:shadow-card-hover transition-all flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg teal-muted-bg teal-muted-border border text-primary">
                  {post.category}
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-3 leading-snug">
                {post.title}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed flex-1">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar size={12} />
                  {post.date} · {post.readTime}
                </div>
                <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground font-light mb-4">Want to contribute or suggest a topic?</p>
          <Button variant="outline" asChild>
            <Link to="/contact">Get in Touch <ArrowRight className="ml-1" size={14} /></Link>
          </Button>
        </div>
      </div>
    </section>
  </div>
);

export default Blog;
