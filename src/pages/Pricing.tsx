import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2, Rocket, Building2, Globe } from "lucide-react";
import SEO from "@/components/SEO";

const partnerships = [
  {
    name: "Pilot Program",
    icon: Rocket,
    desc: "For hospitals and clinics ready to be early adopters of AI-driven healthcare solutions.",
    featured: true,
    benefits: [
      "Tailored AI solution for your facility",
      "Dedicated onboarding & support",
      "Co-develop features with our team",
      "Preferential pricing at scale",
      "Direct input into our product roadmap",
      "Case study & joint PR opportunities",
    ],
    cta: "Apply for Pilot",
  },
  {
    name: "Strategic Partnership",
    icon: Building2,
    desc: "For healthcare networks, technology companies, and consultancies looking to integrate or resell our solutions.",
    featured: false,
    benefits: [
      "White-label & integration options",
      "Revenue sharing model",
      "Co-branded marketing materials",
      "Technical integration support",
      "Quarterly business reviews",
    ],
    cta: "Explore Partnership",
  },
  {
    name: "Investment & Advisory",
    icon: Globe,
    desc: "For investors, healthcare leaders, and domain experts who want to shape the future of healthcare AI.",
    featured: false,
    benefits: [
      "Early-stage investment opportunity",
      "Board or advisory positions",
      "Shape product & market strategy",
      "Access to proprietary AI research",
      "Global healthcare market exposure",
    ],
    cta: "Start a Conversation",
  },
];

const Pricing = () => (
  <div>
    <SEO title="Collaborate With Us — DATAelixAIr" description="Partner with DATAelixAIr through pilot programs, strategic investment, or advisory roles. Shape the future of healthcare AI together." />
    <section className="pt-32 pb-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl mx-auto">
         <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Collaborate With Us</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Shape the Future of <em className="not-italic text-primary">Healthcare AI</em> — Together
          </h1>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed">
            We believe the best solutions are built through partnership. Whether you're a hospital ready to pilot, a strategic collaborator, or an investor with vision — there's a seat at the table for you.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {partnerships.map((p, i) => (
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
                  Early Adopters Welcome
                </div>
              )}
              <div className="w-[52px] h-[52px] rounded-[14px] teal-muted-bg teal-muted-border border flex items-center justify-center mb-5">
                <p.icon className="text-primary" size={24} />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">{p.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground font-light leading-relaxed">{p.desc}</p>
              <ul className="mt-6 space-y-3">
                {p.benefits.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="text-primary shrink-0" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={p.featured ? "default" : "outline"} className="w-full mt-8" asChild>
                <Link to="/contact">{p.cta} →</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Why partner early */}
    <section className="bg-dark py-20">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <h2 className="font-display text-3xl font-bold text-dark-foreground">Why Partner Early?</h2>
        <p className="mt-4 text-dark-muted font-light leading-relaxed">
          Early partners get dedicated attention, custom-built solutions, and the opportunity to shape a platform that will serve healthcare facilities worldwide. Your input directly influences our product roadmap.
        </p>
        <Button variant="default" size="lg" className="mt-8" asChild>
          <Link to="/contact">Let's Talk →</Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Pricing;
