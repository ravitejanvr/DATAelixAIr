import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { DollarSign, Users, TrendingUp, Gift, ArrowRight, CheckCircle2, BarChart3, Globe } from "lucide-react";

const tiers = [
  { name: "Silver Partner", commission: "10%", requirement: "1-5 referrals/quarter", perks: ["Marketing materials", "Partner portal access", "Email support"] },
  { name: "Gold Partner", commission: "15%", requirement: "6-15 referrals/quarter", perks: ["Co-branded collateral", "Priority support", "Quarterly business reviews", "Lead sharing"] },
  { name: "Platinum Partner", commission: "20%+", requirement: "16+ referrals/quarter", perks: ["Custom commission rates", "Dedicated partner manager", "Joint marketing campaigns", "Revenue share on renewals", "Event sponsorship"] },
];

const benefits = [
  { icon: DollarSign, title: "Recurring Revenue", desc: "Earn commissions on every deal — and on renewals. Build a sustainable revenue stream." },
  { icon: Users, title: "Extensive Support", desc: "Get marketing materials, co-selling support, and a dedicated partner success manager." },
  { icon: TrendingUp, title: "Growth Resources", desc: "Access training, certifications, and sales enablement tools to accelerate your pipeline." },
  { icon: Globe, title: "Global Opportunity", desc: "Healthcare is a $8.5T global market. Partner with us to capture demand in your region." },
];

const Affiliate = () => (
  <div>
    <section className="gradient-hero py-24">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Affiliate & Partner Program</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold text-hero-foreground">
            Earn While Transforming Healthcare
          </h1>
          <p className="mt-4 text-hero-muted text-lg">
            Join our affiliate program and earn recurring commissions by referring hospitals and clinics to DATAelixAIr.
          </p>
          <Button variant="hero" size="lg" className="mt-8" asChild>
            <Link to="/contact">Apply Now <ArrowRight className="ml-1" size={16} /></Link>
          </Button>
        </motion.div>
      </div>
    </section>

    {/* Benefits */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-display font-bold text-foreground">Why Partner With Us?</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-xl bg-card border border-border shadow-card text-center"
            >
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-4">
                <b.icon className="text-primary-foreground" size={24} />
              </div>
              <h3 className="font-display font-semibold text-card-foreground">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Tiers */}
    <section className="py-24 bg-surface">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-display font-bold text-foreground">Commission Tiers</h2>
          <p className="mt-3 text-muted-foreground">The more you refer, the more you earn.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`p-8 rounded-xl border shadow-card ${
                i === 2 ? "bg-card border-primary shadow-glow" : "bg-card border-border"
              }`}
            >
              <h3 className="font-display font-bold text-lg text-card-foreground">{t.name}</h3>
              <div className="mt-3 text-4xl font-display font-bold gradient-text">{t.commission}</div>
              <p className="text-xs text-muted-foreground mt-1">{t.requirement}</p>
              <ul className="mt-6 space-y-2">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="text-accent shrink-0" size={14} />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* How it works */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-display font-bold text-foreground">How It Works</h2>
        </div>
        <div className="space-y-8">
          {[
            { step: "01", title: "Apply", desc: "Fill out the partner application form. We'll review and get back within 48 hours." },
            { step: "02", title: "Onboard", desc: "Get access to the partner portal, marketing materials, and sales training." },
            { step: "03", title: "Refer", desc: "Share your unique referral link or introduce prospects directly to our sales team." },
            { step: "04", title: "Earn", desc: "Receive commissions on closed deals, with bonuses for renewals and upsells." },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-6 items-start"
            >
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center shrink-0 text-sm font-bold text-primary-foreground">
                {s.step}
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 gradient-hero">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-display font-bold text-hero-foreground">Ready to Start Earning?</h2>
        <p className="mt-3 text-hero-muted">Join our growing network of healthcare technology partners.</p>
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/contact">Apply for the Program <ArrowRight className="ml-1" size={16} /></Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Affiliate;
