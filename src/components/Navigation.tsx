import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Grid3X3, FileText, Trophy, Wrench, Settings, RefreshCw, Lock, Bell, BellOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserUsage } from '@/hooks/useUserUsage';
import { CheckoutModal } from '@/components/CheckoutModal';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/matriz', icon: Grid3X3, label: 'Matriz' },
  { to: '/script', icon: FileText, label: 'Script' },
  { to: '/ferramentas', icon: Wrench, label: 'Tools' },
  { to: '/tarefas', icon: Trophy, label: 'Tarefas' },
];

export function Navigation() {
  const { updateProfile, session } = useUserProfile();
  const navigate = useNavigate();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { isPremium } = useUserUsage();
  const isAdmin = session?.user?.email === 'agentevendeagente@gmail.com';
  const { isSupported, isSubscribed, isLoading, isStandalone, subscribe, unsubscribe } = usePushNotifications();

  const handleResetNiche = async () => {
    await updateProfile({ onboarding_completed: false });
    navigate('/onboarding', { replace: true });
  };

  const handleNotificationToggle = async () => {
    if (!isSupported) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && !isStandalone) {
        toast.info('Para ativar notificações, abra o app pela tela de início do iPhone', { duration: 5000 });
      } else {
        toast.error('Seu navegador não suporta notificações push');
      }
      return;
    }

    if (isSubscribed) {
      await unsubscribe();
      toast.success('Notificações desativadas');
      return;
    }

    const result = await subscribe();

    if (result.ok) {
      toast.success('Notificações ativadas! 🔔');
      return;
    }

    // Contextual error messages
    switch (result.reason) {
      case 'permission_denied':
        toast.error('Permissão negada. Vá em Ajustes > Safari > Notificações e habilite para este app.', { duration: 6000 });
        break;
      case 'sw_not_ready':
        toast.info('O sistema ainda está inicializando. Aguarde alguns segundos e tente novamente.', { duration: 5000 });
        break;
      case 'db_save_failed':
        toast.error('Erro ao salvar dispositivo. Tente novamente em instantes.');
        break;
      case 'not_supported': {
        const inPreview = window.location.hostname.includes('id-preview--') ||
          window.location.hostname.includes('lovableproject.com') ||
          (() => { try { return window.self !== window.top; } catch { return true; } })();
        if (inPreview) {
          toast.info('Notificações push funcionam apenas na versão publicada ou no app instalado', { duration: 5000 });
        } else {
          toast.error('Seu navegador não suporta notificações push');
        }
        break;
      }
      default:
        toast.error('Não foi possível ativar as notificações. Tente novamente.');
        break;
    }
  };

  return (
    <>
      <motion.nav
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-2 py-2 pb-[env(safe-area-inset-bottom)] md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-2 md:pt-[env(safe-area-inset-top)]"
      >
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 text-xs font-medium ${
                  isActive
                    ? 'text-primary-foreground gold-gradient shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 text-xs font-medium ${
                  isActive
                    ? 'text-primary-foreground gold-gradient shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <ShieldCheck size={20} />
              <span>Admin</span>
            </NavLink>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 text-xs font-medium text-muted-foreground hover:text-foreground">
              <Settings size={20} />
              <span>Config</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={8} className="mb-2">
              <DropdownMenuItem
                onClick={handleNotificationToggle}
                disabled={isLoading}
                className="gap-2"
              >
                {isSubscribed ? <Bell size={16} className="text-primary" /> : <BellOff size={16} />}
                {isSubscribed ? 'Desativar notificações' : 'Ativar notificações'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => isPremium ? setShowResetDialog(true) : setCheckoutOpen(true)} className="gap-2">
                {isPremium ? <RefreshCw size={16} /> : <Lock size={16} />}
                Redefinir perfil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.nav>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai regenerar sua matriz de conteúdo e perfil de público com base na nova descrição. Seu progresso e streak serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetNiche}>Redefinir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}
