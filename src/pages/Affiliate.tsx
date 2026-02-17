import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { DollarSign, Users, TrendingUp, Globe, CheckCircle2 } from "lucide-react";

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

const steps = [
  { step: "01", title: "Apply", desc: "Fill out the partner application form. We'll review and get back within 48 hours." },
  { step: "02", title: "Onboard", desc: "Get access to the partner portal, marketing materials, and sales training." },
  { step: "03", title: "Refer", desc: "Share your unique referral link or introduce prospects directly to our sales team." },
  { step: "04", title: "Earn", desc: "Receive commissions on closed deals, with bonuses for renewals and upsells." },
];

const Affiliate = () => (
  <div>
    <section className="pt-32 pb-24 bg-dark">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary-light mb-3.5">Affiliate & Partner Program</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-dark-foreground">
            Earn While Transforming <em className="not-italic text-primary">Healthcare</em>
          </h1>
          <p className="mt-5 text-dark-muted font-light leading-relaxed">
            Join our affiliate program and earn recurring commissions by referring hospitals and clinics to DATAelixAIr.
          </p>
          <Button variant="default" size="lg" className="mt-8" asChild>
            <Link to="/contact">Apply Now →</Link>
          </Button>
        </motion.div>
      </div>
    </section>

    {/* Benefits */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-3xl font-bold text-foreground text-center mb-16">Why Partner With Us?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="border border-border rounded-[20px] p-8 bg-card text-center hover:border-primary hover:-translate-y-1 hover:shadow-card-hover transition-all"
            >
              <div className="w-[52px] h-[52px] rounded-[14px] teal-muted-bg teal-muted-border border flex items-center justify-center mx-auto mb-5">
                <b.icon className="text-primary" size={24} />
              </div>
              <h3 className="font-display font-bold text-foreground">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground font-light">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Tiers */}
    <section className="py-24 bg-muted">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-3xl font-bold text-foreground text-center mb-4">Commission Tiers</h2>
        <p className="text-center text-muted-foreground mb-16">The more you refer, the more you earn.</p>
        <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-[20px] p-9 border ${
                i === 2 ? "bg-card border-primary shadow-card-hover" : "bg-card border-border shadow-card"
              }`}
            >
              <h3 className="font-display font-bold text-lg text-foreground">{t.name}</h3>
              <div className="mt-3 font-display text-4xl font-bold text-primary">{t.commission}</div>
              <p className="text-xs text-muted-foreground mt-1">{t.requirement}</p>
              <ul className="mt-6 space-y-2">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="text-primary shrink-0" size={14} />
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
        <h2 className="font-display text-3xl font-bold text-foreground text-center mb-16">How It Works</h2>
        <div className="space-y-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-6 items-start"
            >
              <div className="w-12 h-12 rounded-full gradient-teal flex items-center justify-center shrink-0 text-sm font-bold text-primary-foreground">
                {s.step}
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground font-light mt-1">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-dark py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-display text-3xl font-bold text-dark-foreground">Ready to Start Earning?</h2>
        <p className="mt-3 text-dark-muted">Join our growing network of healthcare technology partners.</p>
        <Button variant="default" size="lg" className="mt-6" asChild>
          <Link to="/contact">Apply for the Program →</Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Affiliate;
