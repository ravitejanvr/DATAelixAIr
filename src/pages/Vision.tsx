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
    title: "Explainable by Default",
    desc: "Outputs include reasoning and supporting context.",
  },
  {
    icon: ShieldCheck,
    title: "Clinician-in-the-Loop",
    desc: "Nothing is final without doctor approval.",
  },
  {
    icon: Heart,
    title: "Safety Before Automation",
    desc: "Systems assist, never override clinical judgment.",
  },
  {
    icon: Globe,
    title: "Designed to Integrate",
    desc: "Works with existing clinical systems.",
  },
  {
    icon: Users,
    title: "Built for Care Teams",
    desc: "Supports coordination across clinical roles.",
  },
  {
    icon: BookOpen,
    title: "Grounded in Evidence",
    desc: "Aligned with clinical guidelines and literature.",
  },
];

const Vision = () => (
  <div>
    <SEO title="Clinical Doctrine — DATAelixAIr™ by elixAIr" description="Systems should support how clinicians think, document, and decide. Our clinical doctrine defines how we build." />

    <section className="pt-32 pb-16 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" animate="visible" className="max-w-2xl mx-auto text-center">
          <motion.p variants={fadeUp} custom={0} className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">
            Clinical Doctrine
          </motion.p>
          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Clinical Intelligence,{" "}
            <em className="not-italic text-primary">Grounded in Practice</em>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            Systems should support how clinicians think, document, and decide.
          </motion.p>
        </motion.div>
      </div>
    </section>

    {/* Today / Tomorrow */}
    <section className="py-16 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="border border-primary/30 rounded-2xl p-8 bg-background">
            <p className="text-xs font-mono font-bold text-primary uppercase tracking-widest mb-3">What Exists Today</p>
            <h3 className="font-display text-lg font-bold text-foreground mb-3">Fragmented Documentation</h3>
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              Documentation is fragmented and disconnected from clinical reasoning.
            </p>
          </div>
          <div className="border border-border rounded-2xl p-8 bg-background">
            <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3">What We're Building</p>
            <h3 className="font-display text-lg font-bold text-foreground mb-3">Unified Clinical Workspace</h3>
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              A unified workspace where documentation and decisions happen together.
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
            How We <em className="not-italic text-primary">Build</em>
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

    {/* How Clinical Systems Should Work */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Doctrine</p>
          <h2 className="font-display text-[clamp(2rem,3.5vw,2.5rem)] font-extrabold text-foreground mb-8">
            How Clinical Systems <em className="not-italic text-primary">Should Work</em>
          </h2>
          <div className="space-y-4">
            {[
              "Documentation happens during the consultation, not after.",
              "Outputs are structured, reviewable, and immediately usable.",
              "Reasoning is preserved, not lost.",
              "Patient communication is generated alongside clinical notes.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3 border border-border rounded-xl p-4 bg-background">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <p className="text-sm text-foreground font-medium leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground">Work With Us on Real Clinical Workflows</h2>
        <p className="mt-3 text-muted-foreground font-light max-w-md mx-auto">
          We collaborate with a small number of clinics.
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
