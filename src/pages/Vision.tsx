import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { Brain, ShieldCheck, Users, Globe, Heart, BookOpen, ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

const principles = [
  {
    icon: Brain,
    title: "Explainable AI Philosophy",
    desc: "Every AI recommendation includes interpretable reasoning, evidence citations, and confidence levels. Clinicians should always understand why an AI reached a conclusion.",
  },
  {
    icon: ShieldCheck,
    title: "Ethical Clinical AI Development",
    desc: "We follow a responsible AI framework — bias monitoring, fairness testing, and continuous model validation against real-world clinical outcomes.",
  },
  {
    icon: Globe,
    title: "Interoperability Research",
    desc: "Our long-term goal is seamless integration with HL7 FHIR, regional EHR systems, and diagnostic platforms — enabling unified patient records across providers.",
  },
  {
    icon: Heart,
    title: "Patient Safety Commitment",
    desc: "AI outputs are always presented as clinical drafts requiring human review. We are committed to zero avoidable harm from AI-assisted decisions.",
  },
  {
    icon: Users,
    title: "Multidisciplinary Care Model",
    desc: "We're building towards a shared patient record model where doctors, nurses, pharmacists, and coordinators contribute to a single longitudinal record.",
  },
  {
    icon: BookOpen,
    title: "Evidence-Based Innovation",
    desc: "Our clinical AI integrates PubMed-backed evidence and validated clinical guidelines. Every feature is grounded in published medical research.",
  },
];

const Vision = () => (
  <div>
    <SEO title="Vision — DATAelixAIr" description="Our long-term vision for building an intelligent, ethical healthcare AI ecosystem." />

    <section className="pt-32 pb-16 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" animate="visible" className="max-w-2xl mx-auto text-center">
          <motion.p variants={fadeUp} custom={0} className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">
            Our Vision
          </motion.p>
          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Building the Future of{" "}
            <em className="not-italic text-primary">Clinical AI</em>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            We're on a mission to make healthcare documentation effortless, clinical decisions more informed, and patient records truly unified — powered by transparent, responsible AI.
          </motion.p>
        </motion.div>
      </div>
    </section>

    {/* Current vs Future */}
    <section className="py-16 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="border border-primary/30 rounded-2xl p-8 bg-background">
            <p className="text-xs font-mono font-bold text-primary uppercase tracking-widest mb-3">Today</p>
            <h3 className="font-display text-lg font-bold text-foreground mb-3">AI Clinical Documentation</h3>
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              Voice-to-SOAP notes, prescription drafts, and patient summaries — designed for private clinics in India. Currently in early pilot with select healthcare providers.
            </p>
          </div>
          <div className="border border-border rounded-2xl p-8 bg-background">
            <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3">Tomorrow</p>
            <h3 className="font-display text-lg font-bold text-foreground mb-3">Intelligent Healthcare AI Ecosystem</h3>
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              A connected platform where clinical documentation, decision support, patient engagement, and care coordination work together — powered by explainable, auditable AI.
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* Principles */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Our Principles</p>
          <h2 className="font-display text-[clamp(2rem,3.5vw,2.5rem)] font-extrabold text-foreground">
            Aspirational but <em className="not-italic text-primary">Grounded</em>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {principles.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="border border-border rounded-2xl p-7 bg-card hover:border-primary/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mb-4">
                <p.icon className="text-primary" size={20} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-2">{p.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 bg-card border-t border-border">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground">Want to shape the future of clinical AI?</h2>
        <p className="mt-3 text-muted-foreground font-light max-w-md mx-auto">
          Join our early pilot programme or connect with us to explore partnership opportunities.
        </p>
        <div className="flex justify-center gap-4 mt-8">
          <Button variant="default" asChild>
            <Link to="/onboard">Apply for Pilot <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contact">Get in Touch</Link>
          </Button>
        </div>
      </div>
    </section>
  </div>
);

export default Vision;
