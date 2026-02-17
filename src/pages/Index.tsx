import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import HeroDashboard from "@/components/HeroDashboard";
import GlobeVisual from "@/components/GlobeVisual";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.8 } }),
};

const services = [
  {
    icon: "🤖", title: "Clinical AI Automation", featured: false,
    desc: "Automate administrative workflows, clinical documentation, and scheduling — freeing clinicians to focus on patient care.",
    tags: ["NLP Documentation", "Smart Scheduling", "Billing AI"],
  },
  {
    icon: "📊", title: "Predictive Analytics", featured: false,
    desc: "Harness your hospital's data to predict patient deterioration, readmission risks, and demand surges before they happen.",
    tags: ["Risk Stratification", "Demand Forecasting", "Population Health"],
  },
  {
    icon: "🔗", title: "Interoperability & Integration", featured: true,
    desc: "Seamlessly connect disparate systems — EHRs, labs, imaging, and wearables — using HL7 FHIR standards for unified data.",
    tags: ["HL7 / FHIR", "EHR Integration", "API Layer"],
  },
  {
    icon: "🛡️", title: "Compliance & Security", featured: false,
    desc: "Zero-trust, end-to-end encrypted platform ensures full HIPAA, GDPR, and regional regulatory compliance with audit trails.",
    tags: ["HIPAA", "GDPR", "ISO 27001"],
  },
  {
    icon: "💰", title: "Revenue Cycle Optimisation", featured: false,
    desc: "AI-driven coding accuracy, denial prediction, and claims management to maximise reimbursements and accelerate cash flow.",
    tags: ["Claims AI", "Coding Accuracy", "Denial Mgmt"],
  },
  {
    icon: "🎓", title: "Training & Change Management", featured: false,
    desc: "We partner with your teams through adoption — custom training programmes and dedicated support for lasting impact.",
    tags: ["Staff Training", "Ongoing Support", "KPI Tracking"],
  },
];

const stats = [
  { value: "500", suffix: "+", label: "Hospitals & Clinics Served" },
  { value: "38", suffix: "%", label: "Avg. Productivity Gain" },
  { value: "30", suffix: "+", label: "Countries Worldwide" },
  { value: "99", suffix: "%", label: "SLA Uptime Guarantee" },
];

const pillars = [
  { icon: "🏛️", name: "Regulatory First", text: "HIPAA, GDPR, NHS compliant by design across all deployments." },
  { icon: "🔗", name: "Interoperability", text: "HL7, FHIR and EHR-native integrations for zero friction." },
  { icon: "🛡️", name: "Data Security", text: "End-to-end encryption, zero-trust architecture, audit trails." },
  { icon: "🌍", name: "Global Reach", text: "Deployed in 30+ countries with localised compliance support." },
];

const Index = () => (
  <div>
    {/* Hero */}
    <section className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_85%_40%,hsl(var(--teal)/0.10),transparent_70%),radial-gradient(ellipse_50%_50%_at_15%_80%,hsl(var(--teal-light)/0.06),transparent_60%)]" />
      <div className="absolute inset-0 hero-grid-bg" />

      <div className="container mx-auto px-4 pt-32 pb-24 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial="hidden" animate="visible">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 teal-muted-bg border teal-muted-border px-3.5 py-1.5 rounded-full text-xs font-medium uppercase tracking-[0.06em] text-primary mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Healthcare Solutions
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.6rem,5vw,4.2rem)] font-extrabold leading-[1.05] tracking-tight text-foreground">
              Elevate Clinical{"\n"}Outcomes with{"\n"}<em className="not-italic text-primary">Intelligent AI</em>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="mt-6 text-[clamp(1rem,1.4vw,1.15rem)] font-light leading-relaxed text-muted-foreground max-w-[480px]">
              DATAelixAIr delivers tailored AI services to hospitals and clinics worldwide — boosting productivity, growing revenue, and ensuring full regulatory compliance and data security.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap gap-4">
              <Button variant="default" size="lg" asChild>
                <Link to="/contact">Book a Demo →</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/services">Explore Services</Link>
              </Button>
            </motion.div>
          </motion.div>

          <div className="hidden lg:block">
            <HeroDashboard />
          </div>
        </div>
      </div>
    </section>

    {/* Stats */}
    <section className="border-y border-border">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold text-foreground leading-none">
                {s.value}<span className="text-primary">{s.suffix}</span>
              </div>
              <div className="text-xs text-gray-mid mt-1.5">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* About */}
    <section id="about" className="bg-dark py-24">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary-light mb-3.5">Who We Are</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-dark-foreground max-w-xl">
              AI Built for the Realities of <em className="not-italic text-primary">Modern Healthcare</em>
            </h2>
            <p className="mt-5 text-base font-light leading-relaxed text-dark-muted max-w-lg">
              DATAelixAIr bridges the gap between cutting-edge artificial intelligence and the complex operational demands of healthcare institutions. Our solutions are purpose-built — respecting clinical workflows, regulatory frameworks, and the sensitivity of patient data.
            </p>
            <p className="mt-4 text-base font-light leading-relaxed text-dark-muted max-w-lg">
              From single-site clinics to large hospital networks, we craft scalable, interoperable AI systems that slot seamlessly into existing infrastructures — no disruption, just results.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-12">
              {pillars.map((p) => (
                <div key={p.name} className="dark-card border rounded-2xl p-6 hover:border-primary/40 hover:bg-primary/5 transition-all">
                  <div className="text-2xl mb-3">{p.icon}</div>
                  <h4 className="font-display text-sm font-bold text-dark-foreground mb-1.5">{p.name}</h4>
                  <p className="text-xs text-dark-muted/60 leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="hidden lg:block">
            <GlobeVisual />
          </div>
        </div>
      </div>
    </section>

    {/* Services */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-16 flex-wrap gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">What We Offer</p>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
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
              className={`group relative overflow-hidden border rounded-[20px] p-9 transition-all cursor-default hover:-translate-y-1 ${
                s.featured
                  ? "bg-foreground border-foreground hover:shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
                  : "bg-card border-border hover:border-primary hover:shadow-card-hover"
              }`}
            >
              {!s.featured && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              <div className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-2xl mb-6 relative z-10 border ${
                s.featured ? "teal-muted-bg border-primary/30" : "teal-muted-bg teal-muted-border"
              }`}>
                {s.icon}
              </div>
              <h3 className={`font-display text-lg font-bold mb-3 relative z-10 ${s.featured ? "text-background" : "text-foreground"}`}>
                {s.title}
              </h3>
              <p className={`text-sm leading-relaxed font-light relative z-10 ${s.featured ? "text-background/50" : "text-muted-foreground"}`}>
                {s.desc}
              </p>
              <div className="flex flex-wrap gap-2 mt-5 relative z-10">
                {s.tags.map((t) => (
                  <span key={t} className={`text-[0.7rem] font-medium tracking-wide px-2.5 py-1 rounded-full border ${
                    s.featured
                      ? "bg-background/5 border-background/10 text-background/40"
                      : "bg-card border-border text-gray-mid"
                  }`}>
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Compliance band */}
        <div className="mt-10 teal-muted-bg border teal-muted-border rounded-2xl px-8 py-7 flex items-center justify-between flex-wrap gap-5">
          <p className="text-sm font-medium text-foreground">
            🔒 All solutions are fully certified and compliant with global healthcare standards
          </p>
          <div className="flex flex-wrap gap-3">
            {["HIPAA", "GDPR", "NHS DSP", "ISO 27001", "HL7 FHIR", "SOC 2"].map((b) => (
              <span key={b} className="text-xs font-semibold uppercase tracking-wider px-3.5 py-1.5 rounded-lg bg-card border teal-muted-border text-primary">
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  </div>
);

export default Index;
