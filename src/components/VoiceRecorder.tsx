import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, Sparkles, Square, Languages, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExtractedPatientData {
  name?: string;
  age?: string;
  gender?: string;
  conditions?: string;
  symptoms?: string;
  ethnicity?: string;
  medications?: string;
  clinicalQuery?: string;
}

interface VoiceRecorderProps {
  onExtracted: (data: ExtractedPatientData) => void;
}

const LANGUAGES = [
  { code: "en-IN", label: "English", flag: "🇬🇧" },
  { code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
  { code: "te-IN", label: "తెలుగు", flag: "🇮🇳" },
];

export default function VoiceRecorder({ onExtracted }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [selectedLang, setSelectedLang] = useState("en-IN");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startRecording = useCallback(() => {
    if (!SpeechRecognition) {
      toast({
        title: "Not supported",
        description: "Speech recognition is not supported in this browser. Please use Chrome.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLang;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) setTranscript(prev => prev + final);
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        toast({ title: "Recording error", description: event.error, variant: "destructive" });
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranslatedText("");
  }, [SpeechRecognition, toast, selectedLang]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
    }
    setIsRecording(false);
    setInterimText("");
  }, []);

  const extractPatientData = async () => {
    const textToExtract = translatedText || transcript;
    if (!textToExtract.trim()) {
      toast({ title: "No transcript", description: "Record some speech first.", variant: "destructive" });
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-patient-data", {
        body: { transcript: textToExtract.trim() },
      });

      if (error) throw new Error(error.message);

      onExtracted(data);
      toast({ title: "Data extracted", description: "Patient fields auto-filled from your voice recording." });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTranslateToEnglish = async () => {
    if (!transcript.trim()) return;
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-clinical", {
        body: {
          text: transcript.trim(),
          sourceLang: selectedLang === "hi-IN" ? "Hindi" : "Telugu",
          targetLang: "English",
        },
      });
      if (error) throw new Error(error.message);
      setTranslatedText(data.translated);
      toast({ title: "Translated", description: "Transcript translated to English for extraction." });
    } catch (err: any) {
      toast({ title: "Translation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    if (!text.trim() || isSpeaking) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const langLabel = LANGUAGES.find(l => l.code === selectedLang)?.label || "English";
  const isNonEnglish = selectedLang !== "en-IN";

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" /> Voice Consultation
        </CardTitle>
        <CardDescription className="text-xs">
          Dictate in English, Hindi or Telugu — AI extracts and auto-fills the form
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Language selector */}
        <div className="flex gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                if (!isRecording) {
                  setSelectedLang(lang.code);
                  setTranslatedText("");
                }
              }}
              disabled={isRecording}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                selectedLang === lang.code
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              } ${isRecording ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span>{lang.flag}</span> {lang.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {!isRecording ? (
            <Button onClick={startRecording} size="sm" className="flex-1">
              <Mic className="h-4 w-4 mr-1" /> Start Recording ({langLabel})
            </Button>
          ) : (
            <Button onClick={stopRecording} variant="destructive" size="sm" className="flex-1">
              <Square className="h-3 w-3 mr-1" /> Stop Recording
            </Button>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Recording in {langLabel}... Speak clearly
          </div>
        )}

        {(transcript || interimText) && (
          <div className="space-y-2">
            <div className="rounded-lg border bg-background p-3 max-h-32 overflow-y-auto text-sm">
              <span className="text-foreground">{transcript}</span>
              {interimText && <span className="text-muted-foreground italic">{interimText}</span>}
            </div>
            {transcript && !isRecording && (
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSpeak(transcript, selectedLang)}
                  disabled={isSpeaking}
                  className="text-xs"
                >
                  <Volume2 className="h-3 w-3 mr-1" /> Play
                </Button>
                {isNonEnglish && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTranslateToEnglish}
                    disabled={isTranslating}
                    className="text-xs"
                  >
                    {isTranslating ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Translating...</>
                    ) : (
                      <><Languages className="h-3 w-3 mr-1" /> Translate to English</>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {translatedText && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 max-h-32 overflow-y-auto text-sm space-y-1">
            <span className="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase">English Translation</span>
            <p className="text-foreground">{translatedText}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSpeak(translatedText, "en-IN")}
              disabled={isSpeaking}
              className="text-xs h-6 px-2"
            >
              <Volume2 className="h-3 w-3 mr-1" /> Play English
            </Button>
          </div>
        )}

        {transcript && !isRecording && (
          <Button
            onClick={extractPatientData}
            disabled={isExtracting}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isExtracting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Extracting patient data...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-1" /> Extract & Auto-fill Form{isNonEnglish && !translatedText ? " (translate first)" : ""}</>
            )}
          </Button>
        )}

        {transcript && (
          <button
            onClick={() => { setTranscript(""); setInterimText(""); setTranslatedText(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear transcript
          </button>
        )}

        {!SpeechRecognition && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
            ⚠ Use Chrome for voice features
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
