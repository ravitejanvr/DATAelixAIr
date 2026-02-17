import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="gradient-hero border-t border-primary/10">
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <span className="text-xl font-display font-bold gradient-text">DATAelixAIr</span>
          <p className="mt-4 text-sm text-hero-muted leading-relaxed">
            Transforming healthcare operations worldwide with AI-powered data solutions, tailored compliance, and interoperability.
          </p>
        </div>
        <div>
          <h4 className="font-display font-semibold text-hero-foreground mb-4">Services</h4>
          <ul className="space-y-2 text-sm text-hero-muted">
            <li><Link to="/services" className="hover:text-primary transition-colors">Revenue Optimization</Link></li>
            <li><Link to="/services" className="hover:text-primary transition-colors">Regulatory Compliance</Link></li>
            <li><Link to="/services" className="hover:text-primary transition-colors">Data Interoperability</Link></li>
            <li><Link to="/services" className="hover:text-primary transition-colors">Cybersecurity</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold text-hero-foreground mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-hero-muted">
            <li><Link to="/solutions" className="hover:text-primary transition-colors">Global Solutions</Link></li>
            <li><Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
            <li><Link to="/affiliate" className="hover:text-primary transition-colors">Affiliate Program</Link></li>
            <li><Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold text-hero-foreground mb-4">Compliance</h4>
          <ul className="space-y-2 text-sm text-hero-muted">
            <li>HIPAA Certified</li>
            <li>GDPR Compliant</li>
            <li>ISO 27001</li>
            <li>SOC 2 Type II</li>
          </ul>
        </div>
      </div>
      <div className="mt-12 pt-8 border-t border-primary/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-hero-muted">&copy; {new Date().getFullYear()} DATAelixAIr. All rights reserved.</p>
        <div className="flex gap-6 text-xs text-hero-muted">
          <span className="hover:text-primary cursor-pointer transition-colors">Privacy Policy</span>
          <span className="hover:text-primary cursor-pointer transition-colors">Terms of Service</span>
          <span className="hover:text-primary cursor-pointer transition-colors">Cookie Policy</span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
