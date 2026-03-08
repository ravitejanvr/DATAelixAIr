import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import CommandPalette from "@/components/CommandPalette";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  LayoutDashboard, Stethoscope, Users, Pill, Activity,
  Receipt, LogOut, Menu, X, Globe, ClipboardList, ClipboardCheck, FileInput, ListOrdered,
  Search, Settings
} from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Queue", path: "/queue", icon: ListOrdered },
  { label: "Write / Record", path: "/clinical", icon: Stethoscope },
  { label: "Patients", path: "/patients", icon: Users },
  { label: "Visit Tracker", path: "/visit-tracker", icon: ClipboardList },
  { label: "Triage", path: "/triage", icon: ClipboardCheck },
  { label: "Intake", path: "/intake", icon: FileInput },
  { label: "Vitals", path: "/vitals", icon: Activity },
  { label: "Prescriptions", path: "/prescriptions", icon: Pill },
  { label: "Billing", path: "/billing", icon: Receipt },
];

export default function ClinicalLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Global Command Palette */}
      <CommandPalette />

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-border bg-card shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={brainLogo} alt="DATAelixAIr" className="h-7 w-7" />
            <div>
              <p className="text-sm font-bold text-foreground leading-none">DATAelixAIr</p>
              <p className="text-[10px] text-muted-foreground">Clinical Workspace</p>
            </div>
          </div>
        </div>

        {/* Search trigger */}
        <div className="px-3 pt-3">
          <button
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
              window.dispatchEvent(event);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground bg-muted/50 hover:bg-muted border border-border/50 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Search…</span>
            <kbd className="ml-auto text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                location.pathname === item.path
                  ? "bg-primary/10 text-primary font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <button onClick={() => navigate("/")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
            <Globe className="h-4 w-4" /> ← Website
          </button>
          <div className="px-3 py-1"><p className="text-[10px] text-muted-foreground truncate">{user?.email}</p></div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => { signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={brainLogo} alt="DATAelixAIr" className="h-6 w-6" />
          <span className="text-sm font-bold text-foreground">DATAelixAIr</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
              window.dispatchEvent(event);
            }}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50"
          >
            <Search className="h-4 w-4" />
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div className="w-64 h-full bg-card border-r border-border p-4 pt-16 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                    location.pathname === item.path ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-6 pt-4 border-t border-border space-y-2">
              <button onClick={() => { navigate("/"); setSidebarOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50">
                <Globe className="h-4 w-4" /> ← Website
              </button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { signOut(); navigate("/auth"); }}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 lg:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
