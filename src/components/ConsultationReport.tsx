import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import brainLogo from "@/assets/brain-logo-nobg.png";

export interface ReportData {
  // Clinic header
  clinicName?: string;
  doctorName?: string;
  doctorDesignation?: string;
  doctorLicense?: string;
  clinicLocation?: string;
  clinicPhone?: string;
  clinicEmail?: string;

  // Patient info
  patientName: string;
  patientAge?: number | null;
  patientGender?: string | null;
  patientPhone?: string | null;
  patientId?: string;
  visitToken?: number | null;
  visitType?: string | null;

  // Vitals
  vitals?: {
    temperature?: number | null;
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    pulse?: number | null;
    spo2?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
    respiratory_rate?: number | null;
    blood_sugar?: number | null;
  };

  // Visit summary (brief narrative)
  visitSummary?: string | null;

  // SOAP
  chiefComplaint?: string | null;
  symptoms?: string | null;
  findings?: string | null;
  diagnosis?: string | null;
  plan?: string | null;

  // Prescriptions (never translated)
  prescriptions?: {
    drug_name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    route?: string;
    instructions?: string;
  }[];

  // Investigations (never translated)
  labOrders?: { test_name: string; priority?: string; notes?: string }[];

  // Advice
  advice?: string[];

  // Follow-up
  followUpDate?: string | null;
  followUpInstructions?: string | null;

  // Doctor signature
  signatureText?: string | null;

  // Meta
  consultationDate?: string;
  consultationTime?: string;
  consultationId?: string;
}

export interface ReportSectionHeadings {
  patientInformation?: string;
  visitSummary?: string;
  vitals?: string;
  consultationSummary?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  planLabel?: string;
  prescription?: string;
  investigations?: string;
  adviceLabel?: string;
  followUp?: string;
  nextVisit?: string;
  doctorSignature?: string;
  demoWatermark?: string;
}

interface TranslatedContent {
  visitSummary?: string;
  chiefComplaint?: string;
  symptoms?: string;
  findings?: string;
  diagnosis?: string;
  plan?: string;
  advice?: string[];
  followUpInstructions?: string;
  sectionHeadings?: ReportSectionHeadings;
}

interface ConsultationReportProps {
  data: ReportData;
  translated?: TranslatedContent;
  languageLabel?: string;
}

const defaultHeadings: Required<ReportSectionHeadings> = {
  patientInformation: "Patient Information",
  visitSummary: "Visit Summary",
  vitals: "Vitals",
  consultationSummary: "Clinical Notes (SOAP)",
  subjective: "S — Subjective",
  objective: "O — Objective",
  assessment: "A — Assessment / Provisional Diagnosis",
  planLabel: "P — Plan",
  prescription: "Prescription",
  investigations: "Investigations Ordered",
  adviceLabel: "Patient Instructions",
  followUp: "Follow-Up",
  nextVisit: "Next visit",
  doctorSignature: "Consulting Physician",
  demoWatermark: "Demo Report – Not for clinical use",
};

const ConsultationReport = forwardRef<HTMLDivElement, ConsultationReportProps>(
  ({ data, translated, languageLabel }, ref) => {
    const h = { ...defaultHeadings, ...translated?.sectionHeadings };
    const t = translated || {};

    const dateStr =
      data.consultationDate ||
      new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const timeStr =
      data.consultationTime ||
      new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    const reportUrl = data.consultationId
      ? `${window.location.origin}/consultation/${data.consultationId}`
      : window.location.href;

    return (
      <div
        ref={ref}
        className="w-[210mm] min-h-[297mm] mx-auto bg-white text-[#1a1a2e] font-['Inter',sans-serif] relative print:shadow-none shadow-lg"
        style={{ fontSize: "11px", lineHeight: "1.55" }}
      >
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          <p className="text-[44px] font-bold text-gray-100/80 rotate-[-35deg] whitespace-nowrap select-none" style={{ letterSpacing: "0.12em" }}>
            {h.demoWatermark}
          </p>
        </div>

        <div className="relative z-10 px-[14mm] py-[10mm]">
          {/* ═══ 1. HEADER ═══ */}
          <div className="border-b-[3px] border-[#0077b6] pb-3 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img src={brainLogo} alt="DATAelixAIr" className="h-11 w-11 print:h-9 print:w-9" />
                <div>
                  <h1 className="text-[17px] font-extrabold tracking-tight text-[#0077b6] leading-tight">
                    {data.clinicName || "Clinic Name"}
                  </h1>
                  {data.clinicLocation && (
                    <p className="text-[10px] text-gray-500 mt-0.5">{data.clinicLocation}</p>
                  )}
                  {data.clinicPhone && (
                    <p className="text-[10px] text-gray-500">
                      Ph: {data.clinicPhone}
                      {data.clinicEmail && ` · ${data.clinicEmail}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right text-[10px] text-gray-600 leading-relaxed">
                <p className="font-semibold text-[11px] text-gray-800">{data.doctorName || "Doctor"}</p>
                {data.doctorDesignation && <p>{data.doctorDesignation}</p>}
                {data.doctorLicense && <p className="text-gray-500">Reg: {data.doctorLicense}</p>}
                <div className="mt-1.5 text-[10px] text-gray-400 border-t border-gray-200 pt-1">
                  <p>Date: <span className="font-medium text-gray-700">{dateStr}</span> · Time: <span className="font-medium text-gray-700">{timeStr}</span></p>
                  {data.consultationId && <p>Report ID: <span className="font-mono">{data.consultationId}</span></p>}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ 2. PATIENT INFORMATION ═══ */}
          <div className="bg-[#f8fafc] rounded border border-gray-200 p-3 mb-4">
            <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#0077b6] mb-2">
              {h.patientInformation}
            </h2>
            <div className="grid grid-cols-4 gap-x-4 gap-y-1.5 text-[11px]">
              <Field label="Name" value={data.patientName} bold />
              <Field label="Age / Gender" value={`${data.patientAge ? `${data.patientAge}y` : "–"}${data.patientGender ? ` / ${data.patientGender}` : ""}`} />
              <Field label="Phone" value={data.patientPhone || "–"} />
              <Field label="Patient ID" value={data.patientId?.slice(0, 12) || "–"} mono />
              {data.visitToken && <Field label="Token" value={`#${data.visitToken}`} />}
              {data.visitType && <Field label="Visit Type" value={data.visitType} />}
            </div>
          </div>

          {/* ═══ 3. VISIT SUMMARY ═══ */}
          {(t.visitSummary || data.visitSummary) && (
            <div className="mb-4 p-3 bg-[#f0f9ff] border border-[#bae6fd] rounded">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#0077b6] mb-1.5">{h.visitSummary}</h2>
              <p className="text-[11px] text-gray-800 leading-relaxed">{t.visitSummary || data.visitSummary}</p>
            </div>
          )}

          {/* ═══ 4. VITALS ═══ */}
          {data.vitals && (
            <div className="mb-4">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#0077b6] mb-2">{h.vitals}</h2>
              <div className="grid grid-cols-7 gap-1">
                {[
                  { label: "Temp", value: data.vitals.temperature, unit: "°F" },
                  { label: "BP", value: (data.vitals.bp_systolic || data.vitals.bp_diastolic) ? `${data.vitals.bp_systolic || "–"}/${data.vitals.bp_diastolic || "–"}` : null, unit: "mmHg" },
                  { label: "Pulse", value: data.vitals.pulse, unit: "bpm" },
                  { label: "SpO₂", value: data.vitals.spo2, unit: "%" },
                  { label: "Weight", value: data.vitals.weight_kg, unit: "kg" },
                  { label: "RR", value: data.vitals.respiratory_rate, unit: "/min" },
                  { label: "Sugar", value: data.vitals.blood_sugar, unit: "mg/dL" },
                ].filter(v => v.value != null).map((v) => (
                  <div key={v.label} className="border border-gray-200 rounded p-2 text-center bg-white">
                    <p className="text-[8px] text-gray-400 font-semibold uppercase">{v.label}</p>
                    <p className="text-[13px] font-bold text-gray-800 mt-0.5">{v.value}</p>
                    <p className="text-[7px] text-gray-400">{v.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ 5. SOAP CLINICAL NOTES ═══ */}
          <div className="mb-4">
            <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#0077b6] mb-2 border-b border-[#0077b6]/20 pb-1">{h.consultationSummary}</h2>
            <div className="space-y-2.5">
              {(t.symptoms || data.symptoms || t.chiefComplaint || data.chiefComplaint) && (
                <SoapSection
                  label={h.subjective}
                  content={`${t.chiefComplaint || data.chiefComplaint || ""}\n${t.symptoms || data.symptoms || ""}`.trim()}
                  color="#2563eb"
                />
              )}
              {(t.findings || data.findings) && (
                <SoapSection label={h.objective} content={t.findings || data.findings!} color="#059669" />
              )}
              {(t.diagnosis || data.diagnosis) && (
                <SoapSection label={h.assessment} content={t.diagnosis || data.diagnosis!} color="#d97706" highlight />
              )}
              {(t.plan || data.plan) && (
                <SoapSection label={h.planLabel} content={t.plan || data.plan!} color="#7c3aed" />
              )}
            </div>
          </div>

          {/* ═══ 6. PRESCRIPTION TABLE ═══ */}
          {data.prescriptions && data.prescriptions.length > 0 && (
            <div className="mb-4">
              <h2 className="text-[11px] font-bold text-[#0077b6] mb-2 flex items-center gap-1.5">
                <span className="text-[18px] font-serif italic leading-none">℞</span> {h.prescription}
              </h2>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-[#0077b6] text-white">
                    <th className="border border-[#005f8d] px-2 py-1.5 text-left font-semibold w-[6%]">#</th>
                    <th className="border border-[#005f8d] px-2 py-1.5 text-left font-semibold w-[24%]">Drug</th>
                    <th className="border border-[#005f8d] px-2 py-1.5 text-left font-semibold w-[12%]">Dose</th>
                    <th className="border border-[#005f8d] px-2 py-1.5 text-left font-semibold w-[14%]">Frequency</th>
                    <th className="border border-[#005f8d] px-2 py-1.5 text-left font-semibold w-[12%]">Duration</th>
                    <th className="border border-[#005f8d] px-2 py-1.5 text-left font-semibold w-[10%]">Route</th>
                    <th className="border border-[#005f8d] px-2 py-1.5 text-left font-semibold w-[22%]">Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.prescriptions.map((rx, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-1.5 font-semibold text-gray-800">{rx.drug_name}</td>
                      <td className="border border-gray-200 px-2 py-1.5">{rx.dosage || "–"}</td>
                      <td className="border border-gray-200 px-2 py-1.5">{rx.frequency || "–"}</td>
                      <td className="border border-gray-200 px-2 py-1.5">{rx.duration || "–"}</td>
                      <td className="border border-gray-200 px-2 py-1.5 capitalize">{rx.route || "Oral"}</td>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-500 italic">{rx.instructions || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ 7. INVESTIGATIONS ═══ */}
          {data.labOrders && data.labOrders.length > 0 && (
            <div className="mb-4">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#0077b6] mb-2">{h.investigations}</h2>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600 w-[6%]">#</th>
                    <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600 w-[44%]">Test Name</th>
                    <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600 w-[15%]">Priority</th>
                    <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600 w-[35%]">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.labOrders.map((lo, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-200 px-2 py-1 text-gray-400 font-mono">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-1 font-medium">{lo.test_name}</td>
                      <td className="border border-gray-200 px-2 py-1">
                        {lo.priority === "urgent" ? (
                          <span className="text-red-600 font-semibold uppercase text-[9px]">⚠ Urgent</span>
                        ) : (
                          <span className="text-gray-500 capitalize">{lo.priority || "Routine"}</span>
                        )}
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-gray-500 italic">{lo.notes || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ 8. PATIENT INSTRUCTIONS ═══ */}
          {((t.advice && t.advice.length > 0) || (data.advice && data.advice.length > 0)) && (
            <div className="mb-4">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#0077b6] mb-2">{h.adviceLabel}</h2>
              <div className="bg-[#fffbeb] border border-[#fde68a] rounded p-3">
                <ul className="list-none space-y-1 text-[11px]">
                  {(t.advice || data.advice || []).map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5 shrink-0">●</span>
                      <span className="text-gray-800">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ═══ 9. FOLLOW-UP ═══ */}
          {(data.followUpDate || t.followUpInstructions || data.followUpInstructions) && (
            <div className="mb-4 p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#2563eb] mb-1.5">{h.followUp}</h2>
              {data.followUpDate && (
                <p className="text-[12px] font-bold text-[#1e40af]">
                  {h.nextVisit}: {new Date(data.followUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              )}
              {(t.followUpInstructions || data.followUpInstructions) && (
                <p className="text-[11px] text-[#3b82f6] mt-1">{t.followUpInstructions || data.followUpInstructions}</p>
              )}
            </div>
          )}

          {/* ═══ 10. DOCTOR SIGNATURE ═══ */}
          <div className="mt-6 flex justify-between items-end">
            {/* QR Verification (11) */}
            <div className="flex items-center gap-3">
              <QRCodeSVG value={reportUrl} size={56} level="M" className="print:block" />
              <div className="text-[8px] text-gray-400 leading-relaxed">
                <p className="font-semibold text-gray-500">Scan to verify</p>
                <p>Secure report viewer</p>
                <p>DATAelixAIr™ verified</p>
              </div>
            </div>

            {/* Signature block */}
            <div className="text-right min-w-[200px]">
              <div className="border-b-2 border-gray-400 pb-1 mb-1.5">
                {data.signatureText ? (
                  <p className="text-[15px] font-['Georgia',serif] italic text-gray-700">{data.signatureText}</p>
                ) : data.doctorName ? (
                  <p className="text-[15px] font-['Georgia',serif] italic text-gray-700">{data.doctorName}</p>
                ) : (
                  <div className="h-8" />
                )}
              </div>
              <p className="text-[10px] font-semibold text-gray-700">{data.doctorName || "Doctor"}</p>
              {data.doctorDesignation && <p className="text-[9px] text-gray-500">{data.doctorDesignation}</p>}
              {data.doctorLicense && <p className="text-[9px] text-gray-500">Reg No: {data.doctorLicense}</p>}
              <p className="text-[8px] text-gray-400 mt-1">
                Digitally signed · {dateStr} {timeStr}
              </p>
            </div>
          </div>

          {/* ═══ 12. FOOTER ═══ */}
          <div className="mt-5 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={brainLogo} alt="" className="h-5 w-5 opacity-40" />
              <div>
                <p className="text-[9px] text-gray-400">
                  Generated by <span className="font-bold text-[#0077b6]">DATAelixAIr</span><sup className="text-[0.6em]">™</sup> · AI Clinical Productivity Assistant
                  {languageLabel && languageLabel !== "English" && <span className="ml-1">· {languageLabel}</span>}
                </p>
                <p className="text-[7px] text-gray-300">AI-generated clinical document · Clinician-reviewed before issue · Not a substitute for medical advice</p>
              </div>
            </div>
            <p className="text-[7px] text-gray-300 italic text-right max-w-[120px]">{h.demoWatermark}</p>
          </div>
        </div>
      </div>
    );
  }
);

ConsultationReport.displayName = "ConsultationReport";

/* ─── Helper Components ─── */

function Field({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="text-[11px]">
      <span className="text-gray-500">{label}: </span>
      <span className={`${bold ? "font-bold" : "font-semibold"} ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
    </div>
  );
}

function SoapSection({ label, content, color, highlight }: { label: string; content: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded ${highlight ? "bg-[#fffbeb] border border-[#fde68a]" : "bg-gray-50 border border-gray-200"} p-2.5`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color }}>{label}</p>
      <p className="text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

export default ConsultationReport;
