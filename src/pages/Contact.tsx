import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    toast({ title: "Request received!", description: "Our team will contact you within 24 hours." });
  };

  return (
    <div>
      <section className="gradient-hero py-24">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Contact Us</span>
            <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold text-hero-foreground">
              Let's Transform Your Operations
            </h1>
            <p className="mt-4 text-hero-muted text-lg">
              Schedule a demo, request a proposal, or ask us anything about how DATAelixAIr can help your organization.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 max-w-5xl mx-auto">
            {/* Form */}
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              {submitted ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-xl bg-card border border-border shadow-card">
                  <CheckCircle2 className="text-accent mb-4" size={48} />
                  <h3 className="text-2xl font-display font-bold text-card-foreground">Thank You!</h3>
                  <p className="mt-2 text-muted-foreground">Our team will reach out within 24 hours to discuss your needs.</p>
                  <Button variant="default" className="mt-6" onClick={() => setSubmitted(false)}>Submit Another Request</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="text-xl font-display font-bold text-foreground mb-2">Book a Demo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">First Name</label>
                      <Input required placeholder="John" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Last Name</label>
                      <Input required placeholder="Smith" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Work Email</label>
                    <Input required type="email" placeholder="john@hospital.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Organization</label>
                    <Input required placeholder="Hospital / Clinic Name" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Country</label>
                    <Input required placeholder="Your country" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">How can we help?</label>
                    <Textarea required placeholder="Tell us about your challenges..." rows={4} />
                  </div>
                  <Button variant="hero" size="lg" type="submit" className="w-full">
                    <Send className="mr-2" size={16} /> Send Request
                  </Button>
                </form>
              )}
            </motion.div>

            {/* Info */}
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-8">
              <div>
                <h3 className="text-xl font-display font-bold text-foreground mb-6">Get in Touch</h3>
                <div className="space-y-5">
                  {[
                    { icon: Mail, label: "Email", value: "contact@dataelixair.com" },
                    { icon: Phone, label: "Phone", value: "+1 (888) 555-DATA" },
                    { icon: MapPin, label: "Headquarters", value: "San Francisco, CA, USA" },
                  ].map((c) => (
                    <div key={c.label} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                        <c.icon className="text-primary-foreground" size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.label}</p>
                        <p className="text-sm text-muted-foreground">{c.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border shadow-card">
                <h4 className="font-display font-semibold text-card-foreground mb-3">Global Offices</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>🇺🇸 San Francisco, USA</li>
                  <li>🇬🇧 London, United Kingdom</li>
                  <li>🇦🇪 Dubai, UAE</li>
                  <li>🇸🇬 Singapore</li>
                  <li>🇮🇳 Mumbai, India</li>
                </ul>
              </div>

              <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
                <h4 className="font-display font-semibold text-foreground mb-2">Enterprise Sales</h4>
                <p className="text-sm text-muted-foreground">
                  For health systems with 10+ facilities, contact our enterprise team for custom pricing and deployment options.
                </p>
                <p className="text-sm text-primary font-medium mt-2">enterprise@dataelixair.com</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
