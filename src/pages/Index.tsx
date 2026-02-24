import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mic, FileText, Stethoscope, ShieldCheck, Lock, Server, Globe, ArrowRight, UserCheck, ClipboardCheck, Share2, Building2, Hospital, BrainCircuit } from "lucide-react";
import HeroDashboard from "@/components/HeroDashboard";
import TrustBar from "@/components/TrustBar";
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
          description: "AI clinical documentation assistant for private healthcare providers.",
        }),
      }}
    />

    {/* Trust Bar */}
    <div className="pt-[68px]">
      <TrustBar />
    </div>

    {/* Hero */}
    <section className="relative overflow-hidden flex items-center min-h-[85vh]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,hsl(var(--teal)/0.06),transparent_70%)]" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div initial="hidden" animate="visible" className="text-center max-w-3xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground">
            <Mic className="w-3.5 h-3.5 text-primary" />
            AI-Powered Clinical Documentation
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.4rem,5vw,3.8rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
            AI Clinical Documentation{" "}
            <em className="not-italic text-primary">in Under 60 Seconds</em>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="mt-7 text-[clamp(1rem,1.4vw,1.15rem)] font-light leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            Convert consultation audio into structured SOAP notes, prescription drafts, and patient summaries — securely and reviewable by clinicians.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap justify-center gap-4">
            <Button variant="default" size="lg" asChild>
              <Link to="/onboard">Request Pilot Access →</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/contact">Book Demo</Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Workflow visual */}
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

    {/* Trust & Value Pillars */}
    <section className="border-y border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            { icon: ShieldCheck, label: "Clinical Safety & Explainability", desc: "AI outputs are reviewable, transparent, and clinician-controlled." },
            { icon: FileText, label: "Consultation Workflow Productivity", desc: "Automate clinical documentation during patient encounters." },
            { icon: Stethoscope, label: "Tailored for Indian Clinical Practice", desc: "Built for small and medium private healthcare providers." },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-2xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mb-4">
                <s.icon className="text-primary" size={22} />
              </div>
              <div className="font-display text-sm font-bold text-foreground mb-1.5">{s.label}</div>
              <div className="text-sm text-muted-foreground font-light leading-relaxed">{s.desc}</div>
            </motion.div>
          ))}
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground/70 mt-8 max-w-lg mx-auto"
        >
          Designed to help clinicians save consultation time while maintaining clinical quality and safety.
        </motion.p>
      </div>
    </section>

    {/* Product — 4-Step Workflow */}
    <section id="product" className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">How It Works</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              From Voice to <em className="not-italic text-primary">Clinical Document</em>
            </h2>
            <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-xl mx-auto">
              A seamless four-step workflow designed around real consultation patterns.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            { step: "01", icon: Mic, title: "Record Consultation", desc: "Voice input during patient visit — speak naturally, we handle the rest." },
            { step: "02", icon: FileText, title: "AI Generates Notes", desc: "Structured SOAP notes, risk flags, and clinical summaries created automatically." },
            { step: "03", icon: UserCheck, title: "Clinician Reviews", desc: "Every AI output is presented as a draft — you review, edit, and approve." },
            { step: "04", icon: Share2, title: "Export & Share", desc: "Generate bilingual PDFs, share via WhatsApp, or save to patient records." },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative border border-border rounded-2xl p-7 bg-background hover:border-primary/30 hover:shadow-card-hover transition-all group"
            >
              <span className="text-[0.6rem] font-mono font-bold text-primary/50 uppercase tracking-widest">Step {s.step}</span>
              <div className="w-11 h-11 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mt-3 mb-4">
                <s.icon className="text-primary" size={20} />
              </div>
              <h3 className="font-display text-base font-bold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">{s.desc}</p>
              {i < 3 && (
                <ArrowRight className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/20 z-10" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Built For */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Who It's For</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Designed for <em className="not-italic text-primary">Private Clinics</em>
            </h2>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Stethoscope, title: "Solo Practitioners", desc: "Independent doctors who need fast, accurate documentation without extra staff." },
            { icon: Building2, title: "Small & Medium Clinics", desc: "Multi-doctor practices looking to standardise clinical documentation." },
            { icon: Hospital, title: "Consultation-Heavy Practices", desc: "High-volume OPDs where documentation time directly impacts patient throughput." },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-border rounded-2xl p-7 bg-card text-center hover:border-primary/30 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mb-4">
                <s.icon className="text-primary" size={22} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs text-muted-foreground/60 mt-8"
        >
          Primary geography: India 🇮🇳 · Secondary: United Kingdom 🇬🇧
        </motion.p>
      </div>
    </section>

    {/* Security & Privacy */}
    <section id="security" className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Security & Privacy</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Responsible <em className="not-italic text-primary">Data Handling</em>
            </h2>
            <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-xl mx-auto">
              Your patient data security is our highest priority. We follow strict security principles across every layer.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {[
            { icon: Lock, title: "TLS 1.3 Encryption", desc: "All data encrypted in transit using the latest transport layer security." },
            { icon: Server, title: "Encryption at Rest", desc: "Patient data encrypted at rest with AES-256 standard." },
            { icon: Globe, title: "India Data Residency", desc: "Data residency option for Indian healthcare providers." },
            { icon: ShieldCheck, title: "GDPR & DPDP Aligned", desc: "Architecture designed around GDPR and India DPDP 2023 principles." },
            { icon: UserCheck, title: "Human-in-the-Loop", desc: "Every AI output requires clinician review before medical use." },
            { icon: ClipboardCheck, title: "Enterprise DPA", desc: "Data Processing Agreement available on request for organisations." },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="border border-border rounded-2xl p-6 bg-background hover:border-primary/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mb-4">
                <s.icon className="text-primary" size={18} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-1.5">{s.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Early Pilot Programme */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Limited Access</p>
          <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Early Pilot Programme <em className="not-italic text-primary">Now Open</em>
          </h2>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            We are onboarding a limited number of private clinics for early validation and co-development. Be among the first to shape AI clinical documentation.
          </p>
          <Button variant="default" size="lg" className="mt-10" asChild>
            <Link to="/onboard">Apply for Pilot →</Link>
          </Button>
        </motion.div>
      </div>
    </section>

    {/* CTA — Investors & Partners */}
    <section className="bg-card py-24 border-t border-border">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Join Our Journey</p>
          <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Seeking <em className="not-italic text-primary">Partners</em> & Collaborators
          </h2>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            Whether you're an investor, clinic owner, or advisor — we'd love to explore how we can create impact together.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mt-12">
            {[
              { icon: Building2, title: "Investors", desc: "Fund the future of healthcare AI at an early stage." },
              { icon: Hospital, title: "Pilot Partners", desc: "Be among the first clinics to adopt AI documentation." },
              { icon: BrainCircuit, title: "Advisors", desc: "Shape clinical AI with your healthcare expertise." },
            ].map((item) => (
              <Link key={item.title} to="/contact" className="border border-border rounded-2xl p-6 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left">
                <item.icon className="text-primary mb-3 group-hover:scale-110 transition-transform" size={28} />
                <h4 className="font-display text-sm font-bold text-foreground mb-1.5">{item.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </Link>
            ))}
          </div>
          <Button variant="default" size="lg" className="mt-10" asChild>
            <Link to="/contact">Get in Touch →</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  </div>
);

export default Index;
