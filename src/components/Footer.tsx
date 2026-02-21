import { Link } from "react-router-dom";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { useConsent } from "@/contexts/ConsentContext";

const Footer = () => {
  const { reopenBanner } = useConsent();

  return (
    <footer className="bg-dark border-t border-border/10">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-5 mb-6">
          <Link to="/" className="flex items-center gap-1.5 font-display font-extrabold text-xl">
            <img src={brainLogo} alt="DATAelixAIr" className="h-7 w-7 object-contain -mr-0.5" />
            <span>
              <span className="text-primary">DATA</span>
              <span className="text-dark-foreground">elix</span>
              <span className="text-primary">AI</span>
              <span className="text-dark-foreground">r</span>
            </span>
          </Link>
          <div className="flex gap-7 flex-wrap justify-center">
            {[
              { label: "About", to: "/#about" },
              { label: "Services", to: "/services" },
              { label: "Blog", to: "/blog" },
              { label: "Contact", to: "/contact" },
              { label: "Privacy Policy", to: "/privacy" },
              { label: "Terms of Use", to: "/terms" },
            ].map((l) => (
              <Link key={l.label} to={l.to} className="text-xs text-dark-muted hover:text-primary transition-colors">
                {l.label}
              </Link>
            ))}
            <button onClick={reopenBanner} className="text-xs text-dark-muted hover:text-primary transition-colors">
              Cookie Settings
            </button>
          </div>
        </div>

        {/* Healthcare disclaimer */}
        <div className="border-t border-border/10 pt-5 text-center space-y-2">
          <p className="text-[0.65rem] text-dark-muted/60 leading-relaxed">
            Not for emergency use. For registered healthcare professionals only.
          </p>
          <p className="text-[0.65rem] text-dark-muted/60">
            Serving Hyderabad clinics &amp; healthcare institutions worldwide.
          </p>
          <p className="text-xs text-dark-muted/40">
            © {new Date().getFullYear()} Elixair. All rights reserved. | <a href="mailto:raviteja.nvr@elixair.uk" className="hover:text-primary transition-colors">raviteja.nvr@elixair.uk</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
