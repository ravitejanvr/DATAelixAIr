import { Link } from "react-router-dom";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { useConsent } from "@/contexts/ConsentContext";
import { Linkedin } from "lucide-react";

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
              <sup className="text-[0.5em] text-dark-muted">™</sup>
            </span>
          </Link>
          <div className="flex gap-7 flex-wrap justify-center">
            {[
              { label: "Home", to: "/" },
              { label: "Product", to: "/#product" },
              { label: "Vision", to: "/vision" },
              { label: "Research", to: "/blog" },
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
          <div className="flex gap-4">
            <a href="https://www.linkedin.com/company/107182001/admin/dashboard/" target="_blank" rel="noopener noreferrer" className="text-dark-muted hover:text-primary transition-colors" aria-label="LinkedIn">
              <Linkedin size={18} />
            </a>
            <a href="https://x.com/dataelixair" target="_blank" rel="noopener noreferrer" className="text-dark-muted hover:text-primary transition-colors" aria-label="X">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="border-t border-border/10 pt-5 text-center space-y-2">
          <p className="text-[0.65rem] text-dark-muted/60 leading-relaxed">
            Not for emergency use. For registered healthcare professionals only.
          </p>
          <p className="text-xs text-dark-muted/40">
            © {new Date().getFullYear()} DATAelixAIr™. All rights reserved. | <a href="mailto:raviteja.nvr@elixair.uk" className="hover:text-primary transition-colors">raviteja.nvr@elixair.uk</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
