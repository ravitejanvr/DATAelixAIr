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
    icon: "🤖", title: "AI-Powered Clinical Scribe", featured: false,
    desc: "Real-time transcription and note generation during consultations — freeing clinicians from documentation burden and reducing burnout.",
    tags: ["Real-Time Transcription", "Smart Notes", "EHR Integration"],
  },
  {
    icon: "📊", title: "Predictive Analytics", featured: false,
    desc: "Harness clinical data to predict patient deterioration, readmission risks, and demand surges — improving outcomes and resource efficiency.",
    tags: ["Risk Stratification", "Demand Forecasting", "Population Health"],
  },
  {
    icon: "🔗", title: "Interoperability & Integration", featured: true,
    desc: "Seamlessly connect EHRs (EMIS, SystmOne, EPIC, Cerner), labs, imaging, and wearables using HL7 FHIR standards for unified data.",
    tags: ["HL7 / FHIR", "EMIS / SystmOne", "API Layer"],
  },
  {
    icon: "🛡️", title: "Compliance & Security", featured: false,
    desc: "End-to-end encryption with zero-trust architecture. Working towards full NHS DTAC, GDPR, and regional regulatory compliance.",
    tags: ["GDPR", "NHS DTAC", "UK-Hosted"],
  },
  {
    icon: "💰", title: "Revenue Cycle Optimisation", featured: false,
    desc: "AI-driven coding accuracy with ICD-10 support, denial prediction, and claims management to maximise reimbursements.",
    tags: ["ICD-10 Coding", "Claims AI", "Denial Mgmt"],
  },
  {
    icon: "🎓", title: "Training & Change Management", featured: false,
    desc: "We partner with your teams through adoption — custom training programmes and dedicated support for lasting clinical impact.",
    tags: ["Staff Training", "Ongoing Support", "KPI Tracking"],
  },
];

/* Real industry statistics from trusted sources */
const stats = [
  { value: "£10B", suffix: "+", label: "NHS Admin Cost Annually" },
  { value: "50", suffix: "%", label: "Clinician Time on Documentation" },
  { value: "1 in 3", suffix: "", label: "UK Clinicians Face Burnout" },
  { value: "£1B", suffix: "+", label: "UK AI in Healthcare Market" },
];

const pillars = [
  { icon: "🏛️", name: "Regulatory First", text: "Working towards NHS DTAC, GDPR, and UK data compliance from day one." },
  { icon: "🔗", name: "Interoperability", text: "HL7, FHIR and EHR-native integrations (EMIS, SystmOne, EPIC, Cerner)." },
  { icon: "🛡️", name: "Data Security", text: "End-to-end encryption, zero-trust architecture, UK-hosted infrastructure." },
  { icon: "🚀", name: "NHS-First Approach", text: "Purpose-built for NHS workflows, with pay-per-use pricing for clinics." },
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
              Data That <em className="not-italic text-primary">Thinks.</em>{"\n"}Outcomes That{"\n"}<em className="not-italic text-primary">Matter.</em>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="mt-6 text-[clamp(1rem,1.4vw,1.15rem)] font-light leading-relaxed text-muted-foreground max-w-[480px]">
              elixAIr is an AI-powered clinical scribe that listens, transcribes, and drafts clinical notes in real time — fully integrated with NHS systems. Reduce documentation burden by 30% and give clinicians back their time with patients.
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

    {/* Stats - Real industry data */}
    <section className="border-y border-border">
      <div className="container mx-auto px-4 py-10">
        <p className="text-center text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground mb-6">
          The Healthcare Documentation Crisis — Trusted Industry Data
        </p>
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
              <div className="font-display text-[clamp(1.6rem,3vw,2.5rem)] font-extrabold text-foreground leading-none">
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
              AI Built for the Realities of <em className="not-italic text-primary">NHS & Modern Healthcare</em>
            </h2>
            <p className="mt-5 text-base font-light leading-relaxed text-dark-muted max-w-lg">
              elixAIr bridges the gap between cutting-edge AI and the complex operational demands of healthcare. Our AI scribe is purpose-built for NHS workflows — respecting clinical processes, regulatory frameworks, and the sensitivity of patient data.
            </p>
            <p className="mt-4 text-base font-light leading-relaxed text-dark-muted max-w-lg">
              Currently receiving guidance from <strong className="text-primary">NHS Innovation Service</strong>, we're building the only AI scribe designed specifically for UK healthcare — with pay-per-use pricing that works for clinics of any size.
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
              Transform Your Clinic with<br /><em className="not-italic text-primary">Intelligent AI</em>
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

        {/* Compliance band - regulations underway */}
        <div className="mt-10 teal-muted-bg border teal-muted-border rounded-2xl px-8 py-7 flex items-center justify-between flex-wrap gap-5">
          <p className="text-sm font-medium text-foreground">
            🔒 Regulatory compliance certifications underway — building to the highest standards
          </p>
          <div className="flex flex-wrap gap-3">
            {["GDPR", "NHS DTAC", "UK Data Standards", "ISO 27001", "HL7 FHIR"].map((b) => (
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
