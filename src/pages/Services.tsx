import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const services = [
  {
    icon: "🤖", title: "Clinical AI Automation",
    desc: "Automate administrative workflows, clinical documentation, and scheduling — freeing clinicians to focus on patient care and cutting operational costs.",
    features: ["NLP Documentation", "Smart Scheduling", "Billing AI", "Workflow Engine"],
  },
  {
    icon: "📊", title: "Predictive Analytics",
    desc: "Harness your hospital's data to predict patient deterioration, readmission risks, and demand surges before they happen — improving outcomes and resource efficiency.",
    features: ["Risk Stratification", "Demand Forecasting", "Population Health", "Readmission AI"],
  },
  {
    icon: "🔗", title: "Interoperability & Integration",
    desc: "Seamlessly connect disparate systems — EHRs, labs, imaging, and wearables — using HL7 FHIR standards for a unified, real-time patient data ecosystem.",
    features: ["HL7 / FHIR", "EHR Integration", "API Layer", "Legacy Connectors"],
  },
  {
    icon: "🛡️", title: "Compliance & Security",
    desc: "Our zero-trust, end-to-end encrypted platform ensures full HIPAA, GDPR, and regional regulatory compliance, with complete audit trails and data sovereignty.",
    features: ["HIPAA", "GDPR", "ISO 27001", "SOC 2 Type II"],
  },
  {
    icon: "💰", title: "Revenue Cycle Optimisation",
    desc: "AI-driven coding accuracy, denial prediction, and claims management to maximise reimbursements and accelerate cash flow for your institution.",
    features: ["Claims AI", "Coding Accuracy", "Denial Mgmt", "A/R Optimization"],
  },
  {
    icon: "🎓", title: "Training & Change Management",
    desc: "We partner with your teams through adoption — from custom training programmes to dedicated support — ensuring AI delivers lasting impact across your organisation.",
    features: ["Staff Training", "Ongoing Support", "KPI Tracking", "Change Strategy"],
  },
  {
    icon: "📱", title: "Patient Engagement",
    desc: "Improve patient satisfaction with digital intake, telehealth integration, appointment reminders, and secure messaging portals.",
    features: ["Patient Portal", "Telehealth", "Reminders", "Feedback"],
  },
  {
    icon: "📈", title: "Quality & Reporting",
    desc: "Meet quality benchmarks and reporting requirements with automated data collection, analysis, and submission to regulatory bodies.",
    features: ["Quality Measures", "Auto Reporting", "Benchmarking", "Accreditation"],
  },
];

const Services = () => (
  <div>
    <section className="pt-32 pb-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Our Services</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Comprehensive <em className="not-italic text-primary">Healthcare</em> Solutions
          </h1>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed">
            Every service is tailored to your country's regulations, your organization's size, and your specific operational challenges.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-5">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group border border-border rounded-[20px] p-9 bg-card hover:border-primary hover:-translate-y-1 hover:shadow-card-hover transition-all relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-5 relative z-10">
                <div className="w-[52px] h-[52px] rounded-[14px] teal-muted-bg border teal-muted-border flex items-center justify-center text-2xl shrink-0">
                  {s.icon}
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">{s.title}</h3>
                  <p className="mt-2.5 text-sm text-muted-foreground font-light leading-relaxed">{s.desc}</p>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {s.features.map((f) => (
                      <span key={f} className="text-[0.7rem] font-medium tracking-wide px-2.5 py-1 rounded-full border border-border bg-card text-gray-mid">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 teal-muted-bg border teal-muted-border rounded-2xl px-8 py-7 flex items-center justify-between flex-wrap gap-5">
          <p className="text-sm font-medium text-foreground">Need a custom solution? We design bespoke packages for your institution.</p>
          <Button variant="default" asChild>
            <Link to="/contact">Talk to Our Experts →</Link>
          </Button>
        </div>
      </div>
    </section>
  </div>
);

export default Services;
