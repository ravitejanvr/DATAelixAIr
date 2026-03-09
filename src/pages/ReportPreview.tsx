import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, Loader2, Globe } from "lucide-react";
import ConsultationReport, { type ReportData } from "@/components/ConsultationReport";
import { useReportTranslation, type ReportLanguage } from "@/hooks/useReportTranslation";
import SEO from "@/components/SEO";

const DEMO_DATA: ReportData = {
  clinicName: "Sai Krishna Multi-Speciality Clinic",
  doctorName: "Dr. Priya Sharma",
  doctorDesignation: "MBBS, MD (General Medicine)",
  doctorLicense: "AP-12345",
  clinicLocation: "Plot 24, Road No 12, Banjara Hills, Hyderabad – 500034",
  clinicPhone: "+91 40 2335 4567",
  clinicEmail: "contact@saikrishnaclinic.in",

  patientName: "Rajesh Kumar",
  patientAge: 45,
  patientGender: "Male",
  patientPhone: "+91 98765 43210",
  patientId: "PAT-2024-00234",
  visitToken: 14,
  visitType: "Walk-in",

  vitals: {
    temperature: 99.2,
    bp_systolic: 140,
    bp_diastolic: 90,
    pulse: 88,
    spo2: 97,
    weight_kg: 78,
    respiratory_rate: 18,
    blood_sugar: 145,
  },

  visitSummary:
    "45-year-old male presenting with persistent frontal headache and dizziness for 3 days, associated with morning nausea. Blood pressure found elevated at 140/90 mmHg (newly detected). Random blood sugar mildly elevated at 145 mg/dL. Clinical assessment suggests essential hypertension with tension-type headache. Started on Amlodipine 5mg and symptomatic management. Investigations ordered to rule out secondary causes and metabolic comorbidities.",

  chiefComplaint: "Persistent headache and dizziness for 3 days, associated with nausea",
  symptoms:
    "Throbbing headache predominantly frontal, worsens in the morning. Mild vertigo on standing. No visual disturbances. Occasional nausea without vomiting. Sleep disturbed for 2 nights. No chest pain, palpitations, or breathlessness. No history of head trauma.",
  findings:
    "BP elevated at 140/90 mmHg (both arms). No papilledema on fundoscopy. Cranial nerves intact. No neck stiffness. Cardiovascular exam — S1 S2 normal, no murmurs. Mild tenderness over frontal sinuses. No lymphadenopathy. Abdomen soft, non-tender.",
  diagnosis:
    "1. Essential Hypertension (newly detected — ICD: I10)\n2. Tension-type headache (ICD: G44.2)\n3. Rule out sinusitis\n4. Pre-diabetes (to confirm with HbA1c)",
  plan:
    "1. Start Tab. Amlodipine 5mg OD morning\n2. Tab. Paracetamol 500mg SOS for headache (max 3/day)\n3. Tab. Pantoprazole 40mg OD before breakfast\n4. Tab. Cetirizine 10mg HS for 5 days\n5. Home BP monitoring — record twice daily\n6. Investigate for secondary causes of hypertension\n7. Dietary counselling — low salt, DASH diet\n8. Review in 1 week with reports",

  prescriptions: [
    { drug_name: "Amlodipine", dosage: "5mg", frequency: "OD (morning)", duration: "30 days", route: "Oral", instructions: "Take on empty stomach" },
    { drug_name: "Paracetamol", dosage: "500mg", frequency: "SOS", duration: "5 days", route: "Oral", instructions: "Max 3 tablets per day. Take after food." },
    { drug_name: "Pantoprazole", dosage: "40mg", frequency: "OD (before breakfast)", duration: "14 days", route: "Oral", instructions: "Swallow whole, 30 min before first meal" },
    { drug_name: "Cetirizine", dosage: "10mg", frequency: "HS (bedtime)", duration: "5 days", route: "Oral", instructions: "May cause drowsiness" },
  ],

  labOrders: [
    { test_name: "Complete Blood Count (CBC)", priority: "routine", notes: "Baseline screening" },
    { test_name: "Serum Creatinine + eGFR", priority: "routine", notes: "Renal function baseline" },
    { test_name: "Fasting Lipid Profile", priority: "routine", notes: "Cardiovascular risk assessment" },
    { test_name: "Fasting Blood Sugar + HbA1c", priority: "urgent", notes: "RBS 145 — confirm pre-diabetes" },
    { test_name: "Thyroid Profile (T3, T4, TSH)", priority: "routine", notes: "Rule out secondary hypertension" },
    { test_name: "Urine Routine & Microscopy", priority: "routine", notes: "Proteinuria screening" },
    { test_name: "Serum Electrolytes (Na/K)", priority: "routine", notes: "Pre-treatment baseline" },
  ],

  advice: [
    "Reduce salt intake to less than 5g per day — avoid pickles, papads, and processed food",
    "Walk briskly for 30 minutes daily, preferably in the morning",
    "Monitor BP at home twice daily (morning + evening) — maintain a written log",
    "Avoid smoking and limit alcohol consumption",
    "Ensure 7–8 hours of uninterrupted sleep",
    "Take medications as prescribed — do not stop without consulting your doctor",
    "Drink 2–3 litres of water daily",
    "Return immediately if severe headache, blurred vision, chest pain, or breathlessness occurs",
  ],

  followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  followUpInstructions:
    "Review in 1 week with BP log and all lab reports. Bring previous medical records if available. Fasting required for blood sugar and lipid profile tests.",

  signatureText: "Dr. Priya Sharma",
  consultationDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  consultationTime: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  consultationId: "DEMO-RPT-2024-001",
};

const LANG_OPTIONS: { key: ReportLanguage; label: string; nativeLabel: string }[] = [
  { key: "english", label: "English", nativeLabel: "English" },
  { key: "telugu", label: "Telugu", nativeLabel: "తెలుగు" },
  { key: "hindi", label: "Hindi", nativeLabel: "हिंदी" },
];

export default function ReportPreview() {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, translating, getTranslatedFields } = useReportTranslation();

  const translatableFields = {
    visitSummary: DEMO_DATA.visitSummary,
    chiefComplaint: DEMO_DATA.chiefComplaint,
    symptoms: DEMO_DATA.symptoms,
    findings: DEMO_DATA.findings,
    diagnosis: DEMO_DATA.diagnosis,
    plan: DEMO_DATA.plan,
    advice: DEMO_DATA.advice,
    followUpInstructions: DEMO_DATA.followUpInstructions,
  };

  const translated = getTranslatedFields(translatableFields);
  const currentLangOption = LANG_OPTIONS.find(l => l.key === language);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      if (!reportRef.current) return;

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // Handle multi-page if content exceeds one A4 page
      const pageHeight = 297;
      let position = 0;
      let remainingHeight = pdfHeight;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        remainingHeight -= pageHeight;
      }

      const langSuffix = language !== "english" ? `_${language}` : "";
      pdf.save(`DATAelixAIr_Report_${DEMO_DATA.patientName.replace(/\s/g, "_")}${langSuffix}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  return (
    <>
      <SEO title="Consultation Report — DATAelixAIr" description="AI-generated clinical consultation report" />

      {/* Action bar */}
      <div className="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          {/* Language Toggle (12) */}
          <div className="flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Language:</span>
            {LANG_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant={language === opt.key ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs px-3 rounded-full"
                disabled={translating}
                onClick={() => setLanguage(opt.key, translatableFields)}
              >
                {opt.nativeLabel}
              </Button>
            ))}
            {translating && <Loader2 className="h-4 w-4 animate-spin text-primary ml-1" />}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button size="sm" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Report */}
      <div className="bg-muted/30 py-8 print:py-0 print:bg-white min-h-screen">
        <ConsultationReport
          ref={reportRef}
          data={DEMO_DATA}
          translated={language !== "english" ? translated : undefined}
          languageLabel={currentLangOption?.label}
        />
      </div>
    </>
  );
}
