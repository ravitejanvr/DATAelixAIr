import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="bg-dark border-t border-border/10">
    <div className="container mx-auto px-4 py-10 flex flex-col md:flex-row justify-between items-center gap-5">
      <Link to="/" className="font-display font-extrabold text-xl text-dark-foreground">
        DATA<span className="text-primary">elix</span>AIr
      </Link>
      <div className="flex gap-7 flex-wrap justify-center">
        {["About", "Services", "Contact", "Privacy Policy", "Terms"].map((l) => (
          <Link
            key={l}
            to={l === "About" ? "/#about" : l === "Privacy Policy" || l === "Terms" ? "#" : `/${l.toLowerCase()}`}
            className="text-xs text-dark-muted hover:text-primary transition-colors"
          >
            {l}
          </Link>
        ))}
      </div>
      <p className="text-xs text-dark-muted/40">© {new Date().getFullYear()} DATAelixAIr. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
