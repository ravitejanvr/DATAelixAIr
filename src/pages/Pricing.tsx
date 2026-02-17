import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const plans = [
  {
    name: "Starter", desc: "For small clinics getting started with data optimization.",
    price: "$2,499", period: "/month", featured: false,
    features: ["Up to 50 providers", "Core compliance monitoring", "Basic analytics dashboard", "Email support", "1 system integration", "Standard security"],
  },
  {
    name: "Professional", desc: "For mid-size hospitals needing comprehensive solutions.",
    price: "$7,999", period: "/month", featured: true,
    features: ["Up to 500 providers", "Full regulatory compliance suite", "Advanced AI analytics", "24/7 priority support", "Unlimited integrations", "Revenue optimization engine", "Custom reporting", "Dedicated account manager"],
  },
  {
    name: "Enterprise", desc: "For large health systems and hospital networks.",
    price: "Custom", period: "", featured: false,
    features: ["Unlimited providers", "Multi-facility management", "Custom AI model training", "On-premise deployment option", "SLA-backed uptime guarantee", "White-label options", "Executive analytics suite", "Dedicated engineering team"],
  },
];

const Pricing = () => (
  <div>
    <section className="pt-32 pb-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Pricing</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Plans That <em className="not-italic text-primary">Scale</em> With You
          </h1>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed">
            Transparent pricing with no hidden fees. Every plan is customizable to your region and organization size.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-[20px] p-9 border transition-all ${
                p.featured
                  ? "bg-card border-primary shadow-card-hover scale-105"
                  : "bg-card border-border shadow-card"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 gradient-teal rounded-full text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <h3 className="font-display text-xl font-bold text-foreground">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground font-light">{p.desc}</p>
              <div className="mt-6">
                <span className="font-display text-4xl font-bold text-foreground">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="text-primary shrink-0" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={p.featured ? "default" : "outline"} className="w-full mt-8" asChild>
                <Link to="/contact">{p.name === "Enterprise" ? "Contact Sales" : "Schedule Demo"} →</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default Pricing;
