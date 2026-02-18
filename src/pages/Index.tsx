import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Heart, Users, Handshake, Lightbulb, Sparkles, Bot, BarChart3, Link2, ShieldCheck, DollarSign, HeartPulse, Search, Building2, Hospital, BrainCircuit, FileCheck, AlertTriangle, ClipboardCheck, Globe, BookOpen } from "lucide-react";
import HeroDashboard from "@/components/HeroDashboard";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.8 } }),
};

const services = [
  {
    icon: Bot, title: "Clinical AI Automation", slug: "clinical-ai-automation", featured: false,
    desc: "Automate administrative workflows, clinical documentation, and scheduling — freeing clinicians to focus on patient care.",
    tags: ["NLP Documentation", "Smart Scheduling", "Billing AI"],
  },
  {
    icon: BarChart3, title: "Predictive Analytics", slug: "predictive-analytics", featured: false,
    desc: "Harness your hospital's data to predict patient deterioration, readmission risks, and demand surges before they happen.",
    tags: ["Risk Stratification", "Demand Forecasting", "Population Health"],
  },
  {
    icon: Link2, title: "Interoperability & Integration", slug: "interoperability-integration", featured: true,
    desc: "Seamlessly connect disparate systems — EHRs, labs, imaging, and wearables — using HL7 FHIR standards for unified data.",
    tags: ["HL7 / FHIR", "EHR Integration", "API Layer"],
  },
  {
    icon: ShieldCheck, title: "Compliance & Security", slug: "compliance-security", featured: false,
    desc: "Building towards full HIPAA, GDPR, and regional regulatory compliance with end-to-end encryption and audit trails.",
    tags: ["HIPAA", "GDPR", "ISO 27001"],
  },
  {
    icon: DollarSign, title: "Revenue Cycle Optimisation", slug: "revenue-cycle-optimisation", featured: false,
    desc: "AI-driven coding accuracy, denial prediction, and claims management to maximise reimbursements and accelerate cash flow.",
    tags: ["Claims AI", "Coding Accuracy", "Denial Mgmt"],
  },
  {
    icon: HeartPulse, title: "Patient Satisfaction & Engagement", slug: "patient-engagement", featured: false,
    desc: "Improve patient experience with digital intake, feedback loops, personalised care pathways, and proactive communication.",
    tags: ["Patient Portal", "Feedback AI", "Care Pathways"],
  },
  {
    icon: Search, title: "Explainable AI", slug: "explainable-ai", featured: false,
    desc: "Transparent, interpretable AI models that clinicians can trust — every recommendation comes with clear reasoning, audit trails, and decision rationale.",
    tags: ["Interpretability", "Decision Audit", "Clinical Trust", "Model Transparency"],
  },
];

const pillars = [
  { icon: ShieldCheck, name: "Regulatory Alignment", text: "Actively building towards HIPAA, GDPR, and NHS compliance across all deployments." },
  { icon: Link2, name: "Interoperability", text: "HL7, FHIR and EHR-native integrations designed for seamless adoption." },
  { icon: ShieldCheck, name: "Data Security", text: "End-to-end encryption, zero-trust architecture, and comprehensive audit trails." },
  { icon: HeartPulse, name: "Patient-Centric", text: "Every solution is designed to improve patient satisfaction and clinical outcomes." },
];

const governanceFramework = [
  {
    icon: ShieldCheck,
    title: "Clinical Governance",
    desc: "A rigorous, institution-wide framework that unifies leadership accountability, evidence-based practice, and continuous quality improvement — ensuring every clinical decision is transparent, measurable, and aligned with the highest standards of patient care.",
  },
  {
    icon: Globe,
    title: "Global Patient Safety Action Plan 2021–2030",
    desc: "Anchored in WHO's landmark vision of eliminating avoidable harm, our approach operationalises all seven strategic objectives — from fostering a no-blame safety culture and empowering patients as partners, to building resilient health systems capable of sustained, data-driven improvement.",
  },
  {
    icon: AlertTriangle,
    title: "Risk Management & Assessment",
    desc: "A proactive, multi-layered discipline that moves beyond reactive incident response. We deploy Root Cause Analysis, Failure Mode & Effects Analysis, Ishikawa mapping, and quantitative risk matrices within a Lean Six Sigma methodology — systematically identifying latent hazards, quantifying their impact, and embedding preventive controls across every level of clinical operations.",
  },
  {
    icon: ClipboardCheck,
    title: "Audit & Evaluation",
    desc: "Structured clinical audit cycles, real-time outcome tracking, and validated patient experience measures form a closed-loop system — where every finding drives targeted intervention, and every intervention is evaluated for measurable impact on care quality and safety.",
  },
  {
    icon: FileCheck,
    title: "Accountability & Performance",
    desc: "Multi-directional accountability that extends from the boardroom to the bedside. Performance is governed through balanced scorecards, benchmarked KPIs, and professional development frameworks — ensuring that every stakeholder, from frontline clinicians to executive leadership, is measurably invested in patient outcomes.",
  },
  {
    icon: BookOpen,
    title: "Information Management",
    desc: "Harnessing interoperable EHRs, health information exchanges, and AI-powered analytics to transform raw clinical data into actionable governance intelligence — enabling real-time decision support, predictive safety insights, and full regulatory traceability while maintaining uncompromising data privacy.",
  },
];

const Index = () => (
  <div>
    <SEO
      title="DATAelixAIr — Intelligent AI, Personalised for Your Practice"
      description="DATAelixAIr transforms healthcare with AI-powered solutions tailored to your hospital's workflows, regulations, and patient needs."
    />
    {/* JSON-LD Organization Schema */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DATAelixAIr",
          url: "https://dataelixair.lovable.app",
          description: "AI-powered healthcare data solutions for hospitals and clinics worldwide.",
          sameAs: [],
        }),
      }}
    />
    {/* Hero — centered */}
    <section className="min-h-screen relative overflow-hidden flex items-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_30%,hsl(var(--teal)/0.08),transparent_70%)]" />
      <div className="absolute inset-0 hero-grid-bg" />

      <Sparkles className="absolute top-[18%] left-[12%] text-primary/20 w-5 h-5 animate-pulse" />
      <Sparkles className="absolute top-[30%] right-[15%] text-primary/15 w-4 h-4 animate-pulse" style={{ animationDelay: "1s" }} />
      <Sparkles className="absolute bottom-[25%] left-[20%] text-primary/10 w-3 h-3 animate-pulse" style={{ animationDelay: "2s" }} />

      <div className="container mx-auto px-4 pt-32 pb-24 relative z-10">
        <motion.div initial="hidden" animate="visible" className="text-center max-w-3xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 teal-muted-bg border teal-muted-border px-3.5 py-1.5 rounded-full text-xs font-medium uppercase tracking-[0.06em] text-primary mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI-Powered Healthcare
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.8rem,5.5vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-foreground">
            Intelligent AI,{" "}
            <em className="not-italic text-primary italic font-display">personalised</em>
            <br />for your practice.
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="mt-7 text-[clamp(1.05rem,1.5vw,1.2rem)] font-light leading-relaxed text-muted-foreground max-w-xl mx-auto">
            Every hospital is different. Our AI adapts to your workflows, regulations, and patient needs — so you can focus on what matters most: care.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap justify-center gap-4">
            <Button variant="default" size="lg" asChild>
              <Link to="/contact">Partner With Us →</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/services">Explore Services</Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.9 }}
          className="hidden lg:block mt-20 max-w-2xl mx-auto"
        >
          <HeroDashboard />
        </motion.div>
      </div>
    </section>

    {/* Mission Strip */}
    <section className="border-y border-border">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { icon: Heart, label: "Patient Satisfaction First", desc: "Every solution we build puts patient experience at the centre" },
            { icon: Lightbulb, label: "Tailored Solutions", desc: "Custom AI designed for your unique workflows and challenges" },
            { icon: Handshake, label: "Open to Collaboration", desc: "Seeking pilot partners, investors, and advisors worldwide" },
            { icon: Users, label: "Built for Healthcare", desc: "Purpose-built by healthcare & AI specialists together" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <s.icon className="mx-auto text-primary mb-2" size={28} />
              <div className="font-display text-sm font-bold text-foreground">{s.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* About */}
    <section id="about" className="relative py-24 overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(220 30% 10%), hsl(200 25% 14%), hsl(180 20% 12%))' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_40%,hsl(var(--teal)/0.08),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_70%,hsl(var(--primary)/0.06),transparent_60%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary-light mb-3.5">Who We Are</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-dark-foreground max-w-xl">
              AI Built for the Realities of <em className="not-italic text-primary">Modern Healthcare</em>
            </h2>
            <p className="mt-5 text-base font-light leading-relaxed text-dark-muted max-w-lg">
              DATAelixAIr bridges the gap between cutting-edge artificial intelligence and the complex operational demands of healthcare institutions. We're a young, ambitious company building purpose-built solutions — respecting clinical workflows, regulatory frameworks, and the sensitivity of patient data.
            </p>
            <p className="mt-4 text-base font-light leading-relaxed text-dark-muted max-w-lg">
              We're seeking early adopters, pilot partners, and collaborators who share our vision of making healthcare smarter, more efficient, and deeply patient-centric.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-12">
              {pillars.map((p) => (
                <Link key={p.name} to="/solutions" className="dark-card border rounded-2xl p-6 hover:border-primary/40 hover:bg-primary/5 transition-all group">
                  <p.icon className="text-primary mb-3 group-hover:scale-110 transition-transform" size={24} />
                  <h4 className="font-display text-sm font-bold text-dark-foreground mb-1.5">{p.name}</h4>
                  <p className="text-xs text-dark-muted/60 leading-relaxed">{p.text}</p>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>

    {/* Clinical Governance & Patient Safety */}
    <section id="governance" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Our Framework</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Clinical Governance &{" "}
              <em className="not-italic text-primary">Patient Safety</em>
            </h2>
            <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-xl mx-auto">
              Aligned with the WHO Global Patient Safety Action Plan 2021–2030, our AI solutions are built on robust governance frameworks to eliminate avoidable harm and drive continuous quality improvement.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {governanceFramework.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group border border-border rounded-[20px] p-7 bg-card hover:border-primary hover:-translate-y-1 hover:shadow-card-hover transition-all relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-[48px] h-[48px] rounded-[14px] teal-muted-bg border teal-muted-border flex items-center justify-center mb-5">
                  <item.icon className="text-primary" size={22} />
                </div>
                <h3 className="font-display text-base font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* WHO Vision callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 max-w-5xl mx-auto teal-muted-bg border teal-muted-border rounded-2xl px-8 py-7"
        >
          <div className="flex items-start gap-4">
            <Globe className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">WHO Global Patient Safety Action Plan 2021–2030</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <em>"A world in which no one is harmed in health care, and every patient receives safe and respectful care, every time, everywhere."</em>
                {" "}— Our AI solutions support this vision by driving evidence-based policies, building safety culture, engaging patients and families, and enabling data-driven learning across healthcare systems.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* Services — clickable cards */}
    <section className="relative py-24 overflow-hidden" style={{ background: 'linear-gradient(160deg, hsl(215 30% 10%), hsl(210 28% 13%), hsl(195 22% 11%))' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_70%_30%,hsl(var(--teal)/0.07),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_20%_80%,hsl(var(--primary)/0.05),transparent_50%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex justify-between items-end mb-16 flex-wrap gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary-light mb-3.5">What We Offer</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-dark-foreground">
              Tailored AI Solutions for<br />Every <em className="not-italic text-primary">Healthcare Need</em>
            </h2>
          </div>
          <Button variant="outline" asChild>
            <Link to="/services">See All Solutions <ArrowRight className="ml-1" size={14} /></Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to={`/services/${s.slug}`}
                className={`group block relative overflow-hidden border rounded-[20px] p-9 transition-all hover:-translate-y-1 ${
                  s.featured
                    ? "bg-foreground border-foreground hover:shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
                    : "dark-card border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                {!s.featured && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <div className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-6 relative z-10 border ${
                  s.featured ? "teal-muted-bg border-primary/30" : "teal-muted-bg teal-muted-border"
                }`}>
                  <s.icon className="text-primary" size={24} />
                </div>
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <h3 className={`font-display text-lg font-bold ${s.featured ? "text-background" : "text-dark-foreground"}`}>
                    {s.title}
                  </h3>
                  <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${s.featured ? "text-background/40" : "text-dark-muted/40 group-hover:text-primary"}`} />
                </div>
                <p className={`text-sm leading-relaxed font-light relative z-10 ${s.featured ? "text-background/50" : "text-dark-muted/60"}`}>
                  {s.desc}
                </p>
                <div className="flex flex-wrap gap-2 mt-5 relative z-10">
                  {s.tags.map((t) => (
                    <span key={t} className={`text-[0.7rem] font-medium tracking-wide px-2.5 py-1 rounded-full border ${
                      s.featured
                        ? "bg-background/5 border-background/10 text-background/40"
                        : "bg-card/5 border-border/20 text-dark-muted/50"
                    }`}>
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Compliance band */}
        <div className="mt-10 teal-muted-bg border teal-muted-border rounded-2xl px-8 py-7 flex items-center justify-between flex-wrap gap-5">
          <p className="text-sm font-medium text-dark-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Building towards full certification with global healthcare standards
          </p>
          <div className="flex flex-wrap gap-3">
            {["HIPAA", "GDPR", "NHS DSP", "ISO 27001", "HL7 FHIR", "SOC 2"].map((b) => (
              <span key={b} className="text-xs font-semibold uppercase tracking-wider px-3.5 py-1.5 rounded-lg bg-card/10 border teal-muted-border text-primary">
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Investors, Partners & Collaborators CTA */}
    <section className="bg-background py-24">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Join Our Journey</p>
          <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Seeking <em className="not-italic text-primary">Investors</em>, Partners & <em className="not-italic text-primary">Collaborators</em>
          </h2>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            We're at an exciting early stage — building transformative AI for healthcare. Whether you're an investor, hospital leader, advisor, or technology partner, we'd love to explore how we can create impact together.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mt-12">
            {[
              { icon: Building2, title: "Investors", desc: "Fund the future of healthcare AI. Early-stage opportunity with massive global potential." },
              { icon: Hospital, title: "Pilot Partners", desc: "Be among the first hospitals to benefit from tailored AI — with dedicated support." },
              { icon: BrainCircuit, title: "Advisors & Experts", desc: "Lend your expertise in healthcare, AI, regulation, or strategy to shape our direction." },
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
