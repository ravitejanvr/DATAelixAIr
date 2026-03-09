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
  doctorDesignation: "MBBS, MD (Gen Medicine)",
  doctorLicense: "AP-12345",
  clinicLocation: "Banjara Hills, Hyderabad – 500034",
  clinicPhone: "+91 40 2335 4567",
  clinicEmail: "contact@saikrishnaclinic.in",

  patientName: "Rajesh Kumar",
  patientAge: 45,
  patientGender: "Male",
  patientPhone: "+91 98765 43210",
  patientId: "PAT-00234",

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

  chiefComplaint: "Persistent headache and dizziness for 3 days, associated with nausea",
  symptoms: "Throbbing headache predominantly frontal, worsens in the morning. Mild vertigo on standing. No visual disturbances. Occasional nausea without vomiting. Sleep disturbed for 2 nights.",
  findings: "BP elevated at 140/90 mmHg. No papilledema on fundoscopy. Cranial nerves intact. No neck stiffness. Cardiovascular exam — S1 S2 normal, no murmurs. Mild tenderness over frontal sinuses.",
  diagnosis: "1. Essential Hypertension (newly detected)\n2. Tension-type headache\n3. Rule out sinusitis",
  plan: "1. Start Amlodipine 5mg OD\n2. Tab. Paracetamol 500mg SOS for headache\n3. Investigate for secondary causes of hypertension\n4. BP monitoring at home\n5. Revisit if symptoms persist after 5 days",

  prescriptions: [
    { drug_name: "Amlodipine", dosage: "5mg", frequency: "OD (morning)", duration: "30 days", route: "oral", instructions: "Take on empty stomach" },
    { drug_name: "Paracetamol", dosage: "500mg", frequency: "SOS", duration: "5 days", route: "oral", instructions: "Max 3 tablets per day" },
    { drug_name: "Pantoprazole", dosage: "40mg", frequency: "OD (before breakfast)", duration: "14 days", route: "oral" },
    { drug_name: "Cetirizine", dosage: "10mg", frequency: "HS", duration: "5 days", route: "oral", instructions: "Take at bedtime" },
  ],

  labOrders: [
    { test_name: "Complete Blood Count (CBC)", priority: "routine" },
    { test_name: "Serum Creatinine", priority: "routine" },
    { test_name: "Fasting Lipid Profile", priority: "routine" },
    { test_name: "Fasting Blood Sugar + HbA1c", priority: "urgent", notes: "Elevated RBS noted" },
    { test_name: "Thyroid Profile (T3, T4, TSH)", priority: "routine" },
    { test_name: "Urine Routine Microscopy", priority: "routine" },
  ],

  advice: [
    "Reduce salt intake to less than 5g per day",
    "Walk 30 minutes daily (morning preferred)",
    "Monitor BP at home twice daily and maintain a log",
    "Avoid smoking and alcohol",
    "Ensure 7-8 hours of sleep",
    "Return immediately if severe headache, blurred vision, or chest pain occurs",
  ],

  followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  followUpInstructions: "Review with BP log and lab reports. Bring all previous reports if available.",

  signatureText: "Dr. Priya Sharma",
  consultationDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  consultationId: "DEMO-RPT-001",
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

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const langSuffix = language !== "english" ? `_${language}` : "";
      pdf.save(`DATAelixAIr_Report_${DEMO_DATA.patientName.replace(/\s/g, "_")}${langSuffix}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  return (
    <>
      <SEO title="Report Preview — DATAelixAIr" description="Consultation report preview" />

      {/* Action bar — hidden during print */}
      <div className="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          {/* Language Toggle */}
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
                {translating && language !== opt.key && opt.key !== "english" ? null : null}
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
