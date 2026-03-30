import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BABwZ141awYJTd606MI2vcDLQ8Zma2NwptLkaMbF_CA57z2H7LfgJsyIS3-Oz8GuteLiwJlG8l5kOv9moAErz3E';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const standalone = (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    const supported = hasSW && (hasPush || hasNotification);

    console.log('[push] Detection:', { hasSW, hasPush, hasNotification, standalone, supported });
    setIsSupported(supported);

    if (supported) {
      navigator.serviceWorker.ready
        .then((reg) => {
          console.log('[push] SW ready:', reg.scope);
          setRegistration(reg);
          return reg.pushManager.getSubscription();
        })
        .then((sub) => {
          setIsSubscribed(!!sub);
        })
        .catch((err) => console.error('[push] SW ready failed:', err));
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration) return false;
    setIsLoading(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[push] Permission denied');
        setIsLoading(false);
        return false;
      }

      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        console.log('[push] Unsubscribing old subscription before re-subscribing');
        await existingSub.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const subJson = subscription.toJSON();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return false;
      }

      const { error } = await (supabase.from as any)('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
        { onConflict: 'endpoint' }
      );

      if (error) {
        console.error('[push] Failed to save subscription:', error);
        setIsLoading(false);
        return false;
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('[push] Subscribe error:', err);
      setIsLoading(false);
      return false;
    }
  }, [registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    setIsLoading(true);

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await (supabase.from as any)('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('[push] Unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [registration]);

  return { isSupported, isSubscribed, isLoading, isStandalone, subscribe, unsubscribe };
}
