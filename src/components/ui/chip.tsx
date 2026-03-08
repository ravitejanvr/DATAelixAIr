import * as React from "react";
import { cn } from "@/lib/utils";
import { X, Plus, Check } from "lucide-react";

export type ChipVariant = "symptom" | "diagnosis" | "medication" | "lab" | "alert" | "neutral" | "action" | "status";

interface ChipProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  selected?: boolean;
  removable?: boolean;
  addable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  disabled?: boolean;
}

const variantClasses: Record<ChipVariant, string> = {
  symptom: "chip-symptom",
  diagnosis: "chip-diagnosis",
  medication: "chip-medication",
  lab: "chip-lab",
  alert: "chip-alert",
  neutral: "chip-neutral",
  action: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
  status: "bg-secondary text-secondary-foreground border-border",
};

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(({
  children,
  variant = "neutral",
  selected,
  removable,
  addable,
  onClick,
  onRemove,
  className,
  size = "md",
  icon,
  disabled,
}, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "chip",
        variantClasses[variant],
        selected && "chip-selected",
        size === "sm" && "px-2 py-1 text-[10px]",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {selected && <Check className="h-3 w-3" />}
      {addable && !selected && <Plus className="h-3 w-3" />}
      {icon}
      <span>{children}</span>
      {removable && (
        <X
          className="h-3 w-3 ml-0.5 hover:opacity-70 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
        />
      )}
    </button>
  );
});
Chip.displayName = "Chip";

interface ChipGroupProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function ChipGroup({ children, label, className }: ChipGroupProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

interface PresetChipGroupProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  variant?: ChipVariant;
  allowCustom?: boolean;
}

export function PresetChipGroup({
  label,
  options,
  selected,
  onToggle,
  variant = "neutral",
  allowCustom = false,
}: PresetChipGroupProps) {
  const [customValue, setCustomValue] = React.useState("");

  return (
    <ChipGroup label={label}>
      {options.map((opt) => (
        <Chip
          key={opt}
          variant={variant}
          selected={selected.includes(opt)}
          onClick={() => onToggle(opt)}
        >
          {opt}
        </Chip>
      ))}
      {allowCustom && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customValue.trim()) {
                onToggle(customValue.trim());
                setCustomValue("");
              }
            }}
            placeholder="+Add"
            className="h-7 px-2 text-[11px] rounded-full border border-border bg-background w-20 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      )}
    </ChipGroup>
  );
}