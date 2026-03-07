import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Loader2, PenLine, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ConsultationInputProps {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  disabled?: boolean;
}

export default function ConsultationInput({ transcript, onTranscriptChange, disabled }: ConsultationInputProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Track cursor position so recorded text appends at cursor or end
  const cursorRef = useRef<number | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: () => {},
    onCommittedTranscript: (data) => {
      if (data.text) {
        // Insert at cursor position or append
        const pos = cursorRef.current ?? transcript.length;
        const before = transcript.slice(0, pos);
        const after = transcript.slice(pos);
        const separator = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
        const newText = before + separator + data.text.trim() + " " + after;
        onTranscriptChange(newText);
        // Move cursor past inserted text
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

      // Save current cursor
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

  const bars = 20;
  const waveformBars = Array.from({ length: bars }, (_, i) => {
    const center = bars / 2;
    const dist = Math.abs(i - center) / center;
    return isRecording ? Math.max(0.15, audioLevel * (1 - dist * 0.6) + Math.random() * 0.08) : 0.15;
  });

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <PenLine className="h-3.5 w-3.5 text-primary" />
          Consultation Input
        </h3>
        <div className="flex items-center gap-1.5">
          {isRecording && (
            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive animate-pulse gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive inline-block" />
              Recording
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] gap-1">
            <Languages className="h-2.5 w-2.5" />
            EN · HI · TE · UR
          </Badge>
        </div>
      </div>

      {/* Unified textarea – doctor writes here, recorded speech also flows here */}
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
          placeholder="Start typing or click Record to begin capturing consultation notes…"
          rows={8}
          className="text-sm pr-3 resize-y min-h-[140px] font-mono bg-background"
          disabled={disabled}
        />

        {/* Partial transcript overlay */}
        {isRecording && scribe.partialTranscript && (
          <div className="absolute bottom-2 left-2 right-2 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-xs text-primary italic truncate">
            {scribe.partialTranscript}
          </div>
        )}
      </div>

      {/* Recording controls */}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={disabled || isConnecting}
          >
            {isConnecting ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Connecting…</>
            ) : (
              <><Mic className="h-3 w-3" /> Record</>
            )}
          </Button>
        ) : (
          <Button onClick={stopRecording} size="sm" variant="destructive" className="h-8 text-xs gap-1.5">
            <Square className="h-2.5 w-2.5" /> Stop
          </Button>
        )}

        {/* Mini waveform */}
        {isRecording && (
          <div className="flex items-center gap-[1.5px] h-5">
            {waveformBars.map((h, i) => (
              <div
                key={i}
                className="w-[2px] rounded-full bg-primary transition-all duration-75"
                style={{ height: `${h * 100}%`, minHeight: "3px" }}
              />
            ))}
          </div>
        )}

        <span className="text-[10px] text-muted-foreground ml-auto">
          Record &amp; type simultaneously — all text merges into one notebook
        </span>
      </div>
    </div>
  );
}
