import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  LayoutDashboard, Building2, Users, BarChart3, ShieldAlert,
  FileText, LogOut, Shield
} from "lucide-react";

const navItems = [
  { label: "Overview", path: "/platform-admin", icon: LayoutDashboard },
  { label: "Pilot Requests", path: "/platform-admin/pilots", icon: Building2 },
  { label: "Users", path: "/platform-admin/users", icon: Users },
  { label: "Metrics", path: "/platform-admin/metrics", icon: BarChart3 },
  { label: "Safety Logs", path: "/platform-admin/safety", icon: ShieldAlert },
  { label: "Audit Trail", path: "/platform-admin/audit", icon: FileText },
];

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex flex-col w-56 border-r border-border bg-card shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={brainLogo} alt="DATAelixAIr" className="h-7 w-7" />
            <div>
              <p className="text-sm font-bold text-foreground leading-none">DATAelixAIr</p>
              <p className="text-[10px] text-destructive font-medium">Platform Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === item.path
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <div className="px-3 py-1">
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => { signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
