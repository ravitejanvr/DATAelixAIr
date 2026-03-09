import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import SEO from "@/components/SEO";
import {
  CheckCircle2, ChevronLeft, Loader2,
  AlertTriangle, Search, X, Globe,
  Thermometer, HeadsetIcon, Frown, Meh, Smile,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PatientTrustBanner from "@/components/PatientTrustBanner";

/* ─── Multilingual labels ─── */
type Lang = "en" | "te" | "hi" | "ur";
const LANG_META: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ur", label: "Urdu", native: "اردو" },
];

const T: Record<string, Record<Lang, string>> = {
  title:        { en: "Quick Check-in", te: "త్వరిత చెక్-ఇన్", hi: "त्वरित चेक-इन", ur: "فوری چیک ان" },
  step1Title:   { en: "What brings you in?", te: "మీరు ఎందుకు వచ్చారు?", hi: "आप क्यों आए हैं?", ur: "آپ کیوں آئے ہیں؟" },
  step1Sub:     { en: "Tap your symptoms", te: "మీ లక్షణాలను ట్యాప్ చేయండి", hi: "अपने लक्षण चुनें", ur: "اپنی علامات منتخب کریں" },
  other:        { en: "Other", te: "ఇతరం", hi: "अन्य", ur: "دیگر" },
  searchSymptom:{ en: "Type symptom...", te: "లక్షణం టైప్ చేయండి...", hi: "लक्षण टाइप करें...", ur: "علامت ٹائپ کریں..." },
  step2Title:   { en: "How long?", te: "ఎంత కాలం?", hi: "कितने समय से?", ur: "کتنے عرصے سے؟" },
  step3Title:   { en: "How bad is it?", te: "ఎంత తీవ్రంగా ఉంది?", hi: "कितना गंभीर है?", ur: "کتنا شدید ہے؟" },
  mild:         { en: "Mild", te: "తేలికైన", hi: "हल्का", ur: "ہلکا" },
  moderate:     { en: "Moderate", te: "మధ్యస్థం", hi: "मध्यम", ur: "درمیانہ" },
  severe:       { en: "Severe", te: "తీవ్రమైన", hi: "गंभीर", ur: "شدید" },
  step4Title:   { en: "Quick safety check", te: "భద్రతా తనిఖీ", hi: "सुरक्षा जाँच", ur: "حفاظتی جانچ" },
  conditions:   { en: "Any of these conditions?", te: "ఈ పరిస్థితుల్లో ఏదైనా?", hi: "इनमें से कोई स्थिति?", ur: "ان میں سے کوئی حالت؟" },
  diabetes:     { en: "Diabetes", te: "షుగర్ వ్యాధి", hi: "मधुमेह", ur: "ذیابیطس" },
  bp:           { en: "High BP", te: "అధిక BP", hi: "उच्च रक्तचाप", ur: "ہائی بلڈ پریشر" },
  asthma:       { en: "Asthma", te: "ఆస్తమా", hi: "दमा", ur: "دمہ" },
  none:         { en: "None", te: "ఏమీ లేదు", hi: "कोई नहीं", ur: "کوئی نہیں" },
  allergyQ:     { en: "Any medicine allergies?", te: "మందుల అలెర్జీ ఉందా?", hi: "कोई दवा एलर्जी?", ur: "دوا سے الرجی؟" },
  yes:          { en: "Yes", te: "అవును", hi: "हाँ", ur: "ہاں" },
  no:           { en: "No", te: "లేదు", hi: "नहीं", ur: "نہیں" },
  searchAllergy:{ en: "Type allergy...", te: "అలెర్జీ టైప్ చేయండి...", hi: "एलर्जी टाइप करें...", ur: "الرجی ٹائپ کریں..." },
  review:       { en: "Review & Confirm", te: "సమీక్ష & నిర్ధారించండి", hi: "समीक्षा एवं पुष्टि", ur: "جائزہ اور تصدیق" },
  complaint:    { en: "Complaint", te: "ఫిర్యాదు", hi: "शिकायत", ur: "شکایت" },
  duration:     { en: "Duration", te: "వ్యవధి", hi: "अवधि", ur: "مدت" },
  severity:     { en: "Severity", te: "తీవ్రత", hi: "गंभीरता", ur: "شدت" },
  allergies:    { en: "Allergies", te: "అలెర్జీలు", hi: "एलर्जी", ur: "الرجی" },
  conditionsL:  { en: "Conditions", te: "పరిస్థితులు", hi: "स्थितियाँ", ur: "حالات" },
  noneNoted:    { en: "None noted", te: "ఏమీ లేదు", hi: "कोई नहीं", ur: "کوئی نہیں" },
  submit:       { en: "Confirm & Submit", te: "నిర్ధారించి సమర్పించండి", hi: "पुष्टि करें और जमा करें", ur: "تصدیق اور جمع کریں" },
  edit:         { en: "Edit", te: "మార్చు", hi: "संपादित करें", ur: "ترمیم" },
  back:         { en: "Back", te: "వెనుకకు", hi: "पीछे", ur: "واپس" },
  next:         { en: "Next", te: "తదుపరి", hi: "अगला", ur: "اگلا" },
  thanks:       { en: "Thank You!", te: "ధన్యవాదాలు!", hi: "धन्यवाद!", ur: "شکریہ!" },
  thanksMsg:    { en: "Your information has been submitted. Your doctor will review it.", te: "మీ సమాచారం సమర్పించబడింది.", hi: "आपकी जानकारी सबमिट हो गई है।", ur: "آپ کی معلومات جمع کر دی گئیں۔" },
  close:        { en: "You may close this page.", te: "ఈ పేజీని మూసివేయవచ్చు.", hi: "आप इस पेज को बंद कर सकते हैं।", ur: "آپ یہ صفحہ بند کر سکتے ہیں۔" },
  invalid:      { en: "Invalid Link", te: "చెల్లని లింక్", hi: "अमान्य लिंक", ur: "غلط لنک" },
  invalidMsg:   { en: "This intake link is invalid or expired. Ask reception for a new link.", te: "ఈ లింక్ చెల్లదు. రిసెప్షన్ ను అడగండి.", hi: "यह लिंक अमान्य है। रिसेप्शन से पूछें।", ur: "یہ لنک غلط ہے۔ استقبالیہ سے پوچھیں۔" },
};

/* ─── Symptom chips ─── */
const SYMPTOM_CHIPS = [
  { en: "Fever", te: "జ్వరం", hi: "बुखार", ur: "بخار", icon: "🤒" },
  { en: "Cough", te: "దగ్గు", hi: "खांसी", ur: "کھانسی", icon: "😷" },
  { en: "Headache", te: "తలనొప్పి", hi: "सिरदर्द", ur: "سر درد", icon: "🤕" },
  { en: "Stomach Pain", te: "కడుపు నొప్పి", hi: "पेट दर्द", ur: "پیٹ درد", icon: "😣" },
  { en: "Back Pain", te: "వెన్నునొప్పి", hi: "कमर दर्द", ur: "کمر درد", icon: "💪" },
  { en: "Skin Problem", te: "చర్మ సమస్య", hi: "त्वचा समस्या", ur: "جلد مسئلہ", icon: "🩹" },
  { en: "Breathing Difficulty", te: "శ్వాస కష్టం", hi: "साँस की तकलीफ", ur: "سانس لینے میں دشواری", icon: "😮‍💨" },
];

const DURATION_OPTS = [
  { en: "Today", te: "ఈ రోజు", hi: "आज", ur: "آج" },
  { en: "1–2 days", te: "1–2 రోజులు", hi: "1–2 दिन", ur: "1–2 دن" },
  { en: "3–7 days", te: "3–7 రోజులు", hi: "3–7 दिन", ur: "3–7 دن" },
  { en: "More than 1 week", te: "1 వారం పైన", hi: "1 सप्ताह से अधिक", ur: "1 ہفتے سے زیادہ" },
];

const SEVERITY_OPTS = [
  { key: "mild", score: 2, emoji: "😊", color: "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" },
  { key: "moderate", score: 5, emoji: "😐", color: "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-400" },
  { key: "severe", score: 8, emoji: "😣", color: "border-destructive/50 bg-destructive/10 text-destructive" },
];

const CONDITION_KEYS = ["diabetes", "bp", "asthma", "none"] as const;

const COMMON_DRUG_ALLERGENS = [
  "Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Codeine",
  "Amoxicillin", "Cephalosporins", "Erythromycin", "Ciprofloxacin",
  "Metformin", "Diclofenac", "Tetracycline", "Naproxen",
];

/* ─── Autocomplete symptom dictionary ─── */
const SYMPTOM_DICTIONARY = [
  "Fever", "Cough", "Headache", "Stomach Pain", "Back Pain", "Skin Problem",
  "Breathing Difficulty", "Cold", "Body Pain", "Chest Pain", "Nausea", "Vomiting",
  "Diarrhea", "Dizziness", "Fatigue", "Joint Pain", "Skin Rash", "Sore Throat",
  "Ear Pain", "Eye Pain", "Urinary Issues", "Anxiety", "Insomnia", "Weight Loss",
  "Swelling", "Palpitations", "Numbness", "Constipation", "Blurred Vision",
  "Leg Pain", "Neck Pain", "Toothache", "Sneezing", "Runny Nose",
];

type IntakeStep = 0 | 1 | 2 | 3 | 4; // 0-3 = steps, 4 = review

const SLIDE = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { duration: 0.2 } };

export default function PatientSelfIntake() {
  const [searchParams] = useSearchParams();
  const visitToken = searchParams.get("token");

  const [lang, setLang] = useState<Lang>("en");
  const [step, setStep] = useState<IntakeStep>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [visitValid, setVisitValid] = useState<boolean | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Form data
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [showOtherSearch, setShowOtherSearch] = useState(false);
  const [symptomSearch, setSymptomSearch] = useState("");
  const [duration, setDuration] = useState("");
  const [severityKey, setSeverityKey] = useState<string>("");
  const [painScore, setPainScore] = useState(0);
  const [conditions, setConditions] = useState<string[]>([]);
  const [hasAllergy, setHasAllergy] = useState<boolean | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergySearch, setAllergySearch] = useState("");

  const t = useCallback((key: string) => T[key]?.[lang] || T[key]?.en || key, [lang]);

  // Validate visit via edge function (token-based, no direct DB access)
  useEffect(() => {
    if (!visitToken) { setVisitValid(false); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("validate-intake", {
        body: { visit_token: visitToken },
      });
      if (error || !data?.visit_id) {
        setVisitValid(false);
      } else {
        setVisitValid(true);
        setVisitId(data.visit_id);
        setPatientName(data.patient_name || "");
      }
    })();
  }, [visitToken]);

  // Autocomplete: symptoms
  const filteredSuggestions = useMemo(() => {
    if (symptomSearch.length < 3) return [];
    const q = symptomSearch.toLowerCase();
    return SYMPTOM_DICTIONARY.filter(s =>
      s.toLowerCase().includes(q) && !selectedSymptoms.includes(s)
    ).slice(0, 5);
  }, [symptomSearch, selectedSymptoms]);

  // Autocomplete: allergies
  const filteredAllergens = useMemo(() => {
    if (allergySearch.length < 3) return [];
    const q = allergySearch.toLowerCase();
    return COMMON_DRUG_ALLERGENS.filter(a =>
      a.toLowerCase().includes(q) && !allergies.includes(a)
    ).slice(0, 5);
  }, [allergySearch, allergies]);

  const toggleSymptom = (name: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const toggleCondition = (key: string) => {
    if (key === "none") {
      setConditions(prev => prev.includes("None") ? [] : ["None"]);
      return;
    }
    const label = T[key]?.en || key;
    setConditions(prev => {
      if (prev.includes(label)) return prev.filter(c => c !== label);
      return [...prev.filter(c => c !== "None"), label];
    });
  };

  const chiefComplaint = selectedSymptoms.join(", ");
  const severityObj = SEVERITY_OPTS.find(s => s.key === severityKey);

  const canProceed: Record<IntakeStep, boolean> = {
    0: selectedSymptoms.length > 0,
    1: !!duration,
    2: !!severityKey,
    3: conditions.length > 0 && hasAllergy !== null,
    4: true,
  };

  const goNext = () => { if (step < 4) setStep((step + 1) as IntakeStep); };
  const goBack = () => { if (step > 0) setStep((step - 1) as IntakeStep); };

  const handleSubmit = async () => {
    if (!visitToken) return;
    setSubmitting(true);
    try {
      const allergyList = allergies.length > 0 ? allergies : [];
      const conditionList = conditions.filter(c => c !== "None");

      const { data, error } = await supabase.functions.invoke("submit-intake", {
        body: {
          visit_token: visitToken,
          chief_complaint: chiefComplaint,
          symptom_duration: duration,
          pain_score: painScore,
          priority: painScore >= 8 ? "urgent" : painScore >= 5 ? "semi_urgent" : "routine",
          allergies_noted: allergyList.join(", ") || null,
          notes: conditionList.length ? `Chronic: ${conditionList.join(", ")}` : null,
          allergies: allergyList,
        },
      });

      if (error) throw new Error(error.message);
      setSubmitted(true);
    } catch (e) {
      console.error("Intake submission error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Invalid
  if (visitValid === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">{t("invalid")}</h2>
            <p className="text-sm text-muted-foreground">{t("invalidMsg")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading
  if (visitValid === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Submitted
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Intake Complete | DATAelixAIr" description="Your intake form has been submitted." />
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">{t("thanks")}</h2>
            <p className="text-sm text-muted-foreground">{t("thanksMsg")}</p>
            <p className="text-xs text-muted-foreground mt-2">{t("close")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepCount = 4;
  const displayStep = Math.min(step, 3);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <SEO title="Patient Intake | DATAelixAIr" description="Complete your pre-visit intake form." />

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base font-bold text-foreground">{t("title")}</h1>
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full border border-border"
            >
              <Globe className="h-3 w-3" />
              {LANG_META.find(l => l.code === lang)?.native}
            </button>
          </div>

          {showLangPicker && (
            <div className="flex gap-2 mb-2">
              {LANG_META.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    lang === l.code
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border"
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          )}

          {/* Progress */}
          <div className="flex gap-1">
            {Array.from({ length: stepCount }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors ${i <= displayStep ? "bg-primary" : "bg-muted/30"}`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {displayStep + 1}/{stepCount}
            {patientName && ` · ${patientName}`}
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-5 pb-28 space-y-4">
        <PatientTrustBanner compact />
        <AnimatePresence mode="wait">
          {/* ── STEP 0: Chief Complaint ── */}
          {step === 0 && (
            <motion.div key="s0" {...SLIDE} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("step1Title")}</h2>
                <p className="text-sm text-muted-foreground">{t("step1Sub")}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {SYMPTOM_CHIPS.map(chip => {
                  const selected = selectedSymptoms.includes(chip.en);
                  return (
                    <button
                      key={chip.en}
                      onClick={() => toggleSymptom(chip.en)}
                      className={`flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                        selected
                          ? "bg-primary/10 text-primary border-primary shadow-sm"
                          : "bg-card text-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="text-lg">{chip.icon}</span>
                      <span>{chip[lang] || chip.en}</span>
                    </button>
                  );
                })}
                {/* Other button */}
                <button
                  onClick={() => setShowOtherSearch(!showOtherSearch)}
                  className={`flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                    showOtherSearch
                      ? "bg-primary/10 text-primary border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/40"
                  }`}
                >
                  <span className="text-lg">➕</span>
                  <span>{t("other")}</span>
                </button>
              </div>

              {showOtherSearch && (
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder={t("searchSymptom")}
                    value={symptomSearch}
                    onChange={e => setSymptomSearch(e.target.value)}
                    className="pl-9 h-11 text-sm rounded-xl"
                  />
                  {filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                      {filteredSuggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => { toggleSymptom(s); setSymptomSearch(""); setShowOtherSearch(false); }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedSymptoms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSymptoms.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs gap-1 py-1 px-2.5">
                      {s}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleSymptom(s)} />
                    </Badge>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 1: Duration ── */}
          {step === 1 && (
            <motion.div key="s1" {...SLIDE} className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t("step2Title")}</h2>
              <div className="grid grid-cols-1 gap-3">
                {DURATION_OPTS.map(d => (
                  <button
                    key={d.en}
                    onClick={() => setDuration(d.en)}
                    className={`px-5 py-4 rounded-xl text-base font-medium border-2 transition-all active:scale-[0.97] text-left ${
                      duration === d.en
                        ? "bg-primary/10 text-primary border-primary shadow-sm"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {d[lang] || d.en}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Severity ── */}
          {step === 2 && (
            <motion.div key="s2" {...SLIDE} className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t("step3Title")}</h2>
              <div className="grid grid-cols-3 gap-3">
                {SEVERITY_OPTS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => { setSeverityKey(s.key); setPainScore(s.score); }}
                    className={`flex flex-col items-center gap-2 px-3 py-5 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                      severityKey === s.key
                        ? s.color + " shadow-sm ring-1 ring-offset-1"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-3xl">{s.emoji}</span>
                    <span>{t(s.key)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Safety Flags ── */}
          {step === 3 && (
            <motion.div key="s3" {...SLIDE} className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground">{t("step4Title")}</h2>

              {/* Conditions */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("conditions")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {CONDITION_KEYS.map(key => {
                    const label = T[key]?.en || key;
                    const isSelected = key === "none" ? conditions.includes("None") : conditions.includes(label);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleCondition(key)}
                        className={`px-4 py-3.5 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                          isSelected
                            ? key === "none"
                              ? "bg-muted text-foreground border-muted"
                              : "bg-primary/10 text-primary border-primary"
                            : "bg-card text-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {t(key)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Allergies */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("allergyQ")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setHasAllergy(false); setAllergies([]); setAllergySearch(""); }}
                    className={`px-4 py-3.5 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                      hasAllergy === false
                        ? "bg-muted text-foreground border-muted"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {t("no")}
                  </button>
                  <button
                    onClick={() => setHasAllergy(true)}
                    className={`px-4 py-3.5 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                      hasAllergy === true
                        ? "bg-destructive/10 text-destructive border-destructive/50"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {t("yes")}
                  </button>
                </div>

                {hasAllergy && (
                  <div className="mt-3 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        placeholder={t("searchAllergy")}
                        value={allergySearch}
                        onChange={e => setAllergySearch(e.target.value)}
                        className="pl-9 h-11 text-sm rounded-xl"
                      />
                      {filteredAllergens.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                          {filteredAllergens.map(a => (
                            <button
                              key={a}
                              onClick={() => { setAllergies(prev => [...prev, a]); setAllergySearch(""); }}
                              className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors text-foreground"
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {allergies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {allergies.map(a => (
                          <Badge key={a} variant="destructive" className="text-xs gap-1 py-1 px-2.5">
                            {a}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setAllergies(prev => prev.filter(x => x !== a))} />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: Review ── */}
          {step === 4 && (
            <motion.div key="s4" {...SLIDE} className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t("review")}</h2>

              <Card className="border-primary/30 overflow-hidden">
                <CardContent className="p-0 divide-y divide-border">
                  <ReviewRow label={t("complaint")} value={chiefComplaint} />
                  <ReviewRow label={t("duration")} value={duration} />
                  <ReviewRow label={t("severity")} value={severityObj ? `${severityObj.emoji} ${t(severityObj.key)}` : "—"} />
                  <ReviewRow label={t("conditionsL")} value={conditions.filter(c => c !== "None").join(", ") || t("noneNoted")} />
                  <ReviewRow
                    label={t("allergies")}
                    value={allergies.length > 0 ? allergies.join(", ") : t("noneNoted")}
                    highlight={allergies.length > 0}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom nav ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 z-20">
        <div className="max-w-md mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={goBack} className="h-12 px-5 rounded-xl text-sm">
              <ChevronLeft className="h-4 w-4 mr-1" /> {t("back")}
            </Button>
          )}
          {step < 4 ? (
            <Button
              onClick={goNext}
              disabled={!canProceed[step]}
              className="flex-1 h-12 rounded-xl text-sm"
            >
              {t("next")}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-12 rounded-xl text-sm gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "..." : t("submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm text-right font-medium ${highlight ? "text-destructive" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
