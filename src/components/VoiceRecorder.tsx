import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onTranscriptUpdate, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const { toast } = useToast();

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startRecording = useCallback(() => {
    if (!SpeechRecognition) {
      toast({ title: "Not supported", description: "Speech recognition requires Chrome.", variant: "destructive" });
      return;
    }

    transcriptRef.current = "";
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // No lang set — browser auto-detects, supports code-switching

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
      if (final) {
        transcriptRef.current += final;
        onTranscriptUpdate(transcriptRef.current);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
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
  }, [SpeechRecognition, toast, onTranscriptUpdate]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
    }
    setIsRecording(false);
    setInterimText("");
  }, []);

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" /> Audio Capture
        </CardTitle>
        <CardDescription className="text-xs">
          Speak naturally in any language — English, Hindi, Telugu, Urdu
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {!isRecording ? (
            <Button onClick={startRecording} size="sm" className="flex-1" disabled={disabled}>
              <Mic className="h-4 w-4 mr-1" /> Start Recording
            </Button>
          ) : (
            <Button onClick={stopRecording} variant="destructive" size="sm" className="flex-1">
              <Square className="h-3 w-3 mr-1" /> Stop Recording
            </Button>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            Recording... Speak naturally
          </div>
        )}

        {isRecording && interimText && (
          <div className="rounded-lg border bg-background p-2 text-sm text-muted-foreground italic">
            {interimText}
          </div>
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
