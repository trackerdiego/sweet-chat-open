import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

const SESSION_TOKEN_KEY = 'influlab_session_token';


export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  primary_niche: string;
  secondary_niches: string[];
  content_style: string;
  audience_size: string;
  onboarding_completed: boolean;
  description_status: 'pending' | 'ok';
  active_session_token?: string | null;
}

function getOrCreateSessionToken(): string {
  let token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

function isPreviewEnvironment(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch { return true; }
  const host = window.location.hostname;
  return host.includes('id-preview--') || host.includes('lovableproject.com');
}

export function useUserProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Safety timeout: if loading takes more than 10s, force it off
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[useUserProfile] Loading timeout — forcing loading=false');
          return false;
        }
        return prev;
      });
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
    });
    return () => {
      subscription.unsubscribe();
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (session?.user) {
      fetchProfile(session.user.id);
    } else {
      setProfile(null);
      setLoading(false);
      stopPolling();
    }
  }, [session, stopPolling]);

  const fetchProfile = async (userId: string) => {
    try {
      if (!profile) setLoading(true);
      let { data, error } = await (supabase.from as any)('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && !data) {
        const { data: newData } = await (supabase.from as any)('user_profiles')
          .upsert({
            user_id: userId,
            display_name: 'Creator',
            primary_niche: 'lifestyle',
            onboarding_completed: false,
            description_status: 'pending',
          }, { onConflict: 'user_id' })
          .select()
          .single();
        data = newData;
      }

      if (data) {
        let profileData = data as UserProfile;

        // Trava de integridade: se onboarding_completed=true mas não existe
        // matriz personalizada válida (>= 28 itens), corrige o flag para false
        // e força o usuário de volta ao onboarding. Evita estado inconsistente
        // que prendia o usuário no dashboard sem dados personalizados.
        if (profileData.onboarding_completed) {
          const { data: strat } = await (supabase.from as any)('user_strategies')
            .select('strategies')
            .eq('user_id', userId)
            .maybeSingle();
          const arr = strat?.strategies;
          const hasValidMatrix = Array.isArray(arr) && arr.length >= 28;
          if (!hasValidMatrix) {
            console.warn('[useUserProfile] onboarding_completed=true sem matriz válida — corrigindo para false');
            await (supabase.from as any)('user_profiles')
              .update({ onboarding_completed: false })
              .eq('user_id', userId);
            profileData = { ...profileData, onboarding_completed: false };
          }
        }

        setProfile(profileData);

        // Skip session token in preview/iframe to avoid kicking real devices.
        // ALSO skip while onboarding is not finished — rotating the token
        // mid-onboarding (e.g. user opened a 2nd tab) causes silent 401s
        // when handleFinish tries to write user_profiles.
        if (!isPreviewEnvironment() && profileData.onboarding_completed) {
          const token = getOrCreateSessionToken();
          await (supabase.from as any)('user_profiles')
            .update({ active_session_token: token })
            .eq('user_id', userId);

          // Start polling for session validity
          stopPolling();
          pollingRef.current = setInterval(async () => {
            const localToken = localStorage.getItem(SESSION_TOKEN_KEY);
            if (!localToken) return;
            const { data: check } = await (supabase.from as any)('user_profiles')
              .select('active_session_token')
              .eq('user_id', userId)
              .maybeSingle();
            if (check && check.active_session_token && check.active_session_token !== localToken) {
              localStorage.removeItem(SESSION_TOKEN_KEY);
              await supabase.auth.signOut();
              setSession(null);
              setProfile(null);
              toast.error('Sua conta foi acessada em outro dispositivo. Você foi desconectado.');
            }
          }, 30000);
        }
      }
    } catch (err) {
      console.error('[useUserProfile] fetchProfile error:', err);
      toast.error('Erro ao carregar perfil. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = useCallback(async (updates: Partial<Omit<UserProfile, 'id' | 'user_id'>>) => {
    if (!session?.user) return;
    const { data, error } = await (supabase.from as any)('user_profiles')
      .update(updates)
      .eq('user_id', session.user.id)
      .select()
      .single();
    if (!error && data) {
      setProfile(data as UserProfile);
    }
    return { data, error };
  }, [session]);

  const signOut = useCallback(async () => {
    stopPolling();
    localStorage.removeItem(SESSION_TOKEN_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, [stopPolling]);

  return {
    session,
    profile,
    loading,
    updateProfile,
    signOut,
    isAuthenticated: !!session,
    needsOnboarding: !!profile && !profile.onboarding_completed,
  };
}
