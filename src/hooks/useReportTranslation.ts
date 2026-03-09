import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ReportLanguage = "english" | "telugu" | "hindi";

export interface TranslatableFields {
  visitSummary?: string | null;
  chiefComplaint?: string | null;
  symptoms?: string | null;
  findings?: string | null;
  diagnosis?: string | null;
  plan?: string | null;
  advice?: string[];
  followUpInstructions?: string | null;
}

export interface TranslatedReport {
  visitSummary?: string;
  chiefComplaint?: string;
  symptoms?: string;
  findings?: string;
  diagnosis?: string;
  plan?: string;
  advice?: string[];
  followUpInstructions?: string;
  sectionHeadings?: Record<string, string>;
}

// Default English section headings
export const ENGLISH_HEADINGS: Record<string, string> = {
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

/**
 * Hook for translating consultation report fields with caching.
 * Translations are cached per language to avoid repeated API calls.
 */
export function useReportTranslation() {
  const [language, setLanguage] = useState<ReportLanguage>("english");
  const [translating, setTranslating] = useState(false);
  const [translations, setTranslations] = useState<Record<string, TranslatedReport>>({});
  const { toast } = useToast();
  
  // Use ref to store cache key (hash of fields) to detect content changes
  const fieldsHashRef = useRef<string>("");

  const getFieldsHash = (fields: TranslatableFields): string => {
    return JSON.stringify({
      vs: fields.visitSummary || "",
      cc: fields.chiefComplaint || "",
      sy: fields.symptoms || "",
      fi: fields.findings || "",
      di: fields.diagnosis || "",
      pl: fields.plan || "",
      ad: (fields.advice || []).join("|"),
      fu: fields.followUpInstructions || "",
    });
  };

  const translateReport = useCallback(async (
    targetLang: ReportLanguage,
    fields: TranslatableFields
  ) => {
    if (targetLang === "english") {
      setLanguage("english");
      return;
    }

    // Check cache
    const hash = getFieldsHash(fields);
    const cacheKey = `${targetLang}_${hash}`;
    
    if (translations[cacheKey]) {
      setLanguage(targetLang);
      return;
    }

    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-report", {
        body: {
          fields: {
            visitSummary: fields.visitSummary || undefined,
            chiefComplaint: fields.chiefComplaint || undefined,
            symptoms: fields.symptoms || undefined,
            findings: fields.findings || undefined,
            diagnosis: fields.diagnosis || undefined,
            plan: fields.plan || undefined,
            advice: fields.advice || undefined,
            followUpInstructions: fields.followUpInstructions || undefined,
          },
          language: targetLang,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast({ title: "Rate limited", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (data.error.includes("credits")) {
          toast({ title: "Credits exhausted", description: "AI translation credits are used up.", variant: "destructive" });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      const translated = data?.translated as TranslatedReport;
      if (translated) {
        setTranslations(prev => ({ ...prev, [cacheKey]: translated }));
        fieldsHashRef.current = hash;
        setLanguage(targetLang);
        toast({ title: "Translation complete", description: `Report translated to ${targetLang === "telugu" ? "Telugu" : "Hindi"}.` });
      }
    } catch (err: any) {
      console.error("Translation failed:", err);
      toast({ title: "Translation failed", description: err.message, variant: "destructive" });
    } finally {
      setTranslating(false);
    }
  }, [translations, toast]);

  const getTranslatedFields = useCallback((
    fields: TranslatableFields
  ): TranslatedReport & { sectionHeadings: Record<string, string> } => {
    if (language === "english") {
      return {
        visitSummary: fields.visitSummary || undefined,
        chiefComplaint: fields.chiefComplaint || undefined,
        symptoms: fields.symptoms || undefined,
        findings: fields.findings || undefined,
        diagnosis: fields.diagnosis || undefined,
        plan: fields.plan || undefined,
        advice: fields.advice,
        followUpInstructions: fields.followUpInstructions || undefined,
        sectionHeadings: ENGLISH_HEADINGS,
      };
    }

    const hash = getFieldsHash(fields);
    const cacheKey = `${language}_${hash}`;
    const cached = translations[cacheKey];

    if (!cached) {
      return {
        visitSummary: fields.visitSummary || undefined,
        chiefComplaint: fields.chiefComplaint || undefined,
        symptoms: fields.symptoms || undefined,
        findings: fields.findings || undefined,
        diagnosis: fields.diagnosis || undefined,
        plan: fields.plan || undefined,
        advice: fields.advice,
        followUpInstructions: fields.followUpInstructions || undefined,
        sectionHeadings: ENGLISH_HEADINGS,
      };
    }

    return {
      visitSummary: cached.visitSummary || fields.visitSummary || undefined,
      chiefComplaint: cached.chiefComplaint || fields.chiefComplaint || undefined,
      symptoms: cached.symptoms || fields.symptoms || undefined,
      findings: cached.findings || fields.findings || undefined,
      diagnosis: cached.diagnosis || fields.diagnosis || undefined,
      plan: cached.plan || fields.plan || undefined,
      advice: cached.advice || fields.advice,
      followUpInstructions: cached.followUpInstructions || fields.followUpInstructions || undefined,
      sectionHeadings: cached.sectionHeadings || ENGLISH_HEADINGS,
    };
  }, [language, translations]);

  return {
    language,
    setLanguage: translateReport,
    translating,
    getTranslatedFields,
  };
}
