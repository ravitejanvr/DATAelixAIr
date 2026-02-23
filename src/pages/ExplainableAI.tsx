import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import {
  Brain, BarChart3, Shield, Eye, Scale, AlertTriangle, CheckCircle2,
  Lightbulb, BookOpen, ArrowRight, Layers, Target, Users, FileText
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

const explainabilityMethods = [
  {
    title: "LIME (Local Interpretable Model-agnostic Explanations)",
    icon: Eye,
    description: "Explains individual predictions by perturbing input features and observing how predictions change. Creates a simple, interpretable local surrogate model.",
    useCase: "Why did the CDSS flag this patient as high-risk for retinopathy?",
    methodology: [
      "Perturb patient features (age, HbA1c, duration) around the instance",
      "Observe prediction changes for each perturbation",
      "Fit a weighted linear model to approximate the local decision boundary",
      "Rank features by their contribution to the prediction",
    ],
    tags: ["Local Explanations", "Feature Importance", "Model-Agnostic"],
  },
  {
    title: "SHAP (SHapley Additive exPlanations)",
    icon: BarChart3,
    description: "Based on Shapley values from cooperative game theory. Provides consistent, theoretically grounded feature attribution for each prediction.",
    useCase: "What factors contributed most to the drug recommendation for this patient?",
    methodology: [
      "Compute marginal contribution of each feature across all possible coalitions",
      "Generate SHAP values showing positive/negative impact of each feature",
      "Aggregate across patients for global feature importance",
      "Visualise with waterfall, force, and beeswarm plots",
    ],
    tags: ["Shapley Values", "Global + Local", "Theoretically Grounded"],
  },
];

const fairnessFramework = [
  {
    title: "Demographic Parity",
    icon: Users,
    description: "Ensures prediction rates are equal across protected groups (age, gender, ethnicity). Monitors for disparate impact in risk scores and drug recommendations.",
    metric: "P(Ŷ=1|A=a) = P(Ŷ=1|A=b) for all groups a, b",
  },
  {
    title: "Equalised Odds",
    icon: Scale,
    description: "True positive and false positive rates should be similar across demographic groups. Critical for equitable diagnostic accuracy.",
    metric: "P(Ŷ=1|Y=y,A=a) = P(Ŷ=1|Y=y,A=b) for y ∈ {0,1}",
  },
  {
    title: "Calibration Across Groups",
    icon: Target,
    description: "When the model says 70% risk, it should be correct ~70% of the time for ALL patient subgroups, not just the majority population.",
    metric: "P(Y=1|Ŷ=p,A=a) ≈ p for all groups a",
  },
  {
    title: "Individual Fairness",
    icon: Shield,
    description: "Similar patients should receive similar predictions regardless of protected attributes. Uses clinical similarity metrics for validation.",
    metric: "d(f(x), f(x')) ≤ L·d(x, x') for similar patients x, x'",
  },
];

const ethicsChecklist = [
  { label: "Informed Consent", desc: "Patients are informed that AI assists in clinical decisions" },
  { label: "Human-in-the-Loop", desc: "All AI outputs require clinician review before action" },
  { label: "Transparency", desc: "Every recommendation shows reasoning, evidence, and confidence" },
  { label: "Right to Explanation", desc: "Patients can request plain-language explanations of AI decisions" },
  { label: "Bias Auditing", desc: "Regular fairness audits across demographic groups" },
  { label: "Data Minimisation", desc: "Only clinically necessary data is collected and processed" },
  { label: "Audit Trail", desc: "Complete logging of AI inputs, outputs, and clinician overrides" },
  { label: "Fail-Safe Design", desc: "System defaults to conservative recommendations under uncertainty" },
];

const knowledgeBases = [
  { name: "PubMed / MEDLINE", desc: "30M+ biomedical citations from NLM", status: "integrated" },
  { name: "Europe PMC", desc: "37M+ life science articles, open access", status: "integrated" },
  { name: "RxNorm (NLM)", desc: "Drug name normalisation & interaction API", status: "integrated" },
  { name: "IP / BP / USP", desc: "Indian, British & US Pharmacopoeia references", status: "planned" },
  { name: "WHO ATC Classification", desc: "Drug classification and DDD system", status: "planned" },
  { name: "ICD-11 (WHO)", desc: "International Classification of Diseases", status: "integrated" },
  { name: "SNOMED CT", desc: "Clinical terminology for EHR interoperability", status: "planned" },
  { name: "OpenFDA", desc: "US FDA drug adverse events and labels", status: "planned" },
  { name: "DrugBank Open", desc: "Comprehensive drug data and targets", status: "planned" },
  { name: "NICE / AHA / ESC Guidelines", desc: "Evidence-based clinical guidelines", status: "integrated" },
];

export default function ExplainableAI() {
  return (
    <>
      <SEO
        title="Explainable AI & Fairness — DATAelixAIr CDSS"
        description="LIME, SHAP explanations, fairness bias framework, and AI ethics for transparent clinical decision support"
      />

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Badge variant="outline" className="mb-4 text-xs">
              <Brain className="h-3 w-3 mr-1" /> Explainable AI Framework
            </Badge>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">
              Transparent AI You Can <span className="text-primary">Trust</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every CDSS recommendation comes with clear reasoning, evidence attribution, fairness guarantees,
              and audit trails. Built on LIME, SHAP, and principled ethics frameworks.
            </p>
          </motion.div>
        </div>
      </section>

      {/* LIME & SHAP */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-foreground mb-8 flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" /> Explainability Methods
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {explainabilityMethods.map((method, i) => (
              <motion.div key={method.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <method.icon className="h-5 w-5 text-primary" /> {method.title}
                    </CardTitle>
                    <CardDescription>{method.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs font-semibold text-primary mb-1">Clinical Example</p>
                      <p className="text-sm text-foreground italic">&quot;{method.useCase}&quot;</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Methodology</p>
                      <ol className="space-y-1.5">
                        {method.methodology.map((step, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-primary font-bold text-xs mt-0.5">{j + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {method.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Supervised / Unsupervised Learning */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-foreground mb-8 flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Learning Paradigms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supervised Learning</CardTitle>
                <CardDescription>Trained on labelled clinical datasets with known outcomes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm text-foreground">
                  <p><strong>Risk Prediction:</strong> Models trained on patient outcomes to predict complications (e.g., diabetic retinopathy from HbA1c trajectories)</p>
                  <p><strong>Drug Response:</strong> Classification of likely responders vs. non-responders based on pharmacogenomic markers</p>
                  <p><strong>Diagnostic Support:</strong> Pattern recognition from labelled clinical findings mapped to ICD codes</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">Random Forest</Badge>
                  <Badge variant="outline" className="text-xs">Gradient Boosting</Badge>
                  <Badge variant="outline" className="text-xs">Neural Networks</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Unsupervised Learning</CardTitle>
                <CardDescription>Discovers hidden patterns in unlabelled patient data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm text-foreground">
                  <p><strong>Patient Clustering:</strong> Identifies patient subgroups with similar disease progression patterns for personalised care pathways</p>
                  <p><strong>Anomaly Detection:</strong> Flags unusual lab value combinations or atypical presentations for clinical review</p>
                  <p><strong>Feature Discovery:</strong> Uncovers non-obvious correlations between lifestyle factors and outcomes</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">K-Means</Badge>
                  <Badge variant="outline" className="text-xs">DBSCAN</Badge>
                  <Badge variant="outline" className="text-xs">Autoencoders</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Fairness & Bias */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-foreground mb-2 flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" /> Fairness & Bias Framework
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl">
            Systematic bias detection and mitigation across demographic groups. Every model is validated for equitable performance.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fairnessFramework.map((item, i) => (
              <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full">
                  <CardContent className="py-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                        <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono text-foreground">{item.metric}</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ethics Checklist */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-foreground mb-8 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> AI Ethics Checklist
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ethicsChecklist.map((item, i) => (
              <motion.div key={item.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Knowledge Bases */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-foreground mb-2 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Integrated Knowledge Bases
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl">
            Our CDSS draws from the world's leading biomedical databases and pharmacopoeia for evidence-based recommendations.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {knowledgeBases.map((kb, i) => (
              <motion.div key={kb.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full">
                  <CardContent className="py-4 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{kb.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{kb.desc}</p>
                    </div>
                    <Badge
                      variant={kb.status === "integrated" ? "default" : "outline"}
                      className="text-[10px] shrink-0"
                    >
                      {kb.status === "integrated" ? "Live" : "Planned"}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-foreground mb-4">
            Experience Transparent Clinical AI
          </h2>
          <p className="text-muted-foreground mb-6">
            Try the CDSS platform and see explainable recommendations in action.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild>
              <Link to="/dashboard">
                Launch CDSS <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact">
                <FileText className="h-4 w-4 mr-1" /> Request Whitepaper
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
