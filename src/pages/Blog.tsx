import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const blogPosts = [
  {
    slug: "ai-scribe-nhs-documentation",
    title: "How AI Scribes Are Cutting NHS Documentation Time by 30%",
    excerpt: "Clinicians spend up to 50% of their time on paperwork. AI-powered clinical scribes are transforming workflows by transcribing and drafting notes in real time.",
    category: "AI in Healthcare",
    date: "Feb 2026",
    readTime: "5 min read",
    featured: true,
  },
  {
    slug: "patient-satisfaction-ai",
    title: "The Link Between AI Automation and Patient Satisfaction Scores",
    excerpt: "When doctors spend less time on screens and more time with patients, satisfaction scores soar. Here's the data behind the shift.",
    category: "Patient Care",
    date: "Jan 2026",
    readTime: "4 min read",
    featured: false,
  },
  {
    slug: "nhs-dtac-compliance-guide",
    title: "A Complete Guide to NHS DTAC Compliance for Health Tech Startups",
    excerpt: "Navigating NHS Digital Technology Assessment Criteria can be complex. We break down the key requirements for AI solutions in UK healthcare.",
    category: "Compliance",
    date: "Jan 2026",
    readTime: "7 min read",
    featured: false,
  },
  {
    slug: "clinician-burnout-ai-solution",
    title: "1 in 3 UK Clinicians Face Burnout — Can AI Help?",
    excerpt: "Burnout is at crisis levels in the NHS. We explore how automating administrative tasks can give clinicians their time — and wellbeing — back.",
    category: "Workforce",
    date: "Dec 2025",
    readTime: "6 min read",
    featured: false,
  },
  {
    slug: "fhir-interoperability-2026",
    title: "HL7 FHIR in 2026: The State of Healthcare Interoperability",
    excerpt: "FHIR adoption is accelerating. We look at how standards-based integration is enabling connected care across NHS trusts and private providers.",
    category: "Interoperability",
    date: "Dec 2025",
    readTime: "5 min read",
    featured: false,
  },
  {
    slug: "predictive-analytics-hospitals",
    title: "Predictive Analytics: Reducing Hospital Readmissions with AI",
    excerpt: "Machine learning models can identify patients at risk of readmission before discharge. Here's how UK hospitals are starting to use them.",
    category: "Analytics",
    date: "Nov 2025",
    readTime: "6 min read",
    featured: false,
  },
];

const Blog = () => (
  <div>
    {/* Hero */}
    <section className="pt-32 pb-16 bg-background relative overflow-hidden">
      <div className="absolute inset-0 hero-grid-bg opacity-50" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Blog & Insights</p>
          <h1 className="font-display text-[clamp(2.4rem,4.5vw,3.5rem)] font-extrabold leading-[1.05] tracking-tight text-foreground">
            AI Healthcare <em className="not-italic text-primary">Trends</em> & Insights
          </h1>
          <p className="mt-5 text-lg font-light leading-relaxed text-muted-foreground">
            Stay ahead with the latest on AI in clinical workflows, regulatory compliance, patient outcomes, and healthcare technology.
          </p>
        </motion.div>
      </div>
    </section>

    {/* Featured Post */}
    {blogPosts.filter(p => p.featured).map(post => (
      <section key={post.slug} className="pb-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-foreground rounded-3xl p-10 md:p-14 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 gradient-teal" />
            <span className="inline-block text-xs font-medium uppercase tracking-[0.08em] text-primary bg-primary/10 px-3 py-1 rounded-full mb-6">
              Featured
            </span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.4rem)] font-extrabold text-background leading-tight max-w-2xl">
              {post.title}
            </h2>
            <p className="mt-4 text-background/50 font-light leading-relaxed max-w-xl">
              {post.excerpt}
            </p>
            <div className="flex items-center gap-5 mt-6 text-background/30 text-xs">
              <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
              <span className="px-2 py-0.5 rounded-full border border-background/10 text-background/40">{post.category}</span>
            </div>
            <Button variant="default" className="mt-8" asChild>
              <Link to="#">Read Article <ArrowRight className="ml-1" size={14} /></Link>
            </Button>
          </motion.div>
        </div>
      </section>
    ))}

    {/* All Posts */}
    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4">
        <h3 className="font-display text-xl font-bold text-foreground mb-8">Recent Articles</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {blogPosts.filter(p => !p.featured).map((post, i) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group bg-card border border-border rounded-[20px] p-8 hover:border-primary hover:shadow-card-hover hover:-translate-y-1 transition-all"
            >
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-primary bg-primary/8 px-2.5 py-1 rounded-full border teal-muted-border">
                {post.category}
              </span>
              <h4 className="font-display text-lg font-bold text-foreground mt-4 mb-3 leading-snug group-hover:text-primary transition-colors">
                {post.title}
              </h4>
              <p className="text-sm font-light leading-relaxed text-muted-foreground mb-5">
                {post.excerpt}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-mid">
                <span className="flex items-center gap-1"><Calendar size={11} /> {post.date}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {post.readTime}</span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="bg-dark py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold text-dark-foreground mb-4">
          Ready to Transform Your <em className="not-italic text-primary">Healthcare Facility</em>?
        </h2>
        <p className="text-dark-muted font-light max-w-lg mx-auto mb-8">
          Whether you're a single clinic or a multi-site hospital network, let's explore how AI can work for you.
        </p>
        <Button variant="default" size="lg" asChild>
          <Link to="/contact">Get in Touch →</Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Blog;
