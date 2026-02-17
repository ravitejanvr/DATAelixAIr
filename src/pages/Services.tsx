import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { TrendingUp, Shield, Globe, Lock, Zap, BarChart3, Brain, FileCheck, Users, ArrowRight } from "lucide-react";

const services = [
  {
    icon: TrendingUp,
    title: "Revenue Cycle Management",
    desc: "Reduce claim denials by up to 40% with AI-powered coding, billing automation, and real-time denial analytics. Our system adapts to each payer's requirements.",
    features: ["Automated charge capture", "Predictive denial prevention", "Payer-specific optimization", "A/R management"],
  },
  {
    icon: Shield,
    title: "Regulatory Compliance",
    desc: "Navigate complex healthcare regulations with automated compliance monitoring for HIPAA, GDPR, PDPA, LGPD, and 40+ country-specific frameworks.",
    features: ["Continuous compliance monitoring", "Automated audit trails", "Policy management", "Staff training modules"],
  },
  {
    icon: Globe,
    title: "Data Interoperability",
    desc: "Connect disparate systems with HL7 FHIR, DICOM, and custom API integrations. Achieve seamless data flow across your entire healthcare ecosystem.",
    features: ["HL7 FHIR R4 support", "Legacy system integration", "Real-time data sync", "Custom API development"],
  },
  {
    icon: Lock,
    title: "Healthcare Cybersecurity",
    desc: "Protect patient data with enterprise-grade security including zero-trust architecture, encryption, and 24/7 threat monitoring.",
    features: ["Zero-trust architecture", "End-to-end encryption", "Threat detection & response", "Penetration testing"],
  },
  {
    icon: Brain,
    title: "Clinical AI Analytics",
    desc: "Leverage machine learning models for predictive patient outcomes, readmission risk, and population health management.",
    features: ["Predictive analytics", "Population health insights", "Clinical decision support", "Outcome measurement"],
  },
  {
    icon: Zap,
    title: "Workflow Automation",
    desc: "Eliminate manual processes with intelligent automation for scheduling, documentation, referrals, and prior authorization.",
    features: ["Smart scheduling", "Auto-documentation", "Referral management", "Prior auth automation"],
  },
  {
    icon: FileCheck,
    title: "Quality & Reporting",
    desc: "Meet quality benchmarks and reporting requirements with automated data collection, analysis, and submission.",
    features: ["Quality measure tracking", "Automated reporting", "Benchmarking analytics", "Accreditation support"],
  },
  {
    icon: Users,
    title: "Patient Engagement",
    desc: "Improve patient satisfaction with digital intake, telehealth integration, appointment reminders, and secure messaging.",
    features: ["Patient portal", "Telehealth integration", "Automated reminders", "Feedback collection"],
  },
];

const Services = () => (
  <div>
    <section className="gradient-hero py-24">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Our Services</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold text-hero-foreground">
            Comprehensive Healthcare Solutions
          </h1>
          <p className="mt-4 text-hero-muted text-lg">
            Every service is tailored to your country's regulations, your organization's size, and your specific operational challenges.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="p-8 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                  <s.icon className="text-primary-foreground" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-display font-semibold text-card-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <ul className="mt-4 grid grid-cols-2 gap-2">
                    {s.features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full gradient-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 gradient-hero">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-display font-bold text-hero-foreground">Need a Custom Solution?</h2>
        <p className="mt-3 text-hero-muted">We design bespoke packages tailored to your hospital or clinic's unique needs.</p>
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/contact">Talk to Our Experts <ArrowRight className="ml-1" size={16} /></Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Services;
