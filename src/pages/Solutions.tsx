import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const solutions = [
  {
    name: "Small Clinics & Outpatient Centres",
    desc: "Streamlined AI that fits lean operations — automating admin, improving patient flow, and boosting satisfaction without complexity.",
    features: ["Appointment optimisation", "Digital patient intake", "Automated billing & coding", "Patient feedback analytics"],
  },
  {
    name: "Mid-Size Hospitals (100–500 beds)",
    desc: "Comprehensive AI covering clinical workflows, compliance, and revenue — tailored to your departments, staff, and patient mix.",
    features: ["Department-level analytics", "Predictive staffing", "EHR integration", "Regulatory compliance monitoring"],
  },
  {
    name: "Large Hospitals & Networks",
    desc: "Enterprise-scale AI across multiple sites — with unified dashboards, cross-facility analytics, and advanced interoperability.",
    features: ["Multi-site management", "Cross-facility data sharing", "Custom AI model training", "Dedicated support team"],
  },
  {
    name: "Speciality & Niche Clinics",
    desc: "AI tuned for speciality workflows — from ophthalmology to oncology — with domain-specific models and compliance.",
    features: ["Speciality-specific AI models", "Targeted outcome tracking", "Niche compliance support", "Patient journey mapping"],
  },
];

const regions = [
  { name: "North America", regs: ["HIPAA", "HITECH", "PIPEDA"], status: "Building compliance framework" },
  { name: "Europe & UK", regs: ["GDPR", "NHS DSP", "EU MDR"], status: "Active development" },
  { name: "Middle East", regs: ["DHA", "NHRA", "Saudi PDPL"], status: "Research phase" },
  { name: "Asia Pacific", regs: ["PDPA", "DISHA", "APPI"], status: "Research phase" },
];

const Solutions = () => (
  <div>
    <section className="pt-32 pb-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Tailored Solutions</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Built for <em className="not-italic text-primary">Your</em> Facility
          </h1>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed">
            Every hospital and clinic is different. Our AI solutions are designed from the ground up to fit your specific size, speciality, workflows, and regulatory environment.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4 space-y-5">
        {solutions.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="border border-border rounded-[20px] p-9 bg-card hover:shadow-card transition-all"
          >
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/3">
                <h3 className="font-display text-xl font-bold text-foreground">{s.name}</h3>
                <p className="text-sm text-muted-foreground mt-2 font-light leading-relaxed">{s.desc}</p>
              </div>
              <div className="lg:w-2/3">
                <ul className="grid sm:grid-cols-2 gap-3">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="text-primary shrink-0" size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>

    {/* Regulatory Roadmap */}
    <section className="py-20 bg-muted">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Regulatory Roadmap</p>
          <h2 className="font-display text-3xl font-bold text-foreground">Compliance by Region</h2>
          <p className="mt-3 text-muted-foreground font-light max-w-lg mx-auto">
            We're actively building our regulatory compliance framework. Here's where we stand across key regions.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {regions.map((r) => (
            <div key={r.name} className="border border-border rounded-2xl p-6 bg-card">
              <h4 className="font-display font-bold text-foreground text-sm">{r.name}</h4>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {r.regs.map((reg) => (
                  <span key={reg} className="text-[0.65rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded teal-muted-bg text-primary">{reg}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">{r.status}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-dark py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-display text-3xl font-bold text-dark-foreground">Have a Unique Requirement?</h2>
        <p className="mt-3 text-dark-muted">We design bespoke AI solutions for facilities of any size or speciality.</p>
        <Button variant="default" size="lg" className="mt-6" asChild>
          <Link to="/contact">Let's Discuss →</Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Solutions;
