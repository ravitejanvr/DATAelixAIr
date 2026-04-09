import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

const principles = [
  { title: "Explainable by Default", desc: "Outputs include reasoning and supporting context." },
  { title: "Clinician-in-the-Loop", desc: "Nothing is final without doctor approval." },
  { title: "Safety Before Automation", desc: "Systems assist, never override clinical judgment." },
  { title: "Designed to Integrate", desc: "Works with existing clinical systems." },
  { title: "Built for Care Teams", desc: "Supports coordination across clinical roles." },
  { title: "Grounded in Evidence", desc: "Aligned with clinical guidelines and literature." },
];

const Vision = () => (
  <div>
    <SEO title="Clinical Doctrine — DATAelixAIr™ by elixAIr" description="Systems should support how clinicians think, document, and decide. Our clinical doctrine defines how we build." />

    {/* Hero */}
    <section className="pt-36 pb-20">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" animate="visible" className="max-w-2xl mx-auto text-center">
          <motion.p variants={fadeUp} custom={0} className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground mb-4">
            Clinical Doctrine
          </motion.p>
          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-foreground">
            Clinical Intelligence, Grounded in Practice
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Systems should support how clinicians think, document, and decide.
          </motion.p>
        </motion.div>
      </div>
    </section>

    {/* Today / Tomorrow */}
    <section className="py-20 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-16 max-w-3xl mx-auto">
          <div>
            <p className="text-xs font-mono font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">What Exists Today</p>
            <h3 className="text-base font-semibold text-foreground mb-2">Fragmented Documentation</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Documentation is fragmented and disconnected from clinical reasoning.
            </p>
          </div>
          <div>
            <p className="text-xs font-mono font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">What We're Building</p>
            <h3 className="text-base font-semibold text-foreground mb-2">Unified Clinical Workspace</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A unified workspace where documentation and decisions happen together.
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* Principles */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold text-foreground">
            How We Build
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-16 gap-y-10 max-w-4xl mx-auto">
          {principles.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* How Clinical Systems Should Work */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold text-foreground mb-10">
            How Clinical Systems Should Work
          </h2>
          <div className="space-y-6">
            {[
              "Documentation happens during the consultation, not after.",
              "Outputs are structured, reviewable, and immediately usable.",
              "Reasoning is preserved, not lost.",
              "Patient communication is generated alongside clinical notes.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-foreground mt-2 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">Work With Us on Real Clinical Workflows</h2>
        <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
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
