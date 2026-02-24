import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, Server, Globe, FileCheck, Database } from "lucide-react";
import SEO from "@/components/SEO";

const features = [
  { icon: Lock, title: "Encryption in Transit", desc: "All data is encrypted using TLS 1.3 during transmission." },
  { icon: Database, title: "Encryption at Rest", desc: "Patient data is encrypted at rest using AES-256 standards." },
  { icon: Server, title: "India Data Residency", desc: "Data residency option available with Mumbai-based infrastructure." },
  { icon: Globe, title: "DPDP & GDPR Aligned", desc: "Architecture designed to align with India's DPDP Act and GDPR requirements." },
  { icon: FileCheck, title: "Enterprise DPA", desc: "Data Processing Agreement available upon request for enterprise clients." },
  { icon: ShieldCheck, title: "No PHI in Demo Mode", desc: "Demo and trial flows do not store any patient health information." },
];

const Security = () => (
  <div>
    <SEO
      title="Security & Data Protection — DATAelixAIr"
      description="How DATAelixAIr protects clinical data. TLS 1.3, encryption at rest, DPDP and GDPR aligned architecture, India data residency."
    />

    <section className="pt-32 pb-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Security</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
            Security & <em className="not-italic text-primary">Data Protection</em>
          </h1>
          <p className="mt-6 text-muted-foreground font-light leading-relaxed">
            We take a responsible, transparent approach to protecting clinical data. Here is exactly what we do — and what we don't claim.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {features.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center mb-4">
                <item.icon className="text-primary" size={20} />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Honest disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 max-w-4xl mx-auto teal-muted-bg border teal-muted-border rounded-2xl px-8 py-6 text-center"
        >
          <p className="text-sm text-foreground font-medium mb-2">Transparency Note</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-lg mx-auto">
            We are building towards formal certifications (ISO 27001, SOC 2). At this stage, our architecture is designed for compliance alignment — we do not claim certifications we have not yet obtained.
          </p>
        </motion.div>

        <div className="mt-16 text-center">
          <Button variant="default" size="lg" asChild>
            <Link to="/contact">Request Security Details →</Link>
          </Button>
        </div>
      </div>
    </section>
  </div>
);

export default Security;
