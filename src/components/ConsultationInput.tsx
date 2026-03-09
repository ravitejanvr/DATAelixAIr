import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const cursorRef = useRef<number | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: () => {},
    onCommittedTranscript: (data) => {
      if (data.text) {
        const pos = cursorRef.current ?? transcript.length;
        const before = transcript.slice(0, pos);
        const after = transcript.slice(pos);
        const separator = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
        const newText = before + separator + data.text.trim() + " " + after;
        onTranscriptChange(newText);
        const newPos = pos + separator.length + data.text.trim().length + 1;
        cursorRef.current = newPos;
      }
    },
  });

  const startRecording = useCallback(async () => {
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

      cursorRef.current = textareaRef.current?.selectionStart ?? transcript.length;

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

  const bars = 16;
  const waveformBars = Array.from({ length: bars }, (_, i) => {
    const center = bars / 2;
    const dist = Math.abs(i - center) / center;
    return isRecording ? Math.max(0.15, audioLevel * (1 - dist * 0.6) + Math.random() * 0.08) : 0.15;
  });

  return (
    <div className="space-y-1.5">
      {/* Controls row */}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1"
            disabled={disabled || isConnecting}
          >
            {isConnecting ? (
              <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Connecting…</>
            ) : (
              <><Mic className="h-2.5 w-2.5" /> Record</>
            )}
          </Button>
        ) : (
          <Button onClick={stopRecording} size="sm" variant="destructive" className="h-7 text-[11px] gap-1">
            <Square className="h-2 w-2" /> Stop
          </Button>
        )}

        {isRecording && (
          <>
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
          </>
        )}
      </div>

      {/* Textarea */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={transcript}
          onChange={(e) => {
            onTranscriptChange(e.target.value);
            cursorRef.current = e.target.selectionStart;
          }}
          onSelect={(e) => {
            cursorRef.current = (e.target as HTMLTextAreaElement).selectionStart;
          }}
          placeholder="Click Record to start capturing…"
          rows={4}
          className="text-xs pr-3 resize-none min-h-[72px] font-mono bg-background"
          disabled={disabled}
        />

        {isRecording && scribe.partialTranscript && (
          <div className="absolute bottom-1.5 left-2 right-2 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-[11px] text-primary italic truncate">
            {scribe.partialTranscript}
          </div>
        )}
      </div>
    </div>
  );
}
