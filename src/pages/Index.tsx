import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mic, FileText, Pill, ClipboardList, ArrowRight, ShieldCheck, Stethoscope, Eye, Lock, Globe, Building2, Hospital, BrainCircuit } from "lucide-react";
import HeroDashboard from "@/components/HeroDashboard";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.8 } }),
};

const Index = () => (
  <div>
    <SEO
      title="DATAelixAIr — AI Clinical Documentation in Under 60 Seconds"
      description="Convert consultation audio into structured SOAP notes, prescription drafts, and patient summaries — securely and reviewable by clinicians."
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DATAelixAIr",
          url: "https://dataelixair.lovable.app",
          description: "AI clinical documentation assistant for private clinics. Convert consultation audio into structured SOAP notes.",
          sameAs: [
            "https://www.linkedin.com/company/107182001/admin/dashboard/",
            "https://x.com/dataelixair",
          ],
        }),
      }}
    />

    {/* Hero */}
    <section className="min-h-screen relative overflow-hidden flex items-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,hsl(var(--teal)/0.06),transparent_70%)]" />
      <div className="container mx-auto px-4 pt-32 pb-20 relative z-10">
        <motion.div initial="hidden" animate="visible" className="text-center max-w-3xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground">
            <Mic className="w-3.5 h-3.5 text-primary" />
            AI-Powered Clinical Documentation
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
            AI Clinical Documentation{" "}
            <em className="not-italic text-primary">in Under 60 Seconds</em>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="mt-7 text-[clamp(1rem,1.4vw,1.15rem)] font-light leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            Convert consultation audio into structured SOAP notes, prescription drafts, and patient summaries — securely and reviewable by clinicians.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap justify-center gap-4">
            <Button variant="default" size="lg" asChild>
              <Link to="/contact">Request Pilot Access →</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/contact">Book Demo</Link>
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div variants={fadeUp} custom={3.5} className="mt-8 flex flex-wrap justify-center gap-5">
            {[
              { icon: Lock, label: "TLS 1.3 Secured" },
              { icon: Globe, label: "DPDP / GDPR Aligned" },
              { icon: ShieldCheck, label: "Clinician-Controlled AI" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1.5">
                <t.icon size={13} className="text-primary" />
                <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.9 }}
          className="mt-20 max-w-2xl mx-auto"
        >
          <HeroDashboard />
        </motion.div>
      </div>
    </section>

    {/* How It Works */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">How It Works</p>
          <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Four Simple Steps
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Mic, title: "Record Consultation", desc: "Voice capture during patient visit." },
            { icon: FileText, title: "AI Structures Notes", desc: "Automatic SOAP note generation." },
            { icon: Eye, title: "Review & Edit", desc: "Clinician reviews and approves output." },
            { icon: ClipboardList, title: "Export & Share", desc: "Download or integrate into workflow." },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative text-center"
            >
              <div className="w-14 h-14 rounded-2xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mb-4">
                <step.icon className="text-primary" size={24} />
              </div>
              <span className="text-[0.6rem] font-bold uppercase tracking-widest text-primary/60 mb-2 block">Step {i + 1}</span>
              <h3 className="font-display text-sm font-bold text-foreground mb-1.5">{step.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">{step.desc}</p>
              {i < 3 && (
                <ArrowRight className="hidden md:block absolute -right-4 top-7 w-5 h-5 text-primary/20" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Built For */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Built For</p>
            <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-4">
              Designed for <em className="not-italic text-primary">Private Clinics</em>
            </h2>
            <p className="text-muted-foreground font-light leading-relaxed max-w-lg mx-auto mb-12">
              Purpose-built for clinicians who need practical documentation efficiency without the overhead of enterprise systems.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: Stethoscope, title: "Solo Practitioners", desc: "Individual doctors managing their own clinical documentation." },
              { icon: Hospital, title: "Small & Medium Clinics", desc: "Private healthcare facilities seeking workflow automation." },
              { icon: Building2, title: "Multi-Clinic Practices", desc: "Growing practices ready to standardise documentation." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-border bg-card text-center"
              >
                <div className="w-12 h-12 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mb-4">
                  <item.icon className="text-primary" size={22} />
                </div>
                <h3 className="font-display text-sm font-bold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-8">Primary geography: India · Secondary: UK</p>
        </div>
      </div>
    </section>

    {/* Clinical Safety & Explainability */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Clinical Safety</p>
            <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-4">
              Clinician-Controlled <em className="not-italic text-primary">AI</em>
            </h2>
            <p className="text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
              All AI outputs are transparent, editable, and require clinician approval before use. Human-in-the-loop architecture. Audit logs available.
            </p>
          </motion.div>
        </div>
      </div>
    </section>

    {/* Security & Data Protection */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Security</p>
            <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-8">
              Responsible <em className="not-italic text-primary">Data Protection</em>
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              "Encryption in transit (TLS 1.3)",
              "Encryption at rest",
              "India data residency option",
              "DPDP & GDPR aligned",
              "Enterprise DPA on request",
              "No PHI stored in demos",
            ].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card text-left"
              >
                <ShieldCheck className="text-primary shrink-0" size={15} />
                <span className="text-xs text-foreground font-medium">{item}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-6">
            <Button variant="outline" size="sm" asChild>
              <Link to="/security">View Security Details →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>

    {/* Early Pilot Programme */}
    <section className="py-24 bg-card border-t border-border">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Early Access</p>
          <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-4">
            Early Pilot Programme <em className="not-italic text-primary">Now Open</em>
          </h2>
          <p className="text-muted-foreground font-light leading-relaxed max-w-lg mx-auto mb-8">
            We are onboarding a limited number of private clinics for early validation and co-development. Be among the first to experience AI-powered clinical documentation.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="default" size="lg" asChild>
              <Link to="/contact">Apply for Pilot →</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/contact">Book Demo</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  </div>
);

export default Index;
