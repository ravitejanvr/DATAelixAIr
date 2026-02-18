import { useParams, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import {
  Bot, BarChart3, Link2, ShieldCheck, DollarSign, GraduationCap, Smartphone, TrendingUp, Search,
  ArrowLeft, CheckCircle2, Workflow, Database, BrainCircuit, FileCheck, Layers, Clock, Stethoscope, type LucideIcon,
} from "lucide-react";

interface ServiceData {
  slug: string;
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  steps: { title: string; description: string; icon: LucideIcon }[];
  benefits: string[];
  useCases: { title: string; description: string }[];
}

const serviceData: ServiceData[] = [
  {
    slug: "clinical-ai-automation",
    icon: Bot,
    title: "Clinical AI Automation",
    tagline: "Free your clinicians from paperwork. Let AI handle the rest.",
    description: "Our Clinical AI Automation platform transforms how healthcare teams operate — automating documentation, scheduling, billing, and workflows so clinicians can focus entirely on patient care. Built with healthcare-specific NLP models that understand medical terminology, context, and clinical intent.",
    steps: [
      { title: "Assess Your Workflows", description: "We map your existing clinical and administrative processes to identify high-impact automation opportunities — from note-taking to referral management.", icon: Search },
      { title: "Deploy AI Models", description: "Our NLP engines are fine-tuned to your specialty, EHR system, and documentation style — ensuring accurate, context-aware automation from day one.", icon: BrainCircuit },
      { title: "Integrate Seamlessly", description: "The platform plugs into your existing EHR, billing, and scheduling systems via HL7/FHIR APIs — no rip-and-replace required.", icon: Link2 },
      { title: "Monitor & Optimise", description: "Real-time dashboards track documentation accuracy, time saved, and staff satisfaction — with continuous AI model improvements.", icon: TrendingUp },
    ],
    benefits: ["Reduce documentation time by up to 70%", "Eliminate manual scheduling conflicts", "AI-powered billing reduces claim denials by 40%", "Clinicians report higher job satisfaction", "24/7 automated workflow management"],
    useCases: [
      { title: "Emergency Department", description: "Automated triage documentation and real-time clinical note generation during high-pressure situations." },
      { title: "Primary Care", description: "Voice-to-text clinical notes, automated referrals, and smart appointment scheduling across multiple providers." },
      { title: "Surgical Teams", description: "Pre-op checklist automation, post-op documentation, and consent form management powered by AI." },
    ],
  },
  {
    slug: "predictive-analytics",
    icon: BarChart3,
    title: "Predictive Analytics",
    tagline: "See the future of patient outcomes before they happen.",
    description: "Our predictive analytics platform leverages machine learning on your hospital's historical and real-time data to forecast patient deterioration, readmission risks, demand surges, and resource needs — enabling proactive, data-driven decisions that save lives and reduce costs.",
    steps: [
      { title: "Data Integration", description: "Securely connect your EHR, lab systems, and IoT devices to our analytics engine. We handle data normalisation and quality assurance automatically.", icon: Database },
      { title: "Model Training", description: "Custom ML models are trained on your institution's data, accounting for your patient demographics, specialties, and regional patterns.", icon: BrainCircuit },
      { title: "Real-Time Alerts", description: "Clinicians receive proactive notifications for at-risk patients, predicted surges, and resource bottlenecks — directly in their workflow.", icon: Clock },
      { title: "Continuous Learning", description: "Models improve over time as they ingest more data, with regular validation against clinical outcomes to ensure accuracy.", icon: TrendingUp },
    ],
    benefits: ["Predict patient deterioration 6–12 hours earlier", "Reduce unplanned readmissions by 30%", "Optimise bed management and staffing", "Identify population health trends", "Data-driven resource allocation"],
    useCases: [
      { title: "ICU Early Warning", description: "Predict sepsis onset and cardiac events hours before traditional monitoring systems flag them." },
      { title: "Capacity Planning", description: "Forecast ED volume, surgical demand, and bed occupancy to optimise staffing and reduce wait times." },
      { title: "Chronic Disease Management", description: "Identify high-risk patients for diabetes, heart failure, and COPD readmission — enabling preventive interventions." },
    ],
  },
  {
    slug: "interoperability-integration",
    icon: Link2,
    title: "Interoperability & Integration",
    tagline: "One unified patient record. Zero data silos.",
    description: "Healthcare runs on dozens of disconnected systems. Our interoperability platform connects EHRs, labs, imaging, pharmacy, wearables, and billing systems into a single, real-time data ecosystem — using HL7 FHIR, API gateways, and legacy connectors.",
    steps: [
      { title: "System Audit", description: "We map every data source in your organisation — from modern cloud EHRs to legacy on-premise systems — and identify integration gaps.", icon: Layers },
      { title: "API & FHIR Layer", description: "Deploy standards-based APIs and FHIR resources that enable real-time data exchange between all connected systems.", icon: Workflow },
      { title: "Legacy Connectors", description: "Custom adapters for older systems (HL7v2, DICOM, proprietary formats) ensure nothing is left behind in your digital transformation.", icon: Link2 },
      { title: "Unified Dashboard", description: "A single pane of glass showing patient data from every source — accessible to authorised clinicians in real time.", icon: Database },
    ],
    benefits: ["Eliminate duplicate data entry across systems", "Real-time data from labs, imaging, and pharmacy", "Reduce medical errors from information gaps", "Standards-compliant (HL7 FHIR, DICOM)", "Future-proof architecture for new integrations"],
    useCases: [
      { title: "Multi-Hospital Networks", description: "Share patient records, lab results, and imaging across facilities in real time — enabling seamless care transitions." },
      { title: "Wearable Integration", description: "Stream data from patient wearables and home monitoring devices directly into the clinical record." },
      { title: "Referral Networks", description: "Automated referral workflows with complete patient context shared securely between referring and receiving providers." },
    ],
  },
  {
    slug: "compliance-security",
    icon: ShieldCheck,
    title: "Compliance & Security",
    tagline: "Security that never sleeps. Compliance that never fails.",
    description: "Our zero-trust security platform provides end-to-end encryption, comprehensive audit trails, and automated compliance monitoring for HIPAA, GDPR, ISO 27001, and regional healthcare regulations — giving you confidence that patient data is always protected.",
    steps: [
      { title: "Security Assessment", description: "Comprehensive audit of your current security posture, identifying vulnerabilities and compliance gaps across all systems.", icon: Search },
      { title: "Zero-Trust Architecture", description: "Deploy encryption at rest and in transit, role-based access controls, and continuous authentication across all endpoints.", icon: ShieldCheck },
      { title: "Automated Compliance", description: "Continuous monitoring against HIPAA, GDPR, and regional frameworks — with automated reporting and remediation workflows.", icon: FileCheck },
      { title: "Ongoing Surveillance", description: "24/7 threat detection, anomaly monitoring, and incident response — with regular penetration testing and security updates.", icon: Clock },
    ],
    benefits: ["Full HIPAA & GDPR compliance automation", "End-to-end encryption for all patient data", "Comprehensive audit trails for every access", "Automated compliance reporting", "Real-time threat detection and response"],
    useCases: [
      { title: "Regulatory Audits", description: "Automated evidence collection and report generation for regulatory audits — reducing preparation time from weeks to hours." },
      { title: "Data Breach Prevention", description: "Proactive monitoring detects and blocks suspicious access patterns before data exposure occurs." },
      { title: "Cross-Border Data", description: "Ensure compliant data handling when sharing patient information across jurisdictions with different privacy laws." },
    ],
  },
  {
    slug: "revenue-cycle-optimisation",
    icon: DollarSign,
    title: "Revenue Cycle Optimisation",
    tagline: "Maximise revenue. Minimise denials. Accelerate cash flow.",
    description: "Our AI-driven revenue cycle management platform improves coding accuracy, predicts claim denials before submission, automates appeals, and optimises accounts receivable — ensuring your institution captures every dollar it's owed.",
    steps: [
      { title: "Revenue Audit", description: "Analyse your current revenue cycle to identify coding errors, denial patterns, underpayments, and process bottlenecks.", icon: Search },
      { title: "AI Coding Engine", description: "Deploy AI-assisted medical coding that suggests accurate codes in real time, reducing errors and improving first-pass acceptance rates.", icon: BrainCircuit },
      { title: "Denial Prediction", description: "Machine learning models predict which claims are likely to be denied — enabling pre-submission corrections that dramatically reduce rejection rates.", icon: BarChart3 },
      { title: "A/R Optimisation", description: "Automated follow-up workflows, smart prioritisation of high-value claims, and analytics-driven collection strategies.", icon: DollarSign },
    ],
    benefits: ["Increase first-pass claim acceptance by 35%", "Reduce denial rates by up to 50%", "Accelerate A/R collection by 25%", "AI-assisted coding reduces errors by 60%", "Real-time revenue dashboards for leadership"],
    useCases: [
      { title: "Large Hospital Systems", description: "Centralised revenue cycle management across multiple facilities with unified reporting and benchmarking." },
      { title: "Specialty Practices", description: "Specialty-specific coding AI trained on ophthalmology, cardiology, oncology, and other high-complexity billing." },
      { title: "Emergency Departments", description: "Rapid coding and charge capture for high-volume, fast-paced ED environments with complex case mixes." },
    ],
  },
  {
    slug: "training-change-management",
    icon: GraduationCap,
    title: "Training & Change Management",
    tagline: "Technology only works when people embrace it.",
    description: "We partner with your teams through every step of AI adoption — from custom training programmes and hands-on workshops to dedicated support and KPI tracking — ensuring your AI investment delivers lasting, measurable impact across the entire organisation.",
    steps: [
      { title: "Readiness Assessment", description: "Evaluate your organisation's AI readiness, staff digital literacy, and change capacity to design an optimal adoption strategy.", icon: Search },
      { title: "Custom Training", description: "Role-specific training programmes for clinicians, administrators, and IT teams — delivered in-person, virtually, or on-demand.", icon: GraduationCap },
      { title: "Guided Rollout", description: "Phased deployment with dedicated change champions, feedback loops, and real-time support to ensure smooth adoption.", icon: Workflow },
      { title: "Measure & Iterate", description: "Track adoption KPIs, user satisfaction, and clinical outcomes — using data to continuously refine training and workflows.", icon: TrendingUp },
    ],
    benefits: ["95% staff adoption rate within 90 days", "Role-specific training for all user types", "Dedicated support during critical go-live periods", "Measurable ROI tracking from day one", "Ongoing optimisation based on usage data"],
    useCases: [
      { title: "Hospital-Wide AI Rollout", description: "Coordinated training and change management across departments for a seamless organisation-wide AI deployment." },
      { title: "EHR Migration", description: "Staff training and workflow redesign during EHR transitions to minimise productivity disruption." },
      { title: "New Department Launch", description: "Complete training packages for new departments or facilities adopting AI-powered workflows for the first time." },
    ],
  },
  {
    slug: "patient-engagement",
    icon: Smartphone,
    title: "Patient Engagement",
    tagline: "Patients who are engaged heal faster.",
    description: "Improve patient satisfaction and outcomes with digital intake, telehealth integration, intelligent appointment reminders, secure messaging portals, and personalised care pathways — meeting patients where they are with the tools they expect.",
    steps: [
      { title: "Patient Journey Mapping", description: "Map the complete patient experience from booking to follow-up, identifying friction points and engagement opportunities.", icon: Stethoscope },
      { title: "Digital Portal Deployment", description: "Launch a branded patient portal with self-scheduling, digital intake, secure messaging, and telehealth capabilities.", icon: Smartphone },
      { title: "Smart Communication", description: "AI-powered reminders, follow-up messages, and health education content personalised to each patient's conditions and preferences.", icon: Bot },
      { title: "Feedback & Analytics", description: "Collect real-time patient satisfaction data with NPS tracking, sentiment analysis, and actionable improvement recommendations.", icon: BarChart3 },
    ],
    benefits: ["Reduce no-show rates by 40%", "Digital intake saves 15 minutes per visit", "Secure telehealth increases access", "Personalised care pathways improve adherence", "Real-time patient satisfaction monitoring"],
    useCases: [
      { title: "Chronic Disease Programs", description: "Engage patients in ongoing self-management with reminders, education, and remote monitoring integration." },
      { title: "Post-Surgical Follow-Up", description: "Automated check-ins and wound monitoring with escalation protocols for concerning symptoms." },
      { title: "Preventive Care", description: "Proactive screening reminders and wellness content that drive higher preventive care utilisation." },
    ],
  },
  {
    slug: "quality-reporting",
    icon: TrendingUp,
    title: "Quality & Reporting",
    tagline: "Quality you can measure. Outcomes you can prove.",
    description: "Meet quality benchmarks and reporting requirements with automated data collection, real-time analysis, and seamless submission to regulatory bodies — turning quality from a burden into a competitive advantage.",
    steps: [
      { title: "Quality Assessment", description: "Evaluate your current quality metrics, reporting workflows, and gaps against national and regional benchmarks.", icon: Search },
      { title: "Automated Collection", description: "Deploy automated data capture from clinical workflows — eliminating manual chart abstraction and improving data accuracy.", icon: Database },
      { title: "Real-Time Dashboards", description: "Live quality dashboards showing performance against measures like HEDIS, CMS Stars, and hospital-specific KPIs.", icon: BarChart3 },
      { title: "Auto Submission", description: "Automated report generation and electronic submission to CMS, TJC, and other regulatory bodies — on time, every time.", icon: FileCheck },
    ],
    benefits: ["Eliminate manual chart abstraction", "Real-time quality measure tracking", "Automated regulatory submissions", "Benchmarking against peer institutions", "Accreditation-ready at all times"],
    useCases: [
      { title: "CMS Quality Reporting", description: "Automated data collection and submission for MIPS, promoting interoperability, and other CMS quality programs." },
      { title: "Hospital Accreditation", description: "Continuous readiness monitoring for TJC, NCQA, and other accreditation bodies with automated evidence collection." },
      { title: "Value-Based Care", description: "Track and report on value-based contract metrics with payer-specific dashboards and outcome analytics." },
    ],
  },
  {
    slug: "explainable-ai",
    icon: Search,
    title: "Explainable AI",
    tagline: "AI you can trust. Decisions you can understand.",
    description: "Transparent, interpretable AI models where every recommendation comes with clear reasoning, comprehensive audit trails, and clinical decision rationale — building the trust clinicians need to confidently integrate AI into their practice.",
    steps: [
      { title: "Model Transparency", description: "Every AI model we deploy includes built-in interpretability — showing which data points drove each recommendation and with what confidence.", icon: Search },
      { title: "Clinical Rationale", description: "Recommendations are presented with evidence-based reasoning that maps to clinical guidelines, making AI outputs actionable and verifiable.", icon: Stethoscope },
      { title: "Audit Trail", description: "Complete decision logs capture every AI interaction — who requested it, what data was used, and what recommendation was made — for full accountability.", icon: FileCheck },
      { title: "Continuous Validation", description: "Regular model validation against clinical outcomes ensures AI recommendations remain accurate, unbiased, and clinically relevant.", icon: TrendingUp },
    ],
    benefits: ["Every recommendation includes clear reasoning", "Full audit trails for regulatory compliance", "Bias detection and mitigation built in", "Clinician confidence increases adoption", "Meets emerging AI regulation requirements"],
    useCases: [
      { title: "Clinical Decision Support", description: "AI-assisted diagnosis and treatment recommendations with transparent reasoning that clinicians can review and validate." },
      { title: "Risk Scoring", description: "Patient risk scores with clear explanations of contributing factors — enabling targeted interventions and informed conversations." },
      { title: "Drug Interaction Alerts", description: "Intelligent medication alerts that explain the clinical basis for each warning, reducing alert fatigue from false positives." },
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

const ServiceDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const service = serviceData.find((s) => s.slug === slug);

  if (!service) return <Navigate to="/services" replace />;

  return (
    <div>
      <SEO title={`${service.title} — DATAelixAIr`} description={service.description.slice(0, 155)} />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(var(--teal)/0.06),transparent_70%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <Link to="/services" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft size={14} /> Back to Services
          </Link>
          <motion.div initial="hidden" animate="visible" className="max-w-3xl">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl teal-muted-bg border teal-muted-border flex items-center justify-center">
                <service.icon className="text-primary" size={28} />
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
              {service.title}
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="mt-3 text-xl text-primary font-medium italic">
              {service.tagline}
            </motion.p>
            <motion.p variants={fadeUp} custom={3} className="mt-5 text-muted-foreground font-light leading-relaxed max-w-2xl">
              {service.description}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* How It Works — Steps */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">How It Works</p>
            <h2 className="font-display text-3xl font-bold text-foreground">Implementation Journey</h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-border hidden md:block" />
              <div className="space-y-8">
                {service.steps.map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12 }}
                    className="flex gap-6 items-start"
                  >
                    <div className="relative z-10 shrink-0">
                      <div className="w-12 h-12 rounded-2xl gradient-teal flex items-center justify-center shadow-teal">
                        <span className="font-display text-sm font-bold text-primary-foreground">{String(i + 1).padStart(2, "0")}</span>
                      </div>
                    </div>
                    <div className="border border-border rounded-2xl p-6 bg-card flex-1 hover:border-primary/40 hover:shadow-card transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <step.icon className="text-primary shrink-0" size={18} />
                        <h3 className="font-display text-lg font-bold text-foreground">{step.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground font-light leading-relaxed">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Key Benefits</p>
              <h2 className="font-display text-3xl font-bold text-foreground mb-8">Why Choose This Solution</h2>
              <ul className="space-y-4">
                {service.benefits.map((b, i) => (
                  <motion.li
                    key={b}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="text-primary shrink-0 mt-0.5" size={18} />
                    <span className="text-sm text-foreground font-light">{b}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: "70%", label: "Time Saved" },
                { val: "99%", label: "Accuracy" },
                { val: "24/7", label: "Monitoring" },
                { val: "100%", label: "Compliant" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-5 text-center hover:border-primary/40 transition-all"
                >
                  <div className="font-display text-2xl font-bold text-primary">{stat.val}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3">Real-World Applications</p>
            <h2 className="font-display text-3xl font-bold text-foreground">Use Cases</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {service.useCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border border-border rounded-2xl p-7 bg-card hover:border-primary hover:-translate-y-1 hover:shadow-card-hover transition-all"
              >
                <h3 className="font-display text-base font-bold text-foreground mb-3">{uc.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">{uc.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-dark py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-dark-foreground">Ready to Get Started?</h2>
          <p className="mt-3 text-dark-muted font-light">Let's discuss how {service.title} can transform your organisation.</p>
          <Button variant="default" size="lg" className="mt-6" asChild>
            <Link to="/contact">Talk to Our Experts →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ServiceDetail;
