import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import VoiceRecordingConsent, { hasVoiceConsent, setVoiceConsent } from "@/components/VoiceRecordingConsent";

interface ConsultationInputProps {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  disabled?: boolean;
}

export default function ConsultationInput({ transcript, onTranscriptChange, disabled }: ConsultationInputProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const { toast } = useToast();

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: () => {},
    onCommittedTranscript: (data) => {
      if (data.text) {
        const separator = transcript.length > 0 && !transcript.endsWith(" ") && !transcript.endsWith("\n") ? " " : "";
        onTranscriptChange(transcript + separator + data.text.trim() + " ");
      }
    },
  });

  const requestRecording = useCallback(() => {
    if (hasVoiceConsent()) {
      doStartRecording();
    } else {
      setShowConsent(true);
    }
  }, []);

  const doStartRecording = useCallback(async () => {
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error(error?.message || "Failed to get transcription token");

      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(arr);
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        setAudioLevel(avg / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err: any) {
      toast({ title: "Recording failed", description: err.message || "Could not start recording", variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, toast, transcript]);

  const stopRecording = useCallback(() => {
    scribe.disconnect();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    analyserRef.current = null;
    setAudioLevel(0);
  }, [scribe]);

  useEffect(() => {
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  const isRecording = scribe.isConnected;

  const bars = 12;
  const waveformBars = Array.from({ length: bars }, (_, i) => {
    const center = bars / 2;
    const dist = Math.abs(i - center) / center;
    return isRecording ? Math.max(0.15, audioLevel * (1 - dist * 0.6) + Math.random() * 0.08) : 0.15;
  });

  return (
    <div className="flex items-center gap-1.5">
      <VoiceRecordingConsent
        open={showConsent}
        onConsent={() => { setShowConsent(false); setVoiceConsent(); doStartRecording(); }}
        onDecline={() => setShowConsent(false)}
      />
      {!isRecording ? (
        <button
          onClick={requestRecording}
          disabled={disabled || isConnecting}
          className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {isConnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Mic className="h-3.5 w-3.5 text-primary" />
          )}
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button onClick={stopRecording} className="h-8 w-8 rounded-xl bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
            <Square className="h-3 w-3 text-destructive" />
          </button>
          <div className="flex items-center gap-[1px] h-4">
            {waveformBars.map((h, i) => (
              <div
                key={i}
                className="w-[1.5px] rounded-full bg-primary transition-all duration-75"
                style={{ height: `${h * 100}%`, minHeight: "2px" }}
              />
            ))}
          </div>
          <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive animate-pulse gap-0.5 h-5">
            <span className="h-1 w-1 rounded-full bg-destructive inline-block" />
            Live
          </Badge>
        </div>
      )}
    </div>
  );
}
