import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, CheckCircle2 } from "lucide-react";

const regions = [
  {
    name: "North America",
    countries: ["United States", "Canada"],
    regulations: ["HIPAA", "HITECH Act", "PIPEDA", "21st Century Cures"],
    features: ["CMS quality reporting", "Medicare/Medicaid optimization", "State-level compliance", "ONC certification support"],
  },
  {
    name: "Europe",
    countries: ["UK", "Germany", "France", "Netherlands"],
    regulations: ["GDPR", "EU MDR", "NHS Digital Standards", "DiGA"],
    features: ["Cross-border data transfers", "eHealth network compliance", "NHS integration", "Multi-language support"],
  },
  {
    name: "Middle East & Africa",
    countries: ["UAE", "Saudi Arabia", "South Africa", "Kenya"],
    regulations: ["DHA Standards", "NHRA", "POPIA", "Saudi PDPL"],
    features: ["Arabic language support", "Vision 2030 alignment", "JCI accreditation support", "Local hosting options"],
  },
  {
    name: "Asia Pacific",
    countries: ["India", "Singapore", "Australia", "Japan"],
    regulations: ["PDPA", "DISHA", "My Health Records Act", "APPI"],
    features: ["ABDM integration (India)", "NEHTA compliance", "Multi-currency billing", "Regional data residency"],
  },
  {
    name: "Latin America",
    countries: ["Brazil", "Mexico", "Colombia", "Argentina"],
    regulations: ["LGPD", "NOM Standards", "Ley 1581", "PNDP"],
    features: ["SUS integration (Brazil)", "COFEPRIS compliance", "Spanish/Portuguese support", "Local payment processing"],
  },
];

const Solutions = () => (
  <div>
    <section className="gradient-hero py-24">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Global Solutions</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold text-hero-foreground">
            Tailored for Every Region
          </h1>
          <p className="mt-4 text-hero-muted text-lg">
            Healthcare regulations differ by country. Our solutions are localized to ensure full compliance while maximizing operational efficiency.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 space-y-8">
        {regions.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="p-8 rounded-xl bg-card border border-border shadow-card"
          >
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/3">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="text-primary" size={20} />
                  <h3 className="text-xl font-display font-bold text-card-foreground">{r.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{r.countries.join(" · ")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.regulations.map((reg) => (
                    <span key={reg} className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                      {reg}
                    </span>
                  ))}
                </div>
              </div>
              <div className="lg:w-2/3">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {r.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="text-accent shrink-0" size={16} />
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

    <section className="py-16 gradient-hero">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-display font-bold text-hero-foreground">Don't See Your Country?</h2>
        <p className="mt-3 text-hero-muted">We're expanding globally. Contact us for custom regional solutions.</p>
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/contact">Contact Us <ArrowRight className="ml-1" size={16} /></Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Solutions;
