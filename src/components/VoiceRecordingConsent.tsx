import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mic, ShieldCheck, Eye } from "lucide-react";

const CONSENT_KEY = "voice_recording_consent_v1";

interface VoiceRecordingConsentProps {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
}

export default function VoiceRecordingConsent({ open, onConsent, onDecline }: VoiceRecordingConsentProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <Mic className="h-5 w-5 text-primary" />
            Voice Recording Consent
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This consultation uses voice recording to help your doctor create accurate clinical notes.
              </p>
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Your recording is processed securely and used <strong className="text-foreground">only</strong> for this consultation.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Eye className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>AI assists with transcription and note structuring. Your doctor reviews and approves all outputs.</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/70">
                You can stop recording at any time. Raw audio is not stored — only the text transcript is kept in your clinical record.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDecline}>Decline</AlertDialogCancel>
          <AlertDialogAction onClick={onConsent}>I Consent to Recording</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Check if user has already consented this session */
export function hasVoiceConsent(): boolean {
  return sessionStorage.getItem(CONSENT_KEY) === "true";
}

/** Mark consent granted for this session */
export function setVoiceConsent(): void {
  sessionStorage.setItem(CONSENT_KEY, "true");
}
