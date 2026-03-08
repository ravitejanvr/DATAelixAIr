import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Visit {
  id: string;
  check_in_time: string;
  visit_type: string | null;
  status: string;
  consultation_id: string | null;
}

interface VisitTimelineProps {
  patientId: string | null;
}

export default function VisitTimeline({ patientId }: VisitTimelineProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!patientId) { setVisits([]); return; }
    (async () => {
      const { data } = await supabase
        .from("patient_visits")
        .select("id, check_in_time, visit_type, status, consultation_id")
        .eq("patient_id", patientId)
        .order("check_in_time", { ascending: false })
        .limit(10);
      setVisits((data as Visit[]) || []);
    })();
  }, [patientId]);

  const toggleExpand = async (visit: Visit) => {
    if (expanded === visit.id) { setExpanded(null); return; }
    setExpanded(visit.id);
    if (!details[visit.id] && visit.consultation_id) {
      const { data } = await supabase
        .from("consultations")
        .select("chief_complaint, soap_assessment")
        .eq("id", visit.consultation_id)
        .maybeSingle();
      if (data) setDetails(prev => ({ ...prev, [visit.id]: `${data.chief_complaint || ""}${data.soap_assessment ? " — " + data.soap_assessment : ""}` }));
    }
  };

  if (!patientId) return <div className="text-[10px] text-muted-foreground px-2 py-1.5">Select a patient to view history</div>;
  if (visits.length === 0) return <div className="text-[10px] text-muted-foreground px-2 py-1.5">No previous visits</div>;

  return (
    <div className="space-y-0.5 max-h-32 overflow-y-auto">
      {visits.map(v => (
        <div key={v.id}>
          <button
            onClick={() => toggleExpand(v)}
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/50 transition-colors text-left"
          >
            {expanded === v.id ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
            <Calendar className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-medium text-foreground">{format(new Date(v.check_in_time), "dd MMM yyyy")}</span>
            <span className="text-[9px] text-muted-foreground capitalize truncate">{v.visit_type || "general"}</span>
            <Badge variant="outline" className="text-[8px] ml-auto capitalize">{v.status}</Badge>
          </button>
          {expanded === v.id && details[v.id] && (
            <div className="ml-6 px-2 py-1 text-[10px] text-muted-foreground border-l border-border">
              {details[v.id]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
