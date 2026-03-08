import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Stethoscope, Users, Pill, FlaskConical, Activity,
  LayoutDashboard, ListOrdered, ClipboardCheck, FileInput,
  Receipt, Search, FileText, User,
} from "lucide-react";

interface CommandPaletteProps {
  onNavigateClinical?: (state?: any) => void;
}

const NAVIGATION_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { label: "Patient Queue", path: "/queue", icon: ListOrdered, keywords: "queue waiting list" },
  { label: "Clinical Workspace", path: "/clinical", icon: Stethoscope, keywords: "consultation write record" },
  { label: "Patients", path: "/patients", icon: Users, keywords: "patient list search" },
  
  { label: "Vitals Entry", path: "/vitals", icon: Activity, keywords: "bp temperature pulse" },
  { label: "Triage", path: "/triage", icon: ClipboardCheck, keywords: "priority complaint" },
  { label: "Intake", path: "/intake", icon: FileInput, keywords: "intake form" },
  { label: "Prescriptions", path: "/prescriptions", icon: Pill, keywords: "rx medication drug" },
  { label: "Billing", path: "/billing", icon: Receipt, keywords: "invoice payment" },
];

const QUICK_ACTIONS = [
  { label: "Start New Consultation", action: "new-consultation", icon: Stethoscope, keywords: "start begin consult" },
  { label: "Add Prescription", action: "add-rx", icon: Pill, keywords: "rx drug medication prescribe" },
  { label: "Order Lab Test", action: "order-lab", icon: FlaskConical, keywords: "lab test order cbc" },
  { label: "Generate Report", action: "report", icon: FileText, keywords: "report generate pdf" },
];

const COMMON_DRUGS = [
  "Paracetamol 650mg", "Azithromycin 500mg", "Amoxicillin 500mg",
  "Cetirizine 10mg", "Pantoprazole 40mg", "Ibuprofen 400mg",
  "Dolo 650", "Crocin", "Augmentin 625", "Metformin 500mg",
];

const COMMON_LABS = [
  "CBC", "LFT", "RFT", "Thyroid Profile", "HbA1c", "Lipid Profile",
  "Dengue NS1", "Malaria Antigen", "Urine Routine", "Blood Sugar Fasting",
];

export default function CommandPalette({ onNavigateClinical }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<{ id: string; name: string; age: number | null; gender: string | null }[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Patient search
  useEffect(() => {
    if (!user || query.length < 3) { setPatients([]); return; }
    const timeout = setTimeout(async () => {
      setSearchingPatients(true);
      const { data } = await supabase
        .from("patients")
        .select("id, name, age, gender")
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);
      setPatients(data || []);
      setSearchingPatients(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, user]);

  const handleSelect = useCallback((callback: () => void) => {
    setOpen(false);
    setQuery("");
    callback();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search patients, medications, labs, or navigate…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searchingPatients ? "Searching…" : "No results found. Try a different search."}
        </CommandEmpty>

        {/* Patients */}
        {patients.length > 0 && (
          <CommandGroup heading="Patients">
            {patients.map(p => (
              <CommandItem
                key={p.id}
                value={`patient-${p.name}`}
                onSelect={() => handleSelect(() => navigate(`/patients/${p.id}`))}
              >
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{p.name}</span>
                {(p.age || p.gender) && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {[p.age && `${p.age}y`, p.gender].filter(Boolean).join(" · ")}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {QUICK_ACTIONS.map(item => (
            <CommandItem
              key={item.action}
              value={`action-${item.label} ${item.keywords}`}
              onSelect={() => handleSelect(() => {
                if (item.action === "new-consultation") navigate("/clinical");
                else if (item.action === "add-rx") navigate("/clinical");
                else if (item.action === "order-lab") navigate("/clinical");
                else if (item.action === "report") navigate("/clinical");
              })}
            >
              <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Common Medications */}
        {query.length >= 2 && (
          <CommandGroup heading="Medications">
            {COMMON_DRUGS.filter(d => d.toLowerCase().includes(query.toLowerCase())).map(drug => (
              <CommandItem
                key={drug}
                value={`drug-${drug}`}
                onSelect={() => handleSelect(() => {
                  navigate("/clinical");
                })}
              >
                <Pill className="h-4 w-4 mr-2 text-chip-medication-text" />
                <span>{drug}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Common Labs */}
        {query.length >= 2 && (
          <CommandGroup heading="Lab Tests">
            {COMMON_LABS.filter(l => l.toLowerCase().includes(query.toLowerCase())).map(lab => (
              <CommandItem
                key={lab}
                value={`lab-${lab}`}
                onSelect={() => handleSelect(() => {
                  navigate("/clinical");
                })}
              >
                <FlaskConical className="h-4 w-4 mr-2 text-chip-lab-text" />
                <span>{lab}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigate">
          {NAVIGATION_ITEMS.map(item => (
            <CommandItem
              key={item.path}
              value={`nav-${item.label} ${item.keywords}`}
              onSelect={() => handleSelect(() => navigate(item.path))}
            >
              <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{item.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">{item.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
