import { useRef, useState, useCallback, useEffect } from "react";
import { Thermometer } from "lucide-react";

interface TemperatureSliderProps {
  value: number | null;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const TEMP_MIN = 96;
const TEMP_MAX = 106;
const TICK_STEP = 0.5;

export default function TemperatureSlider({ value, onChange, min = TEMP_MIN, max = TEMP_MAX, step = 0.1 }: TemperatureSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const ticks: number[] = [];
  for (let t = min; t <= max; t = Math.round((t + TICK_STEP) * 10) / 10) {
    ticks.push(t);
  }

  const currentVal = value ?? 98.6;
  const isFever = currentVal > 99;
  const isHighFever = currentVal >= 102;

  // Scroll to current value on mount
  useEffect(() => {
    if (scrollRef.current && value) {
      const idx = ticks.findIndex(t => t >= value);
      if (idx >= 0) {
        const tickWidth = 28; // approximate width per tick
        scrollRef.current.scrollLeft = Math.max(0, idx * tickWidth - scrollRef.current.clientWidth / 2);
      }
    }
  }, []);

  const handleTickClick = useCallback((temp: number) => {
    onChange(temp);
  }, [onChange]);

  const colorClass = isHighFever
    ? "text-destructive"
    : isFever
    ? "text-amber-500 dark:text-amber-400"
    : "text-primary";

  const bgClass = isHighFever
    ? "bg-destructive/10 border-destructive/30"
    : isFever
    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
    : "bg-background border-border";

  return (
    <div className={`rounded-lg border p-1.5 ${bgClass}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Thermometer className={`h-3 w-3 ${colorClass}`} />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase">Temperature</span>
        <span className={`text-[11px] font-bold ml-auto ${colorClass}`}>
          {value ? `${value}°F` : "—"}
        </span>
        {isFever && <span className="text-[8px] font-semibold text-destructive">FEVER</span>}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-0 overflow-x-auto scrollbar-hide cursor-pointer select-none"
        style={{ scrollBehavior: "smooth" }}
      >
        {ticks.map((t) => {
          const isSelected = value !== null && Math.abs(t - currentVal) < 0.25;
          const isMajor = t % 1 === 0;
          const tickFever = t > 99;
          const tickHigh = t >= 102;

          return (
            <button
              key={t}
              onClick={() => handleTickClick(t)}
              className={`flex flex-col items-center shrink-0 px-0.5 py-0.5 rounded transition-all ${
                isSelected
                  ? `${tickHigh ? "bg-destructive/20" : tickFever ? "bg-amber-100 dark:bg-amber-900/40" : "bg-primary/15"} scale-110`
                  : "hover:bg-muted/50"
              }`}
              style={{ minWidth: isMajor ? "24px" : "16px" }}
            >
              <div
                className={`w-0.5 rounded-full ${
                  isSelected
                    ? tickHigh ? "bg-destructive h-4" : tickFever ? "bg-amber-500 h-4" : "bg-primary h-4"
                    : isMajor
                    ? `h-3 ${tickFever ? "bg-amber-300 dark:bg-amber-700" : "bg-border"}`
                    : `h-1.5 ${tickFever ? "bg-amber-200 dark:bg-amber-800" : "bg-border/50"}`
                }`}
              />
              {isMajor && (
                <span className={`text-[7px] mt-0.5 ${
                  isSelected ? (tickHigh ? "text-destructive font-bold" : tickFever ? "text-amber-600 dark:text-amber-400 font-bold" : "text-primary font-bold") : "text-muted-foreground"
                }`}>
                  {t}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
