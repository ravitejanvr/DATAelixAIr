import { forwardRef } from "react";
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

  // SOAP / Consultation
  chiefComplaint?: string | null;
  symptoms?: string | null;
  findings?: string | null;
  diagnosis?: string | null;
  plan?: string | null;

  // Prescriptions
  prescriptions?: {
    drug_name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    route?: string;
    instructions?: string;
  }[];

  // Investigations
  labOrders?: { test_name: string; priority?: string; notes?: string }[];

  // Advice
  advice?: string[];
  adviceTelugu?: string[];
  adviceHindi?: string[];

  // Follow-up
  followUpDate?: string | null;
  followUpInstructions?: string | null;

  // Doctor signature
  signatureText?: string | null;

  // Meta
  consultationDate?: string;
  consultationId?: string;
}

/**
 * A4-printable Hyderabad OPD consultation report.
 * Renders as a pure HTML/CSS component suitable for print and PDF generation.
 */
const ConsultationReport = forwardRef<HTMLDivElement, { data: ReportData }>(
  ({ data }, ref) => {
    const dateStr =
      data.consultationDate ||
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    return (
      <div
        ref={ref}
        className="w-[210mm] min-h-[297mm] mx-auto bg-white text-[hsl(220,20%,10%)] font-['Inter',sans-serif] relative print:shadow-none shadow-lg"
        style={{ fontSize: "11px", lineHeight: "1.5" }}
      >
        {/* ── Watermark ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          <p
            className="text-[48px] font-bold text-gray-100 rotate-[-35deg] whitespace-nowrap select-none"
            style={{ letterSpacing: "0.15em" }}
          >
            Demo Report – Not for clinical use
          </p>
        </div>

        <div className="relative z-10 px-[15mm] py-[10mm]">
          {/* ═══ 1. CLINIC HEADER ═══ */}
          <div className="flex items-start justify-between border-b-2 border-[hsl(200,98%,39%)] pb-3 mb-4">
            <div className="flex items-center gap-3">
              <img
                src={brainLogo}
                alt="DATAelixAIr"
                className="h-10 w-10 print:h-8 print:w-8"
              />
              <div>
                <h1 className="text-[16px] font-bold tracking-tight text-[hsl(200,98%,39%)]">
                  {data.clinicName || "Clinic Name"}
                </h1>
                <p className="text-[10px] text-gray-500">
                  {data.doctorName && (
                    <span className="font-semibold text-gray-700">
                      {data.doctorName}
                    </span>
                  )}
                  {data.doctorDesignation && ` · ${data.doctorDesignation}`}
                  {data.doctorLicense && ` · Reg: ${data.doctorLicense}`}
                </p>
              </div>
            </div>
            <div className="text-right text-[10px] text-gray-500 leading-relaxed">
              {data.clinicLocation && <p>{data.clinicLocation}</p>}
              {data.clinicPhone && <p>Ph: {data.clinicPhone}</p>}
              {data.clinicEmail && <p>{data.clinicEmail}</p>}
              <p className="font-medium text-gray-700 mt-0.5">{dateStr}</p>
            </div>
          </div>

          {/* ═══ 2. PATIENT INFORMATION ═══ */}
          <div className="bg-gray-50 rounded p-3 mb-4 border border-gray-200">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Patient Information
            </h2>
            <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-[11px]">
              <div>
                <span className="text-gray-500">Name: </span>
                <span className="font-semibold">{data.patientName}</span>
              </div>
              <div>
                <span className="text-gray-500">Age/Gender: </span>
                <span className="font-semibold">
                  {data.patientAge ? `${data.patientAge}y` : "–"}
                  {data.patientGender ? ` / ${data.patientGender}` : ""}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Phone: </span>
                <span className="font-semibold">
                  {data.patientPhone || "–"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Patient ID: </span>
                <span className="font-mono text-[10px]">
                  {data.patientId?.slice(0, 8) || "–"}
                </span>
              </div>
            </div>
          </div>

          {/* ═══ 3. VITALS TABLE ═══ */}
          {data.vitals && (
            <div className="mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Vitals
              </h2>
              <table className="w-full border border-gray-200 text-[11px]">
                <thead>
                  <tr className="bg-gray-50">
                    {data.vitals.temperature != null && (
                      <th className="border border-gray-200 px-2 py-1 font-semibold text-gray-600">
                        Temp (°F)
                      </th>
                    )}
                    {(data.vitals.bp_systolic != null ||
                      data.vitals.bp_diastolic != null) && (
                      <th className="border border-gray-200 px-2 py-1 font-semibold text-gray-600">
                        BP (mmHg)
                      </th>
                    )}
                    {data.vitals.pulse != null && (
                      <th className="border border-gray-200 px-2 py-1 font-semibold text-gray-600">
                        Pulse (bpm)
                      </th>
                    )}
                    {data.vitals.spo2 != null && (
                      <th className="border border-gray-200 px-2 py-1 font-semibold text-gray-600">
                        SpO₂ (%)
                      </th>
                    )}
                    {data.vitals.weight_kg != null && (
                      <th className="border border-gray-200 px-2 py-1 font-semibold text-gray-600">
                        Weight (kg)
                      </th>
                    )}
                    {data.vitals.respiratory_rate != null && (
                      <th className="border border-gray-200 px-2 py-1 font-semibold text-gray-600">
                        RR (/min)
                      </th>
                    )}
                    {data.vitals.blood_sugar != null && (
                      <th className="border border-gray-200 px-2 py-1 font-semibold text-gray-600">
                        Blood Sugar
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center">
                    {data.vitals.temperature != null && (
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">
                        {data.vitals.temperature}
                      </td>
                    )}
                    {(data.vitals.bp_systolic != null ||
                      data.vitals.bp_diastolic != null) && (
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">
                        {data.vitals.bp_systolic || "–"}/
                        {data.vitals.bp_diastolic || "–"}
                      </td>
                    )}
                    {data.vitals.pulse != null && (
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">
                        {data.vitals.pulse}
                      </td>
                    )}
                    {data.vitals.spo2 != null && (
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">
                        {data.vitals.spo2}
                      </td>
                    )}
                    {data.vitals.weight_kg != null && (
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">
                        {data.vitals.weight_kg}
                      </td>
                    )}
                    {data.vitals.respiratory_rate != null && (
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">
                        {data.vitals.respiratory_rate}
                      </td>
                    )}
                    {data.vitals.blood_sugar != null && (
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">
                        {data.vitals.blood_sugar}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ 4. CONSULTATION SUMMARY (SOAP) ═══ */}
          <div className="mb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Consultation Summary
            </h2>
            <div className="space-y-2">
              {data.chiefComplaint && (
                <SoapRow label="Chief Complaint" content={data.chiefComplaint} />
              )}
              {data.symptoms && (
                <SoapRow label="Symptoms" content={data.symptoms} />
              )}
              {data.findings && (
                <SoapRow label="Clinical Findings" content={data.findings} />
              )}
              {data.diagnosis && (
                <SoapRow
                  label="Provisional Diagnosis"
                  content={data.diagnosis}
                  highlight
                />
              )}
              {data.plan && <SoapRow label="Plan" content={data.plan} />}
            </div>
          </div>

          {/* ═══ 5. PRESCRIPTION (Rx) ═══ */}
          {data.prescriptions && data.prescriptions.length > 0 && (
            <div className="mb-4">
              <h2 className="text-[12px] font-bold text-[hsl(200,98%,39%)] mb-1.5 flex items-center gap-1">
                <span className="text-[16px] font-serif italic">℞</span>{" "}
                Prescription
              </h2>
              <div className="space-y-1.5 pl-1">
                {data.prescriptions.map((rx, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[11px] leading-relaxed"
                  >
                    <span className="text-gray-400 font-mono text-[10px] mt-0.5 min-w-[16px]">
                      {i + 1}.
                    </span>
                    <div>
                      <span className="font-semibold">{rx.drug_name}</span>
                      {rx.dosage && (
                        <span className="text-gray-600"> — {rx.dosage}</span>
                      )}
                      {rx.frequency && (
                        <span className="text-gray-600">, {rx.frequency}</span>
                      )}
                      {rx.duration && (
                        <span className="text-gray-600">
                          {" "}
                          × {rx.duration}
                        </span>
                      )}
                      {rx.route && rx.route !== "oral" && (
                        <span className="text-gray-500 italic">
                          {" "}
                          ({rx.route})
                        </span>
                      )}
                      {rx.instructions && (
                        <p className="text-[10px] text-gray-500 italic mt-0.5">
                          {rx.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ 6. INVESTIGATIONS ═══ */}
          {data.labOrders && data.labOrders.length > 0 && (
            <div className="mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Investigations
              </h2>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                {data.labOrders.map((lo, i) => (
                  <li key={i}>
                    <span className="font-medium">{lo.test_name}</span>
                    {lo.priority && lo.priority !== "routine" && (
                      <span className="text-red-600 text-[10px] ml-1 font-semibold uppercase">
                        [{lo.priority}]
                      </span>
                    )}
                    {lo.notes && (
                      <span className="text-gray-500 text-[10px]">
                        {" "}
                        — {lo.notes}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ═══ 7. ADVICE ═══ */}
          {data.advice && data.advice.length > 0 && (
            <div className="mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Advice / Patient Instructions
              </h2>
              {/* English */}
              <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 mb-2">
                {data.advice.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              {/* Telugu */}
              {data.adviceTelugu && data.adviceTelugu.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                    తెలుగు (Telugu)
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                    {data.adviceTelugu.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Hindi */}
              {data.adviceHindi && data.adviceHindi.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                    हिन्दी (Hindi)
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                    {data.adviceHindi.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ═══ 8. FOLLOW-UP ═══ */}
          {(data.followUpDate || data.followUpInstructions) && (
            <div className="mb-4 p-2.5 bg-blue-50 border border-blue-200 rounded">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">
                Follow-Up
              </h2>
              {data.followUpDate && (
                <p className="text-[11px] font-semibold text-blue-800">
                  Next visit:{" "}
                  {new Date(data.followUpDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
              {data.followUpInstructions && (
                <p className="text-[11px] text-blue-700 mt-0.5">
                  {data.followUpInstructions}
                </p>
              )}
            </div>
          )}

          {/* ═══ 9. DOCTOR SIGNATURE ═══ */}
          <div className="mt-8 flex justify-end">
            <div className="text-right min-w-[180px]">
              <div className="border-b border-gray-300 pb-1 mb-1">
                {data.signatureText ? (
                  <p className="text-[14px] font-['Lora',serif] italic text-gray-700">
                    {data.signatureText}
                  </p>
                ) : data.doctorName ? (
                  <p className="text-[14px] font-['Lora',serif] italic text-gray-700">
                    {data.doctorName}
                  </p>
                ) : (
                  <div className="h-8" />
                )}
              </div>
              <p className="text-[10px] text-gray-500">
                {data.doctorName || "Doctor"}
              </p>
              {data.doctorDesignation && (
                <p className="text-[9px] text-gray-400">
                  {data.doctorDesignation}
                </p>
              )}
              {data.doctorLicense && (
                <p className="text-[9px] text-gray-400">
                  Reg No: {data.doctorLicense}
                </p>
              )}
            </div>
          </div>

          {/* ═══ 10. FOOTER ═══ */}
          <div className="mt-6 pt-3 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={brainLogo} alt="" className="h-5 w-5 opacity-50" />
              <p className="text-[9px] text-gray-400">
                Powered by{" "}
                <span className="font-semibold text-[hsl(200,98%,39%)]">
                  DATAelixAIr
                </span>
                <sup className="text-[0.6em]">™</sup> · AI Clinical
                Productivity Assistant
              </p>
            </div>
            <p className="text-[8px] text-gray-300 italic">
              Demo Report – Not for clinical use
            </p>
          </div>
        </div>
      </div>
    );
  }
);

ConsultationReport.displayName = "ConsultationReport";

function SoapRow({
  label,
  content,
  highlight,
}: {
  label: string;
  content: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 text-[11px] ${highlight ? "bg-yellow-50 border-l-2 border-yellow-400 pl-2 py-1 rounded-sm" : ""}`}
    >
      <span className="text-gray-500 font-semibold min-w-[130px] shrink-0">
        {label}:
      </span>
      <span className="text-gray-800 whitespace-pre-wrap">{content}</span>
    </div>
  );
}

export default ConsultationReport;
