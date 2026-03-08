import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarDays } from "lucide-react";

interface FollowUpPanelProps {
  followUpDate: string;
  onFollowUpDateChange: (date: string) => void;
  followUpNotes: string;
  onFollowUpNotesChange: (notes: string) => void;
}

export default function FollowUpPanel({ followUpDate, onFollowUpDateChange, followUpNotes, onFollowUpNotesChange }: FollowUpPanelProps) {
  return (
    <div className="space-y-2 px-0.5">
      <div>
        <Label className="text-[9px] text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-2.5 w-2.5" /> Follow-up Date
        </Label>
        <Input
          type="date"
          value={followUpDate}
          onChange={e => onFollowUpDateChange(e.target.value)}
          className="h-7 text-[11px]"
          min={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div>
        <Label className="text-[9px] text-muted-foreground">Instructions for Patient</Label>
        <Textarea
          value={followUpNotes}
          onChange={e => onFollowUpNotesChange(e.target.value)}
          placeholder="e.g. Return if fever persists beyond 3 days, avoid heavy lifting, repeat blood work before next visit…"
          rows={3}
          className="text-[11px] min-h-[48px] resize-y"
        />
      </div>
    </div>
  );
}
