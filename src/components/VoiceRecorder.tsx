import { useState, useCallback, useRef } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      // Show interim text in UI — don't commit to transcript yet
    },
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
      // Request mic permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get single-use token from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");

      if (error || !data?.token) {
        throw new Error(error?.message || "Failed to get transcription token");
      }

      transcriptRef.current = "";

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      console.error("Recording start failed:", err);
      toast({
        title: "Recording failed",
        description: err.message || "Could not start recording",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, toast]);

  const stopRecording = useCallback(() => {
    scribe.disconnect();
  }, [scribe]);

  const isRecording = scribe.isConnected;

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" /> Audio Capture
          <Badge variant="secondary" className="text-[10px] ml-auto">ElevenLabs Scribe</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Speak naturally in any language — English, Hindi, Telugu, Urdu
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
