import { useParams, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import {
  ArrowLeft, CheckCircle2, Building2, Hospital, Stethoscope, Heart,
  Users, Settings, BarChart3, ShieldCheck, Workflow, TrendingUp, Clock,
  BrainCircuit, type LucideIcon,
} from "lucide-react";

interface SolutionData {
  slug: string;
  icon: LucideIcon;
  name: string;
  tagline: string;
  description: string;
  steps: { title: string; description: string; icon: LucideIcon }[];
  features: string[];
  outcomes: { metric: string; label: string }[];
  idealFor: string[];
}

const solutionData: SolutionData[] = [
  {
    slug: "small-clinics",
    icon: Building2,
    name: "Small Clinics & Outpatient Centres",
    tagline: "Big AI capabilities. Small clinic simplicity.",
    description: "Purpose-built AI that fits lean operations — automating admin tasks, improving patient flow, and boosting satisfaction without the complexity or cost of enterprise solutions. Designed for clinics with 1–50 providers who need maximum impact with minimum overhead.",
    steps: [
      { title: "Quick Assessment", description: "A focused 2-week evaluation of your clinic's workflows, pain points, and quick-win opportunities — no lengthy consulting engagements.", icon: Clock },
      { title: "Plug & Play Setup", description: "Pre-configured AI modules for scheduling, intake, billing, and patient communication that deploy in days, not months.", icon: Settings },
      { title: "Staff Onboarding", description: "Hands-on training designed for small teams — practical, role-specific sessions that get your staff confident with AI tools quickly.", icon: Users },
      { title: "Ongoing Support", description: "Dedicated account support with regular check-ins, performance reporting, and continuous optimisation as your clinic grows.", icon: Heart },
    ],
    features: ["Appointment optimisation & smart scheduling", "Digital patient intake & forms", "Automated billing & coding assistance", "Patient feedback analytics & NPS tracking", "Telehealth integration", "Automated appointment reminders"],
    outcomes: [
      { metric: "40%", label: "Fewer No-Shows" },
      { metric: "15min", label: "Saved Per Visit" },
      { metric: "95%", label: "Patient Satisfaction" },
      { metric: "2wks", label: "Time to Deploy" },
    ],
    idealFor: ["Solo practitioners and small group practices", "Outpatient clinics and ambulatory centres", "Urgent care and walk-in clinics", "Specialty practices under 50 providers"],
  },
  {
    slug: "mid-size-hospitals",
    icon: Hospital,
    name: "Mid-Size Hospitals (100–500 beds)",
    tagline: "Enterprise intelligence. Mid-size agility.",
    description: "Comprehensive AI covering clinical workflows, compliance, revenue cycle, and analytics — tailored to your departments, staff composition, and patient mix. Designed for hospitals that need sophisticated AI without the multi-year implementation timelines of enterprise solutions.",
    steps: [
      { title: "Department Mapping", description: "Detailed analysis of workflows across your key departments — ED, OR, inpatient, outpatient — identifying high-impact AI opportunities.", icon: BarChart3 },
      { title: "Phased Deployment", description: "Start with your highest-priority department, prove ROI, then expand systematically — reducing risk and building organisational confidence.", icon: Workflow },
      { title: "Integration & Compliance", description: "Connect with your EHR, billing, and lab systems while ensuring regulatory compliance across all AI touchpoints.", icon: ShieldCheck },
      { title: "Scale & Optimise", description: "Expand to additional departments with proven playbooks, cross-department analytics, and continuous model improvement.", icon: TrendingUp },
    ],
    features: ["Department-level analytics dashboards", "Predictive staffing & resource planning", "EHR integration (Epic, Cerner, MEDITECH)", "Regulatory compliance monitoring", "Clinical decision support", "Revenue cycle optimisation"],
    outcomes: [
      { metric: "30%", label: "Productivity Gain" },
      { metric: "25%", label: "Revenue Increase" },
      { metric: "50%", label: "Fewer Denials" },
      { metric: "3mo", label: "First Department Live" },
    ],
    idealFor: ["Community hospitals with 100–500 beds", "Regional medical centres", "Teaching hospitals", "Multi-specialty hospital groups"],
  },
  {
    slug: "large-hospitals",
    icon: Hospital,
    name: "Large Hospitals & Networks",
    tagline: "Unified AI across every facility in your network.",
    description: "Enterprise-scale AI designed for multi-site hospital systems — with unified dashboards, cross-facility analytics, custom model training, and dedicated support teams. Built for organisations managing thousands of beds, diverse specialties, and complex regulatory requirements across regions.",
    steps: [
      { title: "Enterprise Discovery", description: "Comprehensive assessment across all facilities, departments, and systems — creating a unified AI strategy aligned with your network's strategic priorities.", icon: BrainCircuit },
      { title: "Architecture Design", description: "Design a scalable, secure AI infrastructure that supports multi-site deployment, data sovereignty, and cross-facility analytics.", icon: Settings },
      { title: "Coordinated Rollout", description: "Simultaneous or sequential deployment across facilities with dedicated implementation teams, change management, and executive reporting.", icon: Users },
      { title: "Network Intelligence", description: "Cross-facility benchmarking, network-wide predictive analytics, and unified quality reporting that turns your scale into a strategic advantage.", icon: TrendingUp },
    ],
    features: ["Multi-site management & unified dashboards", "Cross-facility data sharing & benchmarking", "Custom AI model training on network data", "Dedicated support team & executive reporting", "Network-wide compliance monitoring", "Advanced interoperability across systems"],
    outcomes: [
      { metric: "40%", label: "Operational Efficiency" },
      { metric: "$10M+", label: "Annual Savings" },
      { metric: "100%", label: "Compliance Coverage" },
      { metric: "6mo", label: "Full Network Deployment" },
    ],
    idealFor: ["Health systems with 500+ beds", "Multi-hospital networks", "Academic medical centres", "National healthcare chains"],
  },
  {
    slug: "specialty-clinics",
    icon: Stethoscope,
    name: "Speciality & Niche Clinics",
    tagline: "AI that speaks your specialty's language.",
    description: "AI tuned for specialty workflows — from ophthalmology to oncology, cardiology to orthopaedics — with domain-specific models, targeted outcome tracking, and niche compliance support. Because generic AI doesn't cut it when clinical precision matters most.",
    steps: [
      { title: "Specialty Assessment", description: "Deep dive into your specialty's unique workflows, documentation requirements, outcome measures, and regulatory landscape.", icon: Stethoscope },
      { title: "Custom Model Training", description: "AI models trained on specialty-specific data, terminology, and clinical protocols — ensuring recommendations are clinically relevant and precise.", icon: BrainCircuit },
      { title: "Workflow Integration", description: "Seamless integration with specialty-specific EHR modules, imaging systems, and diagnostic tools used in your practice.", icon: Workflow },
      { title: "Outcome Tracking", description: "Specialty-specific outcome dashboards tracking clinical metrics, patient satisfaction, and practice efficiency against specialty benchmarks.", icon: BarChart3 },
    ],
    features: ["Speciality-specific AI models & terminology", "Targeted outcome tracking & benchmarking", "Niche compliance support (specialty regulations)", "Patient journey mapping & optimisation", "Specialty-specific clinical decision support", "Integration with specialty diagnostic tools"],
    outcomes: [
      { metric: "50%", label: "Documentation Time Saved" },
      { metric: "35%", label: "Better Outcomes" },
      { metric: "99%", label: "Coding Accuracy" },
      { metric: "4wks", label: "Time to Deploy" },
    ],
    idealFor: ["Ophthalmology and optometry practices", "Oncology and haematology centres", "Cardiology and cardiac surgery groups", "Orthopaedics and rehabilitation clinics"],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

const SolutionDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const solution = solutionData.find((s) => s.slug === slug);

  if (!solution) return <Navigate to="/solutions" replace />;

  return (
    <div>
      <SEO title={`${solution.name} — DATAelixAIr`} description={solution.description.slice(0, 155)} />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(var(--teal)/0.06),transparent_70%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <Link to="/solutions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft size={14} /> Back to Solutions
          </Link>
          <motion.div initial="hidden" animate="visible" className="max-w-3xl">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl teal-muted-bg border teal-muted-border flex items-center justify-center">
                <solution.icon className="text-primary" size={28} />
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
              {solution.name}
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="mt-3 text-xl text-primary font-medium italic">
              {solution.tagline}
            </motion.p>
            <motion.p variants={fadeUp} custom={3} className="mt-5 text-muted-foreground font-light leading-relaxed max-w-2xl">
              {solution.description}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {solution.outcomes.map((o, i) => (
              <motion.div
                key={o.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/40 hover:shadow-card transition-all"
              >
                <div className="font-display text-3xl font-bold text-primary">{o.metric}</div>
                <div className="text-xs text-muted-foreground mt-1.5">{o.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Implementation Steps */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Our Approach</p>
            <h2 className="font-display text-3xl font-bold text-foreground">Implementation Journey</h2>
          </div>
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-5">
            {solution.steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border border-border rounded-2xl p-7 bg-card hover:border-primary/40 hover:shadow-card transition-all relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 right-0 h-1 gradient-teal opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center shadow-teal">
                    <span className="font-display text-xs font-bold text-primary-foreground">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features & Ideal For */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">What's Included</p>
              <h2 className="font-display text-2xl font-bold text-foreground mb-6">Features</h2>
              <ul className="space-y-3">
                {solution.features.map((f, i) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="text-primary shrink-0 mt-0.5" size={16} />
                    <span className="text-sm text-foreground font-light">{f}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Perfect For</p>
              <h2 className="font-display text-2xl font-bold text-foreground mb-6">Ideal For</h2>
              <ul className="space-y-3">
                {solution.idealFor.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-lg teal-muted-bg flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="text-primary" size={12} />
                    </div>
                    <span className="text-sm text-foreground font-light">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Evidence */}
      <ClinicalEvidenceSection feature={solution.slug} />

      {/* CTA */}
      <section className="bg-dark py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-dark-foreground">Ready to Transform Your Facility?</h2>
          <p className="mt-3 text-dark-muted font-light">Let's discuss the perfect AI solution for your organisation.</p>
          <Button variant="default" size="lg" className="mt-6" asChild>
            <Link to="/contact">Get in Touch →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SolutionDetail;
