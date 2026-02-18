import { Link } from "react-router-dom";
import brainLogo from "@/assets/brain-logo.png";

const Footer = () => (
  <footer className="bg-dark border-t border-border/10">
    <div className="container mx-auto px-4 py-10 flex flex-col md:flex-row justify-between items-center gap-5">
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
          { label: "Privacy Policy", to: "#" },
          { label: "Terms", to: "#" },
        ].map((l) => (
          <Link key={l.label} to={l.to} className="text-xs text-dark-muted hover:text-primary transition-colors">
            {l.label}
          </Link>
        ))}
      </div>
      <p className="text-xs text-dark-muted/40">© {new Date().getFullYear()} DATAelixAIr. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
