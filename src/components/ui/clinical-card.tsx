import * as React from "react";
import { cn } from "@/lib/utils";

interface ClinicalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function ClinicalCard({ children, className, noPadding, ...props }: ClinicalCardProps) {
  return (
    <div className={cn("glass-card rounded-md border p-3 transition-all duration-200", noPadding && "p-0", className)} {...props}>
      {children}
    </div>
  );
}

interface ClinicalCardHeaderProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function ClinicalCardHeader({ title, icon, badge, action, className }: ClinicalCardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-3", className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        {badge}
      </div>
      {action}
    </div>
  );
}

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div className={cn("clinical-card animate-pulse", className)}>
      <div className="h-4 w-24 bg-muted rounded mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-muted rounded mb-2" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  );
}