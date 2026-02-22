import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { AnimatePresence, motion } from "framer-motion";

const navLinks = [
  { label: "About", path: "/#about" },
  { label: "Services", path: "/services" },
  { label: "Solutions", path: "/solutions" },
  { label: "Partner", path: "/pricing" },
  { label: "Blog", path: "/blog" },
  
  { label: "Contact", path: "/contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 glass-nav border-b border-border transition-shadow ${scrolled ? "shadow-md" : ""}`}>
      <div className="container mx-auto flex items-center justify-between h-[68px] px-4">
        <Link to="/" className="flex items-center gap-1.5 font-display font-extrabold text-xl tracking-tight">
          <img src={brainLogo} alt="DATAelixAIr" className="h-7 w-7 object-contain -mr-0.5" />
          <span>
            <span className="text-primary">DATA</span>
            <span className="text-foreground">elix</span>
            <span className="text-primary">AI</span>
            <span className="text-foreground">r</span>
            <sup className="text-[0.5em] text-muted-foreground">™</sup>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-9">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-medium tracking-wide transition-colors ${
                location.pathname === link.path
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">Clinical Platform</Link>
          </Button>
          <Button variant="dark" size="sm" asChild>
            <Link to="/contact">Partner With Us</Link>
          </Button>
        </div>

        {/* Mobile */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-t border-border"
          >
            <div className="flex flex-col p-6 gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setOpen(false)}
                  className="font-display text-2xl font-bold py-3 border-b border-border text-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/dashboard" onClick={() => setOpen(false)}>Clinical Platform</Link>
              </Button>
              <Button variant="default" className="mt-2" asChild>
                <Link to="/contact" onClick={() => setOpen(false)}>Partner With Us →</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
