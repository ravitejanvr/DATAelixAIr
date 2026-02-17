import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const regions = [
  {
    name: "North America", countries: ["United States", "Canada"],
    regulations: ["HIPAA", "HITECH Act", "PIPEDA", "21st Century Cures"],
    features: ["CMS quality reporting", "Medicare/Medicaid optimization", "State-level compliance", "ONC certification support"],
  },
  {
    name: "Europe", countries: ["UK", "Germany", "France", "Netherlands"],
    regulations: ["GDPR", "EU MDR", "NHS Digital Standards", "DiGA"],
    features: ["Cross-border data transfers", "eHealth network compliance", "NHS integration", "Multi-language support"],
  },
  {
    name: "Middle East & Africa", countries: ["UAE", "Saudi Arabia", "South Africa", "Kenya"],
    regulations: ["DHA Standards", "NHRA", "POPIA", "Saudi PDPL"],
    features: ["Arabic language support", "Vision 2030 alignment", "JCI accreditation support", "Local hosting options"],
  },
  {
    name: "Asia Pacific", countries: ["India", "Singapore", "Australia", "Japan"],
    regulations: ["PDPA", "DISHA", "My Health Records Act", "APPI"],
    features: ["ABDM integration (India)", "NEHTA compliance", "Multi-currency billing", "Regional data residency"],
  },
  {
    name: "Latin America", countries: ["Brazil", "Mexico", "Colombia", "Argentina"],
    regulations: ["LGPD", "NOM Standards", "Ley 1581", "PNDP"],
    features: ["SUS integration (Brazil)", "COFEPRIS compliance", "Spanish/Portuguese support", "Local payment processing"],
  },
];

const Solutions = () => (
  <div>
    <section className="pt-32 pb-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Global Solutions</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            Tailored for <em className="not-italic text-primary">Every Region</em>
          </h1>
          <p className="mt-5 text-muted-foreground font-light leading-relaxed">
            Healthcare regulations differ by country. Our solutions are localized to ensure full compliance while maximizing operational efficiency.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="pb-24 bg-background">
      <div className="container mx-auto px-4 space-y-5">
        {regions.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="border border-border rounded-[20px] p-9 bg-card hover:shadow-card transition-all"
          >
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/3">
                <h3 className="font-display text-xl font-bold text-foreground">{r.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{r.countries.join(" · ")}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {r.regulations.map((reg) => (
                    <span key={reg} className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-lg teal-muted-bg teal-muted-border border text-primary">
                      {reg}
                    </span>
                  ))}
                </div>
              </div>
              <div className="lg:w-2/3">
                <ul className="grid sm:grid-cols-2 gap-3">
                  {r.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="text-primary shrink-0" size={16} />
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

    <section className="bg-dark py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-display text-3xl font-bold text-dark-foreground">Don't See Your Country?</h2>
        <p className="mt-3 text-dark-muted">We're expanding globally. Contact us for custom regional solutions.</p>
        <Button variant="default" size="lg" className="mt-6" asChild>
          <Link to="/contact">Contact Us →</Link>
        </Button>
      </div>
    </section>
  </div>
);

export default Solutions;
