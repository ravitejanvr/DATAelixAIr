import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    toast({ title: "Message received!", description: "Our team will contact you within 24 hours." });
  };

  return (
    <div>
      <section className="bg-dark pt-32 pb-24">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary-light mb-3.5">Get in Touch</p>
            <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-dark-foreground">
              Ready to Transform Your <em className="not-italic text-primary">Healthcare Facility?</em>
            </h1>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-20 mt-16 items-start">
            {/* Contact Info */}
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-dark-muted font-light leading-relaxed mb-10">
                Whether you're a single clinic or a multi-site hospital network, our team will work with you to design a solution that fits your workflows, budget, and compliance requirements.
              </p>

              <div className="space-y-7">
                {[
                  { icon: "📧", label: "Email", value: "hello@dataelixair.com" },
                  { icon: "📞", label: "Phone", value: "+1 (800) DATA-AIR" },
                  { icon: "🌍", label: "Coverage", value: "Worldwide — 30+ Countries" },
                  { icon: "⏰", label: "Response Time", value: "Within 24 Hours" },
                ].map((c) => (
                  <div key={c.label} className="flex items-start gap-4">
                    <div className="w-[42px] h-[42px] rounded-xl teal-muted-bg border teal-muted-border flex items-center justify-center text-base shrink-0">
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-dark-muted">{c.label}</p>
                      <p className="text-sm text-dark-foreground mt-1">{c.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Form */}
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              {submitted ? (
                <div className="text-center p-10 teal-muted-bg border teal-muted-border rounded-[20px]">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="font-display text-xl font-bold text-dark-foreground">Message Received!</h3>
                  <p className="text-sm text-dark-muted mt-2">Our healthcare AI specialists will be in touch within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-[0.06em] text-dark-muted">First Name</label>
                      <input
                        required
                        placeholder="John"
                        className="bg-dark-foreground/[0.04] border border-dark-foreground/10 rounded-xl px-4 py-3.5 text-sm text-dark-foreground placeholder:text-dark-foreground/25 outline-none focus:border-primary focus:bg-primary/5 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-[0.06em] text-dark-muted">Last Name</label>
                      <input
                        required
                        placeholder="Smith"
                        className="bg-dark-foreground/[0.04] border border-dark-foreground/10 rounded-xl px-4 py-3.5 text-sm text-dark-foreground placeholder:text-dark-foreground/25 outline-none focus:border-primary focus:bg-primary/5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium uppercase tracking-[0.06em] text-dark-muted">Work Email</label>
                    <input
                      required
                      type="email"
                      placeholder="john@hospital.org"
                      className="bg-dark-foreground/[0.04] border border-dark-foreground/10 rounded-xl px-4 py-3.5 text-sm text-dark-foreground placeholder:text-dark-foreground/25 outline-none focus:border-primary focus:bg-primary/5 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium uppercase tracking-[0.06em] text-dark-muted">Organisation</label>
                    <input
                      required
                      placeholder="Hospital / Clinic Name"
                      className="bg-dark-foreground/[0.04] border border-dark-foreground/10 rounded-xl px-4 py-3.5 text-sm text-dark-foreground placeholder:text-dark-foreground/25 outline-none focus:border-primary focus:bg-primary/5 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium uppercase tracking-[0.06em] text-dark-muted">Organisation Type</label>
                    <select
                      required
                      className="bg-dark-foreground/[0.04] border border-dark-foreground/10 rounded-xl px-4 py-3.5 text-sm text-dark-foreground outline-none focus:border-primary focus:bg-primary/5 transition-all"
                    >
                      <option value="">Select type…</option>
                      <option>Hospital — Large (&gt;500 beds)</option>
                      <option>Hospital — Medium (100–500 beds)</option>
                      <option>Clinic / Outpatient Centre</option>
                      <option>Healthcare Network</option>
                      <option>Government / NHS Trust</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium uppercase tracking-[0.06em] text-dark-muted">How can we help?</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Tell us about your challenges..."
                      className="bg-dark-foreground/[0.04] border border-dark-foreground/10 rounded-xl px-4 py-3.5 text-sm text-dark-foreground placeholder:text-dark-foreground/25 outline-none focus:border-primary focus:bg-primary/5 transition-all resize-y min-h-[120px]"
                    />
                  </div>

                  <Button variant="default" size="lg" type="submit" className="self-start mt-2">
                    Send Message →
                  </Button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
