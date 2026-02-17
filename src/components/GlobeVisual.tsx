import { motion } from "framer-motion";

const GlobeVisual = () => (
  <div className="dark-card border rounded-3xl p-9 text-center">
    <p className="text-xs font-medium uppercase tracking-[0.08em] text-dark-muted mb-6">
      UK & Global Healthcare
    </p>

    {/* Globe rings */}
    <div className="relative w-[220px] h-[220px] mx-auto mb-6">
      <div className="absolute inset-0 rounded-full border-[1.5px] border-primary/30 animate-spin">
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary-light shadow-[0_0_8px_hsl(var(--teal))]" />
        <div className="absolute bottom-5 right-5 w-2.5 h-2.5 rounded-full bg-primary-light shadow-[0_0_8px_hsl(var(--teal))]" />
        <div className="absolute top-1/2 left-[5px] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary-light shadow-[0_0_8px_hsl(var(--teal))]" />
      </div>
      <div className="absolute inset-[30px] rounded-full border-[1.5px] border-dashed border-primary/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[90px] h-[90px] rounded-full bg-gradient-to-br from-primary-light to-primary flex items-center justify-center text-4xl animate-spin-rev">
          🌐
        </div>
      </div>
    </div>

    {/* Stats — verified from deck */}
    <div className="flex justify-around">
      {[
        { val: "7,000+", label: "GP Practices" },
        { val: "200+", label: "NHS Trusts" },
        { val: "24/7", label: "Support" },
      ].map((s) => (
        <div key={s.label}>
          <div className="font-display text-2xl font-bold text-primary">{s.val}</div>
          <div className="text-xs text-dark-muted/60 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  </div>
);

export default GlobeVisual;
