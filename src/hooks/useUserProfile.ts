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

export function useUserProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate or retrieve session token
  const getOrCreateSessionToken = useCallback(() => {
    let token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
  }, []);

  // Register session token in the database
  const registerSessionToken = useCallback(async (userId: string) => {
    const token = getOrCreateSessionToken();
    await (supabase.from as any)('user_profiles')
      .update({ active_session_token: token })
      .eq('user_id', userId);
    return token;
  }, [getOrCreateSessionToken]);

  // Check if current session is still valid
  const checkSessionValidity = useCallback(async (userId: string) => {
    const localToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!localToken) return;

    const { data } = await (supabase.from as any)('user_profiles')
      .select('active_session_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && data.active_session_token && data.active_session_token !== localToken) {
      // Another device took the session
      localStorage.removeItem(SESSION_TOKEN_KEY);
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      toast.error('Sua conta foi acessada em outro dispositivo. Você foi desconectado.');
    }
  }, []);

  // Start polling
  const startPolling = useCallback((userId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      checkSessionValidity(userId);
    }, 30000);
  }, [checkSessionValidity]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
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
  }, [session]);

  const fetchProfile = async (userId: string) => {
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
      setProfile(data as UserProfile);
      // Register session token and start polling
      await registerSessionToken(userId);
      startPolling(userId);
    }
    setLoading(false);
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
