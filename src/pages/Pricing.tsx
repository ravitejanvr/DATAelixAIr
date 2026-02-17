import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    desc: "For small clinics getting started with data optimization.",
    price: "$2,499",
    period: "/month",
    features: [
      "Up to 50 providers",
      "Core compliance monitoring",
      "Basic analytics dashboard",
      "Email support",
      "1 system integration",
      "Standard security",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Professional",
    desc: "For mid-size hospitals needing comprehensive solutions.",
    price: "$7,999",
    period: "/month",
    features: [
      "Up to 500 providers",
      "Full regulatory compliance suite",
      "Advanced AI analytics",
      "24/7 priority support",
      "Unlimited integrations",
      "Revenue optimization engine",
      "Custom reporting",
      "Dedicated account manager",
    ],
    cta: "Schedule Demo",
    featured: true,
  },
  {
    name: "Enterprise",
    desc: "For large health systems and hospital networks.",
    price: "Custom",
    period: "",
    features: [
      "Unlimited providers",
      "Multi-facility management",
      "Custom AI model training",
      "On-premise deployment option",
      "SLA-backed uptime guarantee",
      "White-label options",
      "Executive analytics suite",
      "Dedicated engineering team",
    ],
    cta: "Contact Sales",
    featured: false,
  },
];

const Pricing = () => (
  <div>
    <section className="gradient-hero py-24">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Pricing</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold text-hero-foreground">
            Plans That Scale With You
          </h1>
          <p className="mt-4 text-hero-muted text-lg">
            Transparent pricing with no hidden fees. Every plan is customizable to your region and organization size.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-8 rounded-xl border shadow-card transition-all duration-300 hover:shadow-card-hover ${
                p.featured
                  ? "bg-card border-primary shadow-glow scale-105"
                  : "bg-card border-border"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 gradient-primary rounded-full text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-display font-bold text-card-foreground">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-6">
                <span className="text-4xl font-display font-bold text-foreground">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="text-accent shrink-0" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={p.featured ? "hero" : "default"}
                className="w-full mt-8"
                asChild
              >
                <Link to="/contact">{p.cta} <ArrowRight className="ml-1" size={16} /></Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default Pricing;
