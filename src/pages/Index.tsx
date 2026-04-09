import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Mic, FileText, Stethoscope, ShieldCheck, Lock, Globe, ArrowRight,
  UserCheck, ClipboardCheck, Share2, PenLine, BrainCircuit, MessageSquare,
  AlertTriangle, Layers, Clock, HeartPulse, Eye, FlaskConical, Pill,
  Users, CheckCircle2, XCircle, Sparkles, Activity, Receipt, Send,
  Monitor, BookOpen
} from "lucide-react";
import SEO, { BRAND_DESCRIPTION, ORG_JSONLD, PRODUCT_JSONLD } from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const sectionIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ─── Workflow Steps ─── */
const workflowSteps = [
  { icon: ClipboardCheck, label: "Patient Intake", desc: "Capture symptoms and vitals." },
  { icon: Mic, label: "Consultation", desc: "Record or write naturally." },
  { icon: BrainCircuit, label: "Clinical Structuring", desc: "Generate notes, prescriptions, and orders." },
  { icon: UserCheck, label: "Doctor Review", desc: "Review and approve outputs." },
  { icon: Share2, label: "Patient Output", desc: "Share summaries and instructions." },
];

/* ─── Problems ─── */
const problems = [
  { title: "Time Lost to Documentation", desc: "Doctors spend more time typing than treating." },
  { title: "Disconnected Systems", desc: "Intake, prescriptions, and billing live in separate tools." },
  { title: "Poor Patient Understanding", desc: "Patients leave without clarity on next steps." },
];

/* ─── Solution Steps ─── */
const solutionSteps = [
  { num: "1", title: "Record or Write Naturally", desc: "Type notes or record the consultation. Both inputs feed the same workspace." },
  { num: "2", title: "Structured Clinical Outputs", desc: "SOAP notes, prescriptions, lab orders, and patient summaries are generated." },
  { num: "3", title: "Doctor Reviews and Approves", desc: "Every output is a draft. You review, edit, and approve before use." },
];

/* ─── Benefits ─── */
const benefits = [
  { title: "Reduce Documentation Time", desc: "Generate clinical notes in seconds." },
  { title: "Clear Patient Communication", desc: "Patients receive structured, multilingual reports." },
  { title: "Structured, Searchable Records", desc: "Every consultation produces standardised SOAP notes." },
];

/* ─── Safety Items ─── */
const safetyItems = [
  { title: "Clinician-in-the-Loop by Default", desc: "Nothing is finalised without the doctor's explicit review." },
  { title: "Automated Safety Checks", desc: "Drug interactions, allergy conflicts, and inconsistencies flagged." },
  { title: "Explainable Outputs", desc: "Every output includes confidence indicators and source reasoning." },
  { title: "Compliant Data Handling", desc: "End-to-end encryption and compliance with HIPAA, GDPR & DPDP." },
  { title: "Guideline-Linked Suggestions", desc: "Clinical recommendations supported by guideline references." },
];

/* ─── Clinic Operations ─── */
const clinicOps = [
  { title: "Consultation", desc: "Structured clinical documentation with SOAP notes." },
  { title: "Prescription", desc: "Generated prescriptions with drug interaction checks." },
  { title: "Lab Orders", desc: "One-click lab orders linked to diagnosis." },
  { title: "Reports", desc: "Multilingual patient reports with follow-up." },
  { title: "Billing", desc: "Invoice generation tied to consultation charges." },
  { title: "Patient Messaging", desc: "SMS and WhatsApp delivery of reports." },
];

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [location.hash]);

  return (
  <div>
    <SEO
      title="DATAelixAIr™ — AI Clinical Workspace for Faster, Safer Consultations"
      description={`${BRAND_DESCRIPTION} Record or write consultations — DATAelixAIr™ generates clinical notes, prescriptions, lab orders, and patient reports automatically.`}
      jsonLd={[ORG_JSONLD, PRODUCT_JSONLD]}
    />

    {/* ── HERO ── */}
    <section className="relative flex items-center min-h-[85vh]">
      <div className="container mx-auto px-4 py-28 relative z-10">
        <motion.div initial="hidden" animate="visible" className="text-center max-w-2xl mx-auto">
          <motion.h1 variants={fadeUp} custom={0} className="font-display text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
            Clinical Intelligence, Built for Real Consultations
          </motion.h1>

          <motion.p variants={fadeUp} custom={1} className="mt-5 text-[0.95rem] text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Structured documentation, decision support, and patient-ready outputs in one clinical workspace.
          </motion.p>

          <motion.div variants={fadeUp} custom={2} className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="default" size="lg" asChild>
              <Link to="/onboard">Request Pilot →</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/vision">See How It Works</Link>
            </Button>
          </motion.div>

          <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
            {["Structured documentation", "Doctor-controlled decisions", "Multilingual reports", "Safety guardrails"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary" />
                {t}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>

    {/* ── PROBLEM ── */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            Clinical Time Is Lost to Documentation
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-0 divide-y divide-border">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="py-6 first:pt-0 last:pb-0"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── SOLUTION ── */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            A Clinical Workspace Designed Around the Consultation
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-8">
          {solutionSteps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-5"
            >
              <span className="text-xs font-mono font-bold text-muted-foreground/40 pt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CLINICAL WORKSPACE ── */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            One Workspace for the Entire Consultation
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">No tab switching. No context loss.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="border border-border rounded-lg bg-background overflow-hidden">
            <div className="h-px bg-primary" />
            <div className="p-6">
              <div className="grid grid-cols-12 gap-3">
                {/* Left panel */}
                <div className="col-span-12 md:col-span-3 space-y-2">
                  <div className="border border-border rounded-lg p-3">
                    <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Patient Context</span>
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2 rounded bg-muted w-full" />
                      <div className="h-2 rounded bg-muted w-3/4" />
                      <div className="h-2 rounded bg-muted w-5/6" />
                    </div>
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {["BP: 130/85", "Pulse: 78", "SpO₂: 98%"].map(v => (
                        <span key={v} className="text-[0.5rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{v}</span>
                      ))}
                    </div>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Symptoms</span>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {["Fever", "Cough", "Fatigue"].map(s => (
                        <span key={s} className="text-[0.5rem] px-1.5 py-0.5 rounded border border-border text-muted-foreground font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Center panel */}
                <div className="col-span-12 md:col-span-6 space-y-2">
                  <div className="border border-border rounded-lg p-3">
                    <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Clinical Builder</span>
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2 rounded bg-muted w-full" />
                      <div className="h-2 rounded bg-muted w-5/6" />
                      <div className="h-2 rounded bg-muted w-full" />
                      <div className="h-2 rounded bg-muted w-2/3" />
                    </div>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Clinical Outputs</span>
                      <span className="text-[0.45rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold uppercase">Draft</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {["SOAP Notes", "Prescription", "Lab Orders", "Follow-up"].map(item => (
                        <div key={item} className="border border-border rounded p-2">
                          <span className="text-[0.5rem] font-semibold text-foreground">{item}</span>
                          <div className="mt-1 h-1.5 rounded bg-muted w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right panel */}
                <div className="col-span-12 md:col-span-3 space-y-2">
                  <div className="border border-border rounded-lg p-3">
                    <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Safety</span>
                    <div className="mt-2 space-y-1">
                      {["No drug interactions", "No allergy conflicts", "Monitor renal function"].map((s, i) => (
                        <div key={s} className="flex items-center gap-1.5 text-[0.5rem]">
                          <span className={`w-1.5 h-1.5 rounded-full ${i < 2 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                          <span className="text-muted-foreground">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Suggestions</span>
                    <div className="mt-2 space-y-1">
                      {["Consider CBC", "Add Paracetamol 500mg", "Schedule follow-up 5d"].map(s => (
                        <div key={s} className="text-[0.5rem] px-1.5 py-1 rounded bg-muted text-muted-foreground">{s}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* ── PRODUCT WORKFLOW ── */}
    <section id="product" className="py-24 border-t border-border scroll-mt-20">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            Covers the Full Consultation Flow
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            From intake to patient communication — everything happens in one system.
          </p>
        </motion.div>

        {/* Horizontal timeline */}
        <div className="max-w-4xl mx-auto">
          <div className="hidden lg:flex items-start justify-between relative">
            <div className="absolute top-5 left-[10%] right-[10%] h-px bg-border" />
            {workflowSteps.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="relative text-center w-1/5 px-2"
              >
                <div className="w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center mx-auto mb-3 relative z-10">
                  <span className="text-xs font-mono font-bold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="text-xs font-semibold text-foreground mb-1">{s.label}</h3>
                <p className="text-[0.7rem] text-muted-foreground leading-snug">{s.desc}</p>
              </motion.div>
            ))}
          </div>
          {/* Mobile: vertical */}
          <div className="lg:hidden space-y-0 divide-y divide-border">
            {workflowSteps.map((s, i) => (
              <div key={s.label} className="py-4 flex gap-4 items-start first:pt-0 last:pb-0">
                <span className="text-xs font-mono font-bold text-muted-foreground/40 pt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">{s.label}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* ── CLINIC OPERATIONS ── */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            Complete Clinic Operations
          </h2>
        </motion.div>

        <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-x-16 gap-y-8">
          {clinicOps.map((op, i) => (
            <motion.div
              key={op.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">{op.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{op.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── BENEFITS ── */}
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            Built for High-Throughput Clinical Practice
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-0 divide-y divide-border">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="py-6 first:pt-0 last:pb-0"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">{b.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── SAFETY ── */}
    <section id="security" className="py-24 border-t border-border scroll-mt-20">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            Designed for Safe Clinical Use
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-0 divide-y divide-border">
          {safetyItems.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="py-6 first:pt-0 last:pb-0"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── PILOT CTA ── */}
    <section className="py-28 border-t border-border">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }}>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-tight text-foreground">
            A Clinical Workspace That Works at Consultation Speed
          </h2>
          <p className="mt-4 text-sm text-muted-foreground max-w-md mx-auto">
            Generate notes, prescriptions, and patient summaries in real time.
          </p>
          <Button variant="default" size="lg" className="mt-10" asChild>
            <Link to="/onboard">Request Pilot Access →</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  </div>
  );
};

export default Index;
