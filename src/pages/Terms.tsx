import SEO from "@/components/SEO";

const Terms = () => (
  <div className="container mx-auto px-4 py-24 max-w-3xl">
    <SEO title="Terms of Use — DATAelixAIr" description="Terms and conditions for using DATAelixAIr's healthcare AI platform." />
    <h1 className="font-display text-3xl font-extrabold text-foreground mb-8">Terms of Use</h1>
    <p className="text-xs text-muted-foreground mb-8">Last updated: February 2026</p>

    <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">1. Eligibility</h2>
        <p className="text-sm text-muted-foreground">
          DATAelixAIr services are intended for <strong className="text-foreground">registered healthcare professionals</strong> and authorised institutional representatives only. By using our platform, you confirm you hold valid medical registration (e.g., MCI/NMC, GMC) or are acting on behalf of a registered healthcare institution.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">2. Not Medical Advice</h2>
        <p className="text-sm text-muted-foreground">
          Our AI tools assist with administrative and analytical tasks. They do <strong className="text-foreground">not</strong> provide medical advice, diagnoses, or treatment recommendations. All clinical decisions remain the sole responsibility of the treating physician.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">3. No Emergency Use</h2>
        <p className="text-sm text-muted-foreground">
          DATAelixAIr is <strong className="text-foreground">not designed for emergency or life-threatening situations.</strong> In an emergency, contact your local emergency services immediately.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">4. Beta Software</h2>
        <p className="text-sm text-muted-foreground">
          Certain features may be in beta or early access. Beta features are provided "as is" without warranty. We appreciate your feedback and patience as we continuously improve.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">5. Limitation of Liability</h2>
        <p className="text-sm text-muted-foreground">
          To the maximum extent permitted by law, DATAelixAIr's total liability is limited to the subscription fees paid by you in the 12 months preceding any claim. We are not liable for indirect, incidental, or consequential damages.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">6. Acceptable Use</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Do not upload real patient data to demo or trial environments</li>
          <li>Do not attempt to reverse-engineer or misuse AI models</li>
          <li>Comply with all applicable healthcare regulations in your jurisdiction</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">7. Governing Law</h2>
        <p className="text-sm text-muted-foreground">
          These terms are governed by the laws of the United Kingdom. For Indian users, disputes shall be subject to Indian arbitration law where applicable.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-foreground mb-3">8. Contact</h2>
        <p className="text-sm text-muted-foreground">
          Questions about these terms? Contact us at{" "}
          <a href="mailto:raviteja.nvr@elixair.uk" className="text-primary hover:underline">raviteja.nvr@elixair.uk</a>
        </p>
      </section>
    </div>
  </div>
);

export default Terms;
