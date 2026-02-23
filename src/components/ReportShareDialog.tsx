import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Share2, MessageCircle, Languages, FileText } from "lucide-react";
import type { ClinicalAgentResponse } from "@/lib/clinical-api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ReportShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ClinicalAgentResponse;
  patientName: string;
}

type ReportLanguage = "english" | "hindi" | "telugu";

export default function ReportShareDialog({
  open,
  onOpenChange,
  result,
  patientName,
}: ReportShareDialogProps) {
  const { toast } = useToast();
  const [language, setLanguage] = useState<ReportLanguage>("english");
  const [translatedContent, setTranslatedContent] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [bilingualMode, setBilingualMode] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const a = result.assessment;

  const buildEnglishReport = () => {
    const lines: string[] = [];
    lines.push(`CLINICAL CONSULTATION REPORT`);
    lines.push(`Patient: ${patientName}`);
    lines.push(`Date: ${new Date(result.timestamp).toLocaleDateString()}`);
    lines.push(`---`);

    if (a.summary) {
      lines.push(`\nCLINICAL SUMMARY`);
      lines.push(a.summary);
    }

    if (a.soap_notes) {
      lines.push(`\nSOAP NOTES`);
      lines.push(`Subjective: ${a.soap_notes.subjective}`);
      lines.push(`Objective: ${a.soap_notes.objective}`);
      lines.push(`Assessment: ${a.soap_notes.assessment}`);
      lines.push(`Plan: ${a.soap_notes.plan}`);
    }

    if (a.risk_assessment) {
      lines.push(`\nRISK ASSESSMENT`);
      lines.push(`Primary Risk: ${a.risk_assessment.primary_risk}`);
      lines.push(`Risk Level: ${a.risk_assessment.risk_percentage}`);
      if (a.risk_assessment.risk_factors?.length) {
        lines.push(`Risk Factors: ${a.risk_assessment.risk_factors.join(", ")}`);
      }
    }

    if (a.drug_recommendations?.length) {
      lines.push(`\nDRUG RECOMMENDATIONS`);
      a.drug_recommendations.forEach((d) => {
        lines.push(`• ${d.drug} — ${d.dosage}, ${d.frequency}`);
        lines.push(`  Rationale: ${d.rationale}`);
      });
    }

    if (a.tests_recommended?.length) {
      lines.push(`\nTESTS RECOMMENDED`);
      a.tests_recommended.forEach((t) => lines.push(`• ${t}`));
    }

    if (a.follow_up) {
      lines.push(`\nFOLLOW-UP: ${a.follow_up}`);
    }

    if (a.icd_codes?.length) {
      lines.push(`\nICD CODES`);
      a.icd_codes.forEach((c) => lines.push(`• ${c.code}: ${c.description}`));
    }

    lines.push(`\n---`);
    lines.push(`⚕️ ${a.disclaimer || "AI-generated report. For reference only. Clinical judgement required."}`);

    return lines.join("\n");
  };

  const handleTranslate = async (lang: ReportLanguage) => {
    setLanguage(lang);
    if (lang === "english") {
      setTranslatedContent("");
      return;
    }

    setIsTranslating(true);
    try {
      const englishReport = buildEnglishReport();
      const { data, error } = await supabase.functions.invoke("translate-report", {
        body: { content: englishReport, language: lang },
      });
      if (error) throw new Error(error.message);
      setTranslatedContent(data.translated);
    } catch (err: any) {
      toast({ title: "Translation failed", description: err.message, variant: "destructive" });
      setLanguage("english");
    } finally {
      setIsTranslating(false);
    }
  };

  const getDisplayContent = () => {
    if (bilingualMode && translatedContent) {
      const english = buildEnglishReport();
      return `${english}\n\n${"═".repeat(50)}\n\n${translatedContent}`;
    }
    if (language !== "english" && translatedContent) return translatedContent;
    return buildEnglishReport();
  };

  const handleDownloadBilingualPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);

    try {
      // If bilingual and no translation yet, translate first
      if (bilingualMode && !translatedContent && language === "english") {
        // Default to Hindi for bilingual
        await handleTranslate("hindi");
      }

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let yOffset = 0;
      let pageNum = 0;

      while (yOffset < imgHeight) {
        if (pageNum > 0) pdf.addPage();

        const sourceY = (yOffset / imgHeight) * canvas.height;
        const sourceHeight = Math.min(
          ((pageHeight - margin * 2) / imgHeight) * canvas.height,
          canvas.height - sourceY
        );

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

        const pageImgData = pageCanvas.toDataURL("image/png");
        const drawHeight = (sourceHeight * contentWidth) / canvas.width;
        pdf.addImage(pageImgData, "PNG", margin, margin, contentWidth, drawHeight);

        yOffset += pageHeight - margin * 2;
        pageNum++;
      }

      const langLabel = bilingualMode
        ? `EN_${language === "english" ? "HI" : language === "hindi" ? "HI" : "TE"}`
        : language === "hindi" ? "HI" : language === "telugu" ? "TE" : "EN";
      pdf.save(`consultation_${patientName.replace(/\s+/g, "_")}_${langLabel}.pdf`);
      toast({ title: "PDF downloaded", description: bilingualMode ? "Bilingual report saved" : `Report saved in ${language}` });
    } catch (err: any) {
      toast({ title: "PDF generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleWhatsAppShare = () => {
    const content = getDisplayContent();
    const truncated = content.length > 1500
      ? content.slice(0, 1500) + "\n\n... [Report truncated. Full report available as PDF]"
      : content;
    const url = `https://wa.me/?text=${encodeURIComponent(truncated)}`;
    window.open(url, "_blank");
  };

  const langLabel: Record<ReportLanguage, string> = {
    english: "English",
    hindi: "हिन्दी (Hindi)",
    telugu: "తెలుగు (Telugu)",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" /> Share Consultation Report
          </DialogTitle>
          <DialogDescription>
            Download as PDF or share via WhatsApp. Enable bilingual mode for combined English + local language.
          </DialogDescription>
        </DialogHeader>

        {/* Language selector */}
        <div className="flex gap-2 items-center flex-wrap">
          <Languages className="h-4 w-4 text-muted-foreground" />
          {(["english", "hindi", "telugu"] as ReportLanguage[]).map((lang) => (
            <Button
              key={lang}
              size="sm"
              variant={language === lang ? "default" : "outline"}
              onClick={() => handleTranslate(lang)}
              disabled={isTranslating}
              className="text-xs"
            >
              {langLabel[lang]}
            </Button>
          ))}
          {isTranslating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <div className="ml-auto">
            <Button
              size="sm"
              variant={bilingualMode ? "default" : "outline"}
              onClick={() => setBilingualMode(!bilingualMode)}
              className="text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              {bilingualMode ? "Bilingual ON" : "Bilingual"}
            </Button>
          </div>
        </div>

        {/* Report preview */}
        <div className="flex-1 overflow-y-auto border rounded-lg bg-white">
          <div
            ref={reportRef}
            className="p-6 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap"
            style={{ fontFamily: "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Telugu', sans-serif", minHeight: 200 }}
          >
            {isTranslating ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Translating to {langLabel[language]}...
              </div>
            ) : (
              getDisplayContent()
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleDownloadBilingualPdf} disabled={isGeneratingPdf || isTranslating} className="flex-1">
            {isGeneratingPdf ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating PDF...</>
            ) : (
              <><Download className="h-4 w-4 mr-1" /> {bilingualMode ? "Download Bilingual PDF" : "Download PDF"}</>
            )}
          </Button>
          <Button onClick={handleWhatsAppShare} disabled={isTranslating} variant="outline" className="flex-1 text-green-700 border-green-300 hover:bg-green-50 hover:border-green-400">
            <MessageCircle className="h-4 w-4 mr-1" /> Share via WhatsApp
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          ⚕️ AI-translated medical reports are for reference only. Always verify with a qualified professional.
        </p>
      </DialogContent>
    </Dialog>
  );
}
