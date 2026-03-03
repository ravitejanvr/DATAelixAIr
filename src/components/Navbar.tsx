import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { AnimatePresence, motion } from "framer-motion";

const navLinks = [
  { label: "Product", path: "/", hash: "#product" },
  { label: "Security", path: "/", hash: "#security" },
  { label: "Vision", path: "/vision", hash: "" },
  { label: "Blog", path: "/blog", hash: "" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = useCallback((link: typeof navLinks[0]) => {
    setOpen(false);
    if (link.hash) {
      if (location.pathname === link.path) {
        document.querySelector(link.hash)?.scrollIntoView({ behavior: "smooth" });
      } else {
        navigate(link.path);
        setTimeout(() => {
          document.querySelector(link.hash)?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }
    } else {
      if (location.pathname === link.path) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate(link.path);
      }
    }
  }, [location.pathname, navigate]);

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
            <button
              key={link.label}
              onClick={() => handleNavClick(link)}
              className={`text-sm font-medium tracking-wide transition-colors bg-transparent border-none cursor-pointer ${
                location.pathname === link.path && !link.hash
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="default" size="sm" asChild>
            <Link to="/onboard">Request Pilot</Link>
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
                <button
                  key={link.label}
                  onClick={() => handleNavClick(link)}
                  className="font-display text-2xl font-bold py-3 border-b border-border text-foreground hover:text-primary transition-colors bg-transparent w-full text-left cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
              <Button variant="default" className="mt-4" asChild>
                <Link to="/onboard" onClick={() => setOpen(false)}>Request Pilot →</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
