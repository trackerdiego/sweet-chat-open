import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import { InstallBanner } from "@/components/InstallBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { AccessGuard } from "@/components/AccessGuard";
import { AutoCheckoutOpener } from "@/components/AutoCheckoutOpener";
import { PaywallScreen } from "@/components/PaywallScreen";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSubscription } from "@/hooks/useSubscription";
import Index from "./pages/Index";
import Matrix from "./pages/Matrix";
import Script from "./pages/Script";
import Tasks from "./pages/Tasks";
import Tools from "./pages/Tools";
import Wallet from "./pages/Wallet";
import Referral from "./pages/Referral";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";
import Help from "./pages/Help";
import Renew from "./pages/Renew";
import NotFound from "./pages/NotFound";
import { PixDueBanner } from "./components/PixDueBanner";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, needsOnboarding, loading } = useUserProfile();

  // Rotas públicas que precisam renderizar ANTES de qualquer guard de auth/onboarding/access.
  // Adicione aqui qualquer nova tela disparada por link de email do Supabase (recovery, invite, etc).
  const PUBLIC_AUTH_ROUTES = ['/reset-password'];

  if (typeof window !== 'undefined' && PUBLIC_AUTH_ROUTES.includes(window.location.pathname)) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }


  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (needsOnboarding) {
    return (
      <>
        <AutoCheckoutOpener />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/auth" element={<Navigate to="/onboarding" replace />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <PixDueBanner />
      <InstallBanner />
      <TrialBanner />
      <AutoCheckoutOpener />
      <Navigation />
      <AccessGuard>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Navigate to="/" replace />} />
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="/matriz" element={<Matrix />} />
          <Route path="/script" element={<Script />} />
          <Route path="/tarefas" element={<Tasks />} />
          <Route path="/ferramentas" element={<Tools />} />
          <Route path="/carteira" element={<Wallet />} />
          <Route path="/indique" element={<Referral />} />
          <Route path="/renovar" element={<Renew />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/ajuda" element={<Help />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AccessGuard>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
