import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Lightbulb, Link2, BarChart3, BrainCircuit, ShieldCheck, Heart, Eye, Globe } from "lucide-react";
import SEO from "@/components/SEO";

const roadmapItems = [
  { icon: Link2, title: "Interoperability", desc: "HL7 FHIR integrations for seamless EHR connectivity.", status: "Planned" },
  { icon: BrainCircuit, title: "Clinical Decision Support", desc: "AI-assisted diagnostic suggestions with full explainability.", status: "Research" },
  { icon: BarChart3, title: "Practice Analytics", desc: "Consultation patterns, workload insights, and quality metrics.", status: "Planned" },
  { icon: Globe, title: "Multi-Language Support", desc: "Consultation recording in regional Indian languages and Hindi.", status: "Planned" },
];

const Vision = () => (
  <div>
    <SEO
      title="Vision — DATAelixAIr"
      description="Our long-term vision for building an intelligent, ethical healthcare AI ecosystem — grounded in clinical safety and explainability."
    />

    {/* Hero */}
    <section className="pt-32 pb-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Vision</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
            Building Towards an Intelligent <em className="not-italic text-primary">Healthcare AI Ecosystem</em>
          </h1>
          <p className="mt-6 text-muted-foreground font-light leading-relaxed">
            Today, DATAelixAIr is a clinical documentation assistant. Tomorrow, we aim to be a trusted AI layer across the entire clinical workflow — always explainable, always clinician-controlled.
          </p>
        </motion.div>
      </div>
    </section>

    {/* Philosophy */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Our Philosophy</p>
          <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-10">
            Principles That Guide Us
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: Eye, title: "Explainable AI", desc: "Every AI recommendation comes with clear reasoning. No black-box decisions in clinical care." },
              { icon: ShieldCheck, title: "Clinical Safety First", desc: "Human-in-the-loop architecture ensures clinicians always have final authority over AI outputs." },
              { icon: Heart, title: "Patient-Centric Design", desc: "Technology exists to serve better patient outcomes, not replace clinical judgement." },
              { icon: Lightbulb, title: "Honest About Our Stage", desc: "We distinguish clearly between what we offer today and what we're building towards." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-border bg-background"
              >
                <div className="w-11 h-11 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mb-4">
                  <item.icon className="text-primary" size={20} />
                </div>
                <h3 className="font-display text-sm font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Roadmap */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Future Roadmap</p>
          <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-4">
            What We're Building Next
          </h2>
          <p className="text-sm text-muted-foreground font-light leading-relaxed mb-10">
            These features are in research or planning stages. They are <strong className="font-semibold text-foreground">not yet available</strong> in the current product.
          </p>
          <div className="space-y-4">
            {roadmapItems.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-4 p-5 rounded-2xl border border-border bg-card"
              >
                <div className="w-11 h-11 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center shrink-0">
                  <item.icon className="text-primary" size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display text-sm font-bold text-foreground">{item.title}</h3>
                    <span className="text-[0.6rem] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-light leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* CDSS Research Note */}
    <section className="py-16 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Research & Future Development</p>
          <h2 className="font-display text-xl font-bold text-foreground mb-4">Clinical Decision Support System (CDSS)</h2>
          <p className="text-sm text-muted-foreground font-light leading-relaxed mb-6">
            Our CDSS module is currently a research prototype. It is not available as a production-ready clinical decision engine and should not be relied upon for clinical decisions at this stage. We are actively developing and validating this capability.
          </p>
          <div className="teal-muted-bg border teal-muted-border rounded-xl px-6 py-4 inline-block">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Status:</span> Prototype — Internal Research Only
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* WHO Alignment */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Globe className="w-8 h-8 text-primary mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-4">
            Aligned with Global Patient Safety Standards
          </h2>
          <p className="text-sm text-muted-foreground font-light leading-relaxed mb-8 max-w-lg mx-auto">
            Our approach is informed by the WHO Global Patient Safety Action Plan 2021–2030 — supporting evidence-based policies, safety culture, and data-driven improvement in healthcare systems.
          </p>
          <Button variant="outline" asChild>
            <Link to="/contact">Learn More →</Link>
          </Button>
        </div>
      </div>
    </section>
  </div>
);

export default Vision;
