import { motion } from "framer-motion";
import { ShieldCheck, Lock, Globe, FileCheck, Server, Database } from "lucide-react";

const securityFeatures = [
  { icon: Database, text: "No patient data stored in demo flows" },
  { icon: Lock, text: "Enterprise-grade encryption at rest & in transit" },
  { icon: Server, text: "Mumbai DC — India data residency available" },
  { icon: ShieldCheck, text: "DPDP / GDPR compliant consent management" },
  { icon: FileCheck, text: "Enterprise: Signed DPA available on request" },
];

const badges = [
  { icon: Lock, label: "TLS 1.3 Secured" },
  { icon: Globe, label: "DPDP Compliant", flag: "🇮🇳" },
  { icon: Globe, label: "UK GDPR Ready", flag: "🇬🇧" },
  { icon: ShieldCheck, label: "MCI Guidelines Followed", flag: "🩺" },
];

const TrustSection = () => (
  <section className="py-24 bg-background">
    <div className="container mx-auto px-4">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Data & Privacy</p>
          <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Enterprise-Grade <em className="not-italic text-primary">Security & Trust</em>
          </h2>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed max-w-xl mx-auto">
            Your data security is our top priority. We adhere to the strictest healthcare data protection standards across India and the UK.
          </p>
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Security features */}
        <div className="space-y-4">
          {securityFeatures.map((item, i) => (
            <motion.div
              key={item.text}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg teal-muted-bg teal-muted-border border flex items-center justify-center shrink-0">
                <item.icon size={16} className="text-primary" />
              </div>
              <p className="text-sm text-foreground font-medium leading-relaxed pt-1.5">{item.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Compliance badges */}
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground mb-2">Compliance Badges</p>
          <div className="grid grid-cols-2 gap-3">
            {badges.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center justify-center p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-card-hover transition-all text-center"
              >
                <span className="text-2xl mb-2">{badge.flag || ""}</span>
                <badge.icon size={24} className="text-primary mb-2" />
                <p className="text-xs font-semibold text-foreground">{badge.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Live stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="teal-muted-bg border teal-muted-border rounded-2xl p-5 mt-4"
          >
            <p className="text-xs font-semibold text-primary mb-2">Live Platform Stats</p>
            <div className="flex justify-around">
              <div className="text-center">
                <p className="font-display text-2xl font-extrabold text-foreground">14+</p>
                <p className="text-[0.65rem] text-muted-foreground">Clinics Live</p>
              </div>
              <div className="text-center">
                <p className="font-display text-2xl font-extrabold text-foreground">2,847</p>
                <p className="text-[0.65rem] text-muted-foreground">Notes Generated</p>
              </div>
              <div className="text-center">
                <p className="font-display text-2xl font-extrabold text-foreground">45s</p>
                <p className="text-[0.65rem] text-muted-foreground">Avg. Note Time</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  </section>
);

export default TrustSection;
