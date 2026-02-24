import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mic, FileText, Pill, ClipboardList, CheckCircle2, ArrowRight, ShieldCheck, Eye, Users } from "lucide-react";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7 } }),
};

const steps = [
  { icon: Mic, title: "Record Consultation", desc: "Voice capture during the patient visit. Works with any accent or language mix." },
  { icon: FileText, title: "AI Structures Clinical Notes", desc: "Automatic SOAP note generation with structured sections ready for review." },
  { icon: Eye, title: "Review & Edit", desc: "Clinician reviews, edits, and approves every AI-generated output before use." },
  { icon: ClipboardList, title: "Export & Share", desc: "Download structured notes or integrate directly into your existing workflow." },
];

const features = [
  "Structured SOAP notes from audio",
  "Prescription draft generation",
  "Patient summary reports",
  "Drug interaction flagging",
  "Clinician review before finalisation",
  "Works with Indian English accents",
  "Under 60-second turnaround",
  "No patient data stored in demo mode",
];

const Product = () => (
  <div>
    <SEO
      title="Product — DATAelixAIr"
      description="AI clinical documentation assistant that converts consultation audio into structured SOAP notes, prescription drafts, and patient summaries."
    />

    {/* Hero */}
    <section className="pt-32 pb-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" animate="visible" className="max-w-3xl mx-auto text-center">
          <motion.p variants={fadeUp} custom={0} className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">
            Product
          </motion.p>
          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.2rem,4.5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
            AI Clinical Documentation <em className="not-italic text-primary">in Under 60 Seconds</em>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="mt-6 text-muted-foreground font-light leading-relaxed max-w-xl mx-auto">
            Record, structure, review, and export — a complete clinical documentation workflow powered by AI, designed for real consultations in private clinics.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="default" size="lg" asChild>
              <Link to="/contact">Request Pilot Access →</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/contact">Book Demo</Link>
            </Button>
          </motion.div>
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
        <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {steps.map((step, i) => (
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
              <h3 className="font-display text-sm font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">{step.desc}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-4 top-7 w-5 h-5 text-primary/20" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Features */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Capabilities</p>
          <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-10">
            What You Get
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card"
              >
                <CheckCircle2 className="text-primary shrink-0" size={18} />
                <span className="text-sm text-foreground font-medium">{f}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Clinical Safety */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Clinical Safety</p>
          <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-6">
            Human-in-the-Loop by Design
          </h2>
          <p className="text-muted-foreground font-light leading-relaxed max-w-xl mx-auto mb-12">
            All AI outputs are transparent, editable, and require clinician approval before use. No autonomous clinical decisions — ever.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Eye, title: "Reviewable Outputs", desc: "Every AI-generated note can be reviewed and edited before finalisation." },
              { icon: ShieldCheck, title: "Clinician-Controlled", desc: "AI assists — the clinician decides. No output is used without explicit approval." },
              { icon: Users, title: "Audit Trail", desc: "Complete audit logs of AI interactions and clinician approvals." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-border bg-background text-center"
              >
                <div className="w-12 h-12 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto mb-4">
                  <item.icon className="text-primary" size={22} />
                </div>
                <h3 className="font-display text-sm font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground mb-4">
          Ready to Save Consultation Time?
        </h2>
        <p className="text-muted-foreground font-light mb-8">
          Join our early pilot programme and experience AI-powered clinical documentation firsthand.
        </p>
        <Button variant="default" size="lg" asChild>
          <Link to="/contact">Apply for Pilot →</Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Product;
