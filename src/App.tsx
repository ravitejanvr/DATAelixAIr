import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConsentProvider } from "@/contexts/ConsentContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "./components/Layout";
import ClinicalLayout from "./components/ClinicalLayout";
import PlatformAdminLayout from "./components/PlatformAdminLayout";
import ScrollToTop from "./components/ScrollToTop";

// Marketing pages
import Index from "./pages/Index";
import Vision from "./pages/Vision";
import Blog from "./pages/Blog";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

// Auth
import Auth from "./pages/Auth";
import Onboard from "./pages/Onboard";
import Unauthorized from "./pages/Unauthorized";
import AwaitingApproval from "./pages/AwaitingApproval";
import ResetPassword from "./pages/ResetPassword";

// Clinical app pages
import Dashboard from "./pages/Dashboard";
import Clinical from "./pages/Clinical";
import Patients from "./pages/Patients";
import Reports from "./pages/Reports";
import PatientDetail from "./pages/PatientDetail";
import Prescriptions from "./pages/Prescriptions";
import ConsultationDetail from "./pages/ConsultationDetail";
import PatientPortal from "./pages/PatientPortal";
import Vitals from "./pages/Vitals";
import Billing from "./pages/Billing";
import ClinicAdmin from "./pages/ClinicAdmin";

import Triage from "./pages/Triage";
import Intake from "./pages/Intake";
import PatientQueue from "./pages/PatientQueue";
import PatientSelfIntake from "./pages/PatientSelfIntake";
import QRVisitRegistration from "./pages/QRVisitRegistration";
import FrontDesk from "./pages/FrontDesk";
import VisitJourney from "./pages/VisitJourney";
import VisitStatus from "./pages/VisitStatus";
import ReportPreview from "./pages/ReportPreview";

// Platform admin
import PlatformAdmin from "./pages/PlatformAdmin";
import PilotRequest from "./pages/PilotRequest";

const queryClient = new QueryClient();

import { CLINICAL_ROLES, getDefaultRouteForRole } from "@/layers/governance/api";
import type { AppRole } from "@/layers/governance/api";

function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setAccountStatus(null); setRoleLoading(false); return; }

    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
      supabase.from("profiles").select("account_status").eq("user_id", user.id).maybeSingle(),
    ]).then(([roleRes, profileRes]) => {
      setRole(roleRes.data?.[0]?.role || null);
      setAccountStatus((profileRes.data as any)?.account_status || "pending");
      setRoleLoading(false);
    });
  }, [user, authLoading]);

  return { role, accountStatus, loading: authLoading || roleLoading, user };
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { role, accountStatus, loading, user } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Platform admins bypass approval check
  if (role !== "platform_admin" && accountStatus !== "approved") {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (allowedRoles && !role) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

function AuthRedirect() {
  const { role, accountStatus, loading, user } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Auth />;

  // Platform admins bypass approval
  if (role === "platform_admin") return <Navigate to="/platform-admin" replace />;

  // Non-approved users go to waiting page
  if (accountStatus !== "approved") return <Navigate to="/awaiting-approval" replace />;

  const targetRoute = getDefaultRouteForRole(role as AppRole | null);
  return <Navigate to={targetRoute} replace />;
}

const clinicalRoles: string[] = [...CLINICAL_ROLES];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ConsentProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              {/* Auth */}
              <Route path="/auth" element={<AuthRedirect />} />
              <Route path="/onboard" element={<Onboard />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/awaiting-approval" element={<AwaitingApproval />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Patient self-intake & QR registration (public, no auth) */}
              <Route path="/patient-intake/:visitId" element={<PatientSelfIntake />} />
              <Route path="/register" element={<QRVisitRegistration />} />
              <Route path="/visit-journey/:visitId" element={<VisitJourney />} />
              <Route path="/visit-status/:visitId" element={<VisitStatus />} />
              <Route path="/report-preview" element={<ReportPreview />} />

              {/* Layer 2: Clinical App — wrapped in ClinicalLayout */}
              <Route path="/dashboard" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><Dashboard /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/clinical" element={<ProtectedRoute allowedRoles={["doctor", "clinic_admin"]}><ClinicalLayout><Clinical /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/patients" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><Patients /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><Reports /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/patients/:id" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><PatientDetail /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/prescriptions" element={<ProtectedRoute allowedRoles={["doctor", "pharmacist", "clinic_admin"]}><ClinicalLayout><Prescriptions /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/consultations/:id" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><ConsultationDetail /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/vitals" element={<ProtectedRoute allowedRoles={["nurse", "doctor", "clinic_admin"]}><ClinicalLayout><Vitals /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/triage" element={<ProtectedRoute allowedRoles={["nurse", "doctor", "clinic_admin", "receptionist"]}><ClinicalLayout><Triage /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/intake" element={<ProtectedRoute allowedRoles={["nurse", "doctor", "clinic_admin", "receptionist", "front_desk"]}><ClinicalLayout><Intake /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute allowedRoles={["doctor", "receptionist", "clinic_admin"]}><ClinicalLayout><Billing /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/clinic-settings" element={<ProtectedRoute allowedRoles={["doctor", "clinic_admin"]}><ClinicalLayout><ClinicAdmin /></ClinicalLayout></ProtectedRoute>} />
              
              {/* Queue route aliases (prevents 404 from older navigation paths) */}
              <Route path="/patient-queue" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><PatientQueue /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/queue" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><PatientQueue /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/front-desk" element={<ProtectedRoute allowedRoles={["front_desk", "receptionist", "clinic_admin", "doctor"]}><ClinicalLayout><FrontDesk /></ClinicalLayout></ProtectedRoute>} />
              <Route path="/patient-portal" element={<ProtectedRoute allowedRoles={["patient"]}><PatientPortal /></ProtectedRoute>} />
              <Route path="/pilot-request" element={<ProtectedRoute allowedRoles={clinicalRoles}><ClinicalLayout><PilotRequest /></ClinicalLayout></ProtectedRoute>} />

              {/* Layer 3: Platform Admin — wrapped in PlatformAdminLayout */}
              <Route path="/platform-admin" element={<ProtectedRoute allowedRoles={["platform_admin"]}><PlatformAdminLayout><PlatformAdmin /></PlatformAdminLayout></ProtectedRoute>} />
              <Route path="/platform-admin/*" element={<ProtectedRoute allowedRoles={["platform_admin"]}><PlatformAdminLayout><PlatformAdmin /></PlatformAdminLayout></ProtectedRoute>} />

              {/* Layer 1: Marketing site */}
              <Route path="/" element={<Layout><Index /></Layout>} />
              <Route path="/vision" element={<Layout><Vision /></Layout>} />
              <Route path="/blog" element={<Layout><Blog /></Layout>} />
              <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
              <Route path="/terms" element={<Layout><Terms /></Layout>} />
              <Route path="/contact" element={<Layout><Contact /></Layout>} />

              {/* Redirects */}
              <Route path="/admin" element={<Navigate to="/platform-admin" replace />} />
              <Route path="/services" element={<Navigate to="/#product" replace />} />
              <Route path="/services/:slug" element={<Navigate to="/#product" replace />} />
              <Route path="/solutions" element={<Navigate to="/#product" replace />} />
              <Route path="/solutions/:slug" element={<Navigate to="/#product" replace />} />
              <Route path="/explainable-ai" element={<Navigate to="/vision" replace />} />
              <Route path="/clinic-locator" element={<Navigate to="/" replace />} />
              <Route path="/pricing" element={<Navigate to="/contact" replace />} />
              <Route path="/affiliate" element={<Navigate to="/" replace />} />

              <Route path="*" element={<Layout><NotFound /></Layout>} />
            </Routes>
          </BrowserRouter>
        </ConsentProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
