import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export function PushNotificationButton() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success('Notificações desativadas');
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Notificações ativadas! 🔔');
      } else {
        toast.error('Não foi possível ativar as notificações');
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isLoading}
      className="relative"
      title={isSubscribed ? 'Desativar notificações' : 'Ativar notificações'}
    >
      {isSubscribed ? <Bell size={20} className="text-primary" /> : <BellOff size={20} />}
      {isSubscribed && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
    </Button>
  );
}
