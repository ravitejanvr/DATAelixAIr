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
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7 } }),
};

const sectionIn = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
};

/* ─── Workflow Steps (Hero visual) ─── */
const workflowSteps = [
  { icon: ClipboardCheck, label: "Patient Intake" },
  { icon: PenLine, label: "Write / Record" },
  { icon: BrainCircuit, label: "AI Clinical Copilot" },
  { icon: UserCheck, label: "Doctor Review" },
  { icon: Pill, label: "Rx & Lab Orders" },
  { icon: Share2, label: "Report + SMS" },
];

/* ─── Problems ─── */
const problems = [
  { icon: Clock, title: "Excessive Documentation", desc: "Doctors spend more time typing than treating — clinical notes, prescriptions, and reports eat into every consultation." },
  { icon: Layers, title: "Fragmented Systems", desc: "Patient intake, prescriptions, lab orders, and billing live in different tools that don't talk to each other." },
  { icon: MessageSquare, title: "Patients Leave Without Clear Instructions", desc: "Patients walk out of consultations without understanding their diagnosis, medications, or follow-up plan." },
];

/* ─── Solution Steps ─── */
const solutionSteps = [
  { num: "1", icon: PenLine, title: "Write or Record", desc: "Type your notes naturally or record the consultation. Both inputs feed the same clinical workspace." },
  { num: "2", icon: BrainCircuit, title: "AI Structures the Clinical Note", desc: "SOAP notes, prescriptions, lab orders, and patient summaries are structured automatically from your input." },
  { num: "3", icon: UserCheck, title: "Doctor Reviews & Finalises", desc: "Every AI output is a draft. You review, edit, and approve before anything reaches the patient." },
];

/* ─── Full Workflow (Product Section) ─── */
const productSteps = [
  { icon: ClipboardCheck, title: "Patient Intake", desc: "Front desk registers the patient, records vitals, and captures chief complaint." },
  { icon: Mic, title: "Consultation", desc: "Doctor writes or records the consultation in a clinical workspace built for speed." },
  { icon: BrainCircuit, title: "AI Clinical Copilot", desc: "SOAP notes, prescriptions, lab orders, and safety checks generated in seconds." },
  { icon: UserCheck, title: "Doctor Review", desc: "Clinician reviews every AI output, edits if needed, and approves with one click." },
  { icon: Share2, title: "Patient Summary & Instructions", desc: "Multilingual patient summary sent via SMS or WhatsApp — diagnosis, medications, and follow-up instructions." },
];

/* ─── Benefits ─── */
const benefits = [
  { icon: Clock, title: "Faster Consultations", desc: "Reduce documentation time from minutes to seconds — see more patients without sacrificing quality." },
  { icon: MessageSquare, title: "Better Patient Communication", desc: "Patients receive clear, multilingual reports explaining their diagnosis and care plan." },
  { icon: FileText, title: "Structured Clinical Records", desc: "Every consultation produces standardised SOAP notes, searchable and audit-ready." },
];

/* ─── Safety Items ─── */
const safetyItems = [
  { icon: UserCheck, title: "Clinician Approval Required", desc: "AI suggestions are drafts — nothing is finalised without the doctor's explicit review and approval." },
  { icon: HeartPulse, title: "Clinical Safety Checks", desc: "Drug interactions, allergy conflicts, and diagnostic inconsistencies are flagged automatically." },
  { icon: Eye, title: "Transparent AI Outputs", desc: "Every AI-generated note includes confidence indicators and source reasoning for clinician review." },
  { icon: Lock, title: "Secure Data Handling", desc: "End-to-end encryption, role-based access, and compliance with HIPAA, GDPR & India DPDP 2023." },
  { icon: BookOpen, title: "Evidence-Linked Suggestions", desc: "Clinical recommendations are supported by guideline references where applicable." },
];

/* ─── Clinic Operations ─── */
const clinicOps = [
  { icon: Stethoscope, title: "Consultation", desc: "AI-assisted clinical documentation with SOAP notes and structured outputs." },
  { icon: Pill, title: "Prescription", desc: "Auto-generated prescriptions with drug interaction and allergy safety checks." },
  { icon: FlaskConical, title: "Lab Orders", desc: "One-click lab orders linked to diagnosis with result tracking." },
  { icon: FileText, title: "Reports", desc: "Multilingual patient reports with diagnosis, medications, and follow-up." },
  { icon: Receipt, title: "Billing", desc: "Automatic invoice generation tied to consultation and lab charges." },
  { icon: Send, title: "Patient Messaging", desc: "SMS and WhatsApp delivery of reports, instructions, and follow-up reminders." },
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
      title="DATAelixAIr — AI Clinical Workspace for Faster Consultations"
      description="Record or write consultations — DATAelixAIr generates clinical notes, prescriptions, lab orders, and patient reports automatically. Doctor-reviewed, patient-safe."
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DATAelixAIr",
          url: "https://dataelixair.lovable.app",
          description: "AI clinical workspace for private healthcare providers.",
        }),
      }}
    />

    {/* ════════════════════════════════════════════
        HERO
    ════════════════════════════════════════════ */}
    <section className="relative overflow-hidden flex items-center min-h-[90vh]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_35%,hsl(var(--primary)/0.07),transparent_70%)]" />

      <div className="container mx-auto px-4 py-24 relative z-10">
        <motion.div initial="hidden" animate="visible" className="text-center max-w-3xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 mb-7 px-4 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            AI Clinical Workspace
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
            The AI Clinical Workspace for{" "}
            <em className="not-italic text-primary">Faster Consultations</em>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="mt-6 text-[clamp(0.95rem,1.3vw,1.1rem)] font-light leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            Record the consultation or write naturally. DATAelixAIr automatically generates clinical notes, prescriptions, lab orders, and patient reports — ready for doctor review in seconds.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-9 flex flex-wrap justify-center gap-4">
            <Button variant="default" size="lg" asChild>
              <Link to="/onboard">Request Pilot →</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/vision">See How It Works</Link>
            </Button>
          </motion.div>

          {/* Trust signals */}
          <motion.div variants={fadeUp} custom={4} className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
            {[
              { icon: FileText, text: "AI-assisted documentation" },
              { icon: UserCheck, text: "Doctor-controlled decisions" },
              { icon: Globe, text: "Multilingual patient reports" },
              { icon: ShieldCheck, text: "Built with clinical safety guardrails" },
            ].map((t) => (
              <span key={t.text} className="flex items-center gap-1.5">
                <t.icon className="w-3.5 h-3.5 text-primary" />
                {t.text}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* ── Workflow Visual ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.9 }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
            <div className="h-[3px] gradient-teal" />
            <div className="px-6 pt-5 pb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Consultation Workflow</span>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {workflowSteps.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + i * 0.08 }}
                    className="relative text-center group"
                  >
                    <div className="w-10 h-10 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mb-2">
                      <s.icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-[0.6rem] font-semibold text-foreground leading-tight">{s.label}</p>
                    {i < workflowSteps.length - 1 && (
                      <ArrowRight className="hidden md:block absolute -right-2 top-5 w-3.5 h-3.5 text-primary/25" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* ════════════════════════════════════════════
        PROBLEM
    ════════════════════════════════════════════ */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">The Problem</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Clinics Should Focus on Care —{" "}
            <em className="not-italic text-primary">Not Paperwork</em>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-border rounded-2xl p-7 bg-background"
            >
              <div className="w-11 h-11 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
                <p.icon className="text-destructive" size={20} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ════════════════════════════════════════════
        SOLUTION
    ════════════════════════════════════════════ */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">The Solution</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            A Clinical Workspace Designed Around{" "}
            <em className="not-italic text-primary">the Consultation</em>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {solutionSteps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative border border-border rounded-2xl p-7 bg-card hover:border-primary/30 transition-all"
            >
              <span className="text-[0.6rem] font-mono font-bold text-primary/50 uppercase tracking-widest">Step {s.num}</span>
              <div className="w-11 h-11 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mt-3 mb-4">
                <s.icon className="text-primary" size={20} />
              </div>
              <h3 className="font-display text-base font-bold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">{s.desc}</p>
              {i < solutionSteps.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/20 z-10" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ════════════════════════════════════════════
        CLINICAL WORKSPACE (NEW)
    ════════════════════════════════════════════ */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Workspace</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            The Consultation{" "}
            <em className="not-italic text-primary">Cockpit</em>
          </h2>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            Vitals, symptoms, transcript, AI suggestions, and safety checks — all in one workspace. No tab-switching, no context loss.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto"
        >
          <div className="border border-border rounded-2xl bg-background overflow-hidden shadow-card">
            <div className="h-[3px] gradient-teal" />
            <div className="p-6">
              {/* Mock cockpit layout */}
              <div className="grid grid-cols-12 gap-3">
                {/* Left panel */}
                <div className="col-span-12 md:col-span-3 space-y-2">
                  <div className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[0.6rem] font-semibold text-foreground uppercase tracking-wide">Patient Context</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 rounded-full bg-muted w-full" />
                      <div className="h-2 rounded-full bg-muted w-3/4" />
                      <div className="h-2 rounded-full bg-muted w-5/6" />
                    </div>
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {["BP: 130/85", "Pulse: 78", "SpO₂: 98%"].map(v => (
                        <span key={v} className="text-[0.5rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{v}</span>
                      ))}
                    </div>
                  </div>
                  <div className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <HeartPulse className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[0.6rem] font-semibold text-foreground uppercase tracking-wide">Symptoms</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {["Fever", "Cough", "Fatigue"].map(s => (
                        <span key={s} className="text-[0.5rem] px-1.5 py-0.5 rounded-full border border-primary/30 text-primary font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Center panel */}
                <div className="col-span-12 md:col-span-6 space-y-2">
                  <div className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <PenLine className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[0.6rem] font-semibold text-foreground uppercase tracking-wide">Clinical Builder</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 rounded-full bg-muted w-full" />
                      <div className="h-2 rounded-full bg-muted w-5/6" />
                      <div className="h-2 rounded-full bg-muted w-full" />
                      <div className="h-2 rounded-full bg-muted w-2/3" />
                    </div>
                  </div>
                  <div className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[0.6rem] font-semibold text-foreground uppercase tracking-wide">AI Care Plan</span>
                      <span className="ml-auto text-[0.45rem] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">Draft</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {["SOAP Notes", "Prescription", "Lab Orders", "Follow-up"].map(item => (
                        <div key={item} className="border border-primary/20 rounded-lg p-2 bg-primary/5">
                          <span className="text-[0.5rem] font-semibold text-primary">{item}</span>
                          <div className="mt-1 h-1.5 rounded-full bg-primary/20 w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right panel */}
                <div className="col-span-12 md:col-span-3 space-y-2">
                  <div className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[0.6rem] font-semibold text-foreground uppercase tracking-wide">Safety</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[0.5rem]">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-muted-foreground">No drug interactions</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[0.5rem]">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-muted-foreground">No allergy conflicts</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[0.5rem]">
                        <AlertTriangle className="w-3 h-3 text-yellow-500" />
                        <span className="text-muted-foreground">Monitor renal function</span>
                      </div>
                    </div>
                  </div>
                  <div className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[0.6rem] font-semibold text-foreground uppercase tracking-wide">AI Copilot</span>
                    </div>
                    <div className="space-y-1">
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

    {/* ════════════════════════════════════════════
        PRODUCT WORKFLOW
    ════════════════════════════════════════════ */}
    <section id="product" className="py-24 bg-background scroll-mt-20">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Product</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            From Conversation to Report{" "}
            <em className="not-italic text-primary">in Seconds</em>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5 max-w-5xl mx-auto">
          {productSteps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative border border-border rounded-2xl p-6 bg-card hover:border-primary/30 hover:shadow-card-hover transition-all text-center"
            >
              <span className="text-[0.55rem] font-mono font-bold text-primary/40 uppercase tracking-widest">{String(i + 1).padStart(2, "0")}</span>
              <div className="w-11 h-11 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mt-2 mb-3">
                <s.icon className="text-primary" size={20} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-1.5">{s.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">{s.desc}</p>
              {i < productSteps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/20 z-10" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ════════════════════════════════════════════
        CLINIC OPERATIONS (NEW)
    ════════════════════════════════════════════ */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Platform</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Designed for the{" "}
            <em className="not-italic text-primary">Entire Patient Visit</em>
          </h2>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            Beyond documentation — DATAelixAIr covers every operational step from consultation to patient messaging.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {clinicOps.map((op, i) => (
            <motion.div
              key={op.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="border border-border rounded-2xl p-6 bg-background hover:border-primary/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mb-4">
                <op.icon className="text-primary" size={18} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-1.5">{op.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">{op.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ════════════════════════════════════════════
        BENEFITS
    ════════════════════════════════════════════ */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Benefits</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Designed for{" "}
            <em className="not-italic text-primary">Real Clinical Workflows</em>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-border rounded-2xl p-7 bg-card hover:border-primary/30 transition-all"
            >
              <div className="w-11 h-11 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mb-4">
                <b.icon className="text-primary" size={20} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ════════════════════════════════════════════
        SAFETY
    ════════════════════════════════════════════ */}
    <section id="security" className="py-24 bg-card border-y border-border scroll-mt-20">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Patient Safety</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Built with Patient Safety{" "}
            <em className="not-italic text-primary">in Mind</em>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {safetyItems.map((s, i) => (
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

    {/* ════════════════════════════════════════════
        PILOT INVITATION
    ════════════════════════════════════════════ */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <motion.div initial="hidden" whileInView="visible" variants={sectionIn} viewport={{ once: true }}>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Early Access</p>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Partner With Us as an{" "}
            <em className="not-italic text-primary">Early Pilot Clinic</em>
          </h2>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
            We're onboarding a limited number of private clinics for early validation. Shape the future of AI-assisted clinical documentation alongside us.
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
