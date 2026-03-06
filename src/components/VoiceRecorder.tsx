import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mic, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onTranscriptUpdate, disabled }: VoiceRecorderProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const transcriptRef = useRef("");
  const { toast } = useToast();
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: () => {},
    onCommittedTranscript: (data) => {
      if (data.text) {
        transcriptRef.current += data.text + " ";
        onTranscriptUpdate(transcriptRef.current.trim());
      }
    },
  });

  const startRecording = useCallback(async () => {
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error(error?.message || "Failed to get transcription token");

      transcriptRef.current = "";

      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      // Start audio level monitoring
      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err: any) {
      console.error("Recording start failed:", err);
      toast({ title: "Recording failed", description: err.message || "Could not start recording", variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, toast]);

  const stopRecording = useCallback(() => {
    scribe.disconnect();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    analyserRef.current = null;
    setAudioLevel(0);
  }, [scribe]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const isRecording = scribe.isConnected;

  // Generate waveform bars
  const bars = 24;
  const waveformBars = Array.from({ length: bars }, (_, i) => {
    const center = bars / 2;
    const dist = Math.abs(i - center) / center;
    const height = isRecording ? Math.max(0.15, audioLevel * (1 - dist * 0.6) + Math.random() * 0.1) : 0.15;
    return height;
  });

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" /> Voice Capture
        </CardTitle>
        <CardDescription className="text-xs">
          Speak naturally in any language — English, Hindi, Telugu, Urdu
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Custom waveform visualizer */}
        <div className="flex items-center justify-center gap-[2px] h-12 px-4">
          {waveformBars.map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                isRecording ? "bg-primary" : "bg-muted-foreground/20"
              }`}
              style={{ height: `${h * 100}%`, minHeight: "4px" }}
            />
          ))}
        </div>

        {/* Recording controls */}
        <div className="flex gap-2">
          {!isRecording ? (
            <Button onClick={startRecording} size="sm" className="flex-1" disabled={disabled || isConnecting}>
              {isConnecting ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Connecting...</>
              ) : (
                <><Mic className="h-4 w-4 mr-1" /> Start Recording</>
              )}
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

        {isRecording && scribe.partialTranscript && (
          <div className="rounded-lg border bg-background p-2 text-sm text-muted-foreground italic">
            {scribe.partialTranscript}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
