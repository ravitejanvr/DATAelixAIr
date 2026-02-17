import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Shield, Globe, TrendingUp, Lock, Zap, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

const services = [
  { icon: TrendingUp, title: "Revenue Optimization", desc: "AI-driven analytics to maximize hospital revenue, reduce claim denials, and improve billing accuracy." },
  { icon: Shield, title: "Regulatory Compliance", desc: "Stay compliant with HIPAA, GDPR, PDPA, and country-specific healthcare regulations effortlessly." },
  { icon: Globe, title: "Data Interoperability", desc: "Seamless HL7 FHIR, DICOM, and custom API integrations across all your healthcare systems." },
  { icon: Lock, title: "Cybersecurity", desc: "Enterprise-grade data security with end-to-end encryption, zero-trust architecture, and SOC 2 compliance." },
  { icon: Zap, title: "Workflow Automation", desc: "Automate administrative tasks, patient scheduling, and clinical workflows to boost staff productivity." },
  { icon: BarChart3, title: "Performance Analytics", desc: "Real-time dashboards and KPI tracking tailored to your organization's operational goals." },
];

const stats = [
  { value: "500+", label: "Hospitals Served" },
  { value: "45+", label: "Countries" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "$2.1B", label: "Revenue Recovered" },
];

const Index = () => {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center gradient-hero overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-hero/60 to-hero" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full gradient-primary animate-pulse" />
              Trusted by 500+ Healthcare Organizations
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-hero-foreground leading-tight">
              Transform Healthcare with{" "}
              <span className="gradient-text">Intelligent Data</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="mt-6 text-lg md:text-xl text-hero-muted max-w-2xl leading-relaxed">
              DATAelixAIr delivers tailored AI solutions to hospitals and clinics worldwide — boosting productivity, revenue, and compliance with country-specific regulations.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-4">
              <Button variant="hero" size="lg" asChild>
                <Link to="/contact">Schedule a Demo <ArrowRight className="ml-1" size={18} /></Link>
              </Button>
              <Button variant="hero-outline" size="lg" asChild>
                <Link to="/services">Explore Services</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="gradient-hero border-y border-primary/10">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-display font-bold gradient-text">{s.value}</div>
                <div className="text-sm text-hero-muted mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Our Services</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold text-foreground">
              End-to-End Healthcare Solutions
            </h2>
            <p className="mt-4 text-muted-foreground">
              From regulatory compliance to revenue optimization, we tailor every solution to your country, organization size, and operational needs.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group p-6 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                  <s.icon className="text-primary-foreground" size={24} />
                </div>
                <h3 className="text-lg font-display font-semibold text-card-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-surface">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="text-primary text-sm font-semibold uppercase tracking-wider">Why DATAelixAIr</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold text-foreground">
                Built for Global Healthcare Compliance
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Every country has unique healthcare regulations. Our platform adapts to local requirements while maintaining global standards — whether it's HIPAA in the US, GDPR in Europe, or PDPA in Southeast Asia.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Country-specific regulatory mapping & automation",
                  "Real-time compliance monitoring & alerts",
                  "Multi-language, multi-currency support",
                  "Dedicated implementation & support team",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="text-accent mt-0.5 shrink-0" size={20} />
                    <span className="text-foreground text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Button variant="default" className="mt-8" asChild>
                <Link to="/solutions">View Global Solutions <ArrowRight className="ml-1" size={16} /></Link>
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden shadow-card-hover border border-border">
                <img src={heroBg} alt="Global healthcare network" className="w-full h-80 object-cover" />
              </div>
              <div className="absolute -bottom-6 -left-6 p-4 rounded-xl bg-card shadow-card-hover border border-border">
                <div className="text-2xl font-display font-bold gradient-text">45+</div>
                <div className="text-xs text-muted-foreground">Countries Served</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-hero-foreground">
              Ready to Transform Your Healthcare Operations?
            </h2>
            <p className="mt-4 text-hero-muted max-w-xl mx-auto">
              Join 500+ hospitals worldwide that trust DATAelixAIr to optimize their revenue and ensure compliance.
            </p>
            <div className="mt-8 flex justify-center gap-4 flex-wrap">
              <Button variant="hero" size="lg" asChild>
                <Link to="/contact">Get Started Today</Link>
              </Button>
              <Button variant="hero-outline" size="lg" asChild>
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Index;
