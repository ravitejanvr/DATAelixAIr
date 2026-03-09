import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import ConsultationReport, { type ReportData } from "@/components/ConsultationReport";
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
  adviceTelugu: [
    "రోజుకు 5 గ్రాములకు తక్కువగా ఉప్పు తీసుకోండి",
    "రోజూ 30 నిమిషాలు నడవండి (ఉదయం మంచిది)",
    "ఇంట్లో రోజుకు రెండుసార్లు BP చెక్ చేసుకోండి",
    "తీవ్రమైన తలనొప్పి, మసకబారిన దృష్టి లేదా ఛాతీ నొప్పి వస్తే వెంటనే రండి",
  ],
  adviceHindi: [
    "रोज़ाना 5 ग्राम से कम नमक लें",
    "रोज़ 30 मिनट पैदल चलें (सुबह बेहतर)",
    "घर पर दिन में दो बार BP जाँचें और रिकॉर्ड रखें",
    "तेज सिरदर्द, धुंधली दृष्टि या सीने में दर्द हो तो तुरंत आएं",
  ],

  followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  followUpInstructions: "Review with BP log and lab reports. Bring all previous reports if available.",

  signatureText: "Dr. Priya Sharma",
  consultationDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  consultationId: "DEMO-RPT-001",
};

export default function ReportPreview() {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

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
      pdf.save(`DATAelixAIr_Demo_Report_${DEMO_DATA.patientName.replace(/\s/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  return (
    <>
      <SEO title="Report Preview — DATAelixAIr" description="Consultation report preview" />

      {/* Action bar — hidden during print */}
      <div className="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button size="sm" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-1" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Report */}
      <div className="bg-muted/30 py-8 print:py-0 print:bg-white min-h-screen">
        <ConsultationReport ref={reportRef} data={DEMO_DATA} />
      </div>
    </>
  );
}
