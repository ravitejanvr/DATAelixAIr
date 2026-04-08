import SEO from "@/components/SEO";

const Privacy = () => (
  <div className="container mx-auto px-4 py-24 max-w-3xl">
    <SEO title="Privacy Policy — DATAelixAIr™ by elixAIr" description="How elixAIr handles your data when using DATAelixAIr™, including privacy rights and compliance with DPDP and GDPR." noindex />
    <h1 className="font-display text-3xl font-extrabold text-foreground mb-8">Privacy Policy</h1>
    <p className="text-xs text-muted-foreground mb-8">Last updated: February 2026</p>

    <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">1. What We Collect</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Contact form submissions:</strong> Name, email, organisation, message</li>
          <li><strong className="text-foreground">Usage analytics:</strong> Page views, click events (IP anonymised)</li>
          <li><strong className="text-foreground">Cookie preferences:</strong> Your consent choices</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">2. What We Do NOT Collect</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Patient data or Protected Health Information (PHI)</li>
          <li>Medical records, clinical notes, or diagnoses</li>
          <li>Biometric data or sensitive personal data</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">3. Data Storage & Security</h2>
        <p className="text-sm text-muted-foreground">
          All data is stored on enterprise-grade cloud infrastructure with encryption at rest and in transit (TLS 1.3). 
          Data residency options available for India (Mumbai DC) and EU regions.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">4. Third Parties</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Stripe / Razorpay:</strong> Payment processing (PCI-DSS compliant)</li>
          <li><strong className="text-foreground">Plausible Analytics:</strong> Privacy-safe, cookieless analytics</li>
          <li>No data is sold or shared with advertisers</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">5. Your Rights (DPDP / GDPR)</h2>
        <p className="text-sm text-muted-foreground">
          You have the right to access, correct, delete, or withdraw consent for your personal data at any time. 
          Under India's DPDP Act and UK/EU GDPR, you may also request data portability and lodge complaints with supervisory authorities.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">6. Data Retention</h2>
        <p className="text-sm text-muted-foreground">
          Contact form data is retained for 24 months. Analytics data is retained for 12 months. You may request deletion at any time.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">7. Contact</h2>
        <p className="text-sm text-muted-foreground">
          For privacy inquiries, data access requests, or complaints:<br />
          <strong className="text-foreground">Email:</strong>{" "}
          <a href="mailto:raviteja.nvr@elixair.uk" className="text-primary hover:underline">raviteja.nvr@elixair.uk</a>
        </p>
      </section>
    </div>
  </div>
);

export default Privacy;
