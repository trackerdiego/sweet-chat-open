import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  primary_niche: string;
  secondary_niches: string[];
  content_style: string;
  audience_size: string;
  onboarding_completed: boolean;
}

export function useUserProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchProfile(session.user.id);
    } else {
      setProfile(null);
      setLoading(false);
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
        }, { onConflict: 'user_id' })
        .select()
        .single();
      data = newData;
    }

    if (data) {
      setProfile(data as UserProfile);
    }
    setLoading(false);
  };

  const updateProfile = useCallback(async (updates: Partial<Omit<UserProfile, 'id' | 'user_id'>>) => {
    if (!session?.user) return;
    
    const { data, error } = await (supabase.from as any)('user_profiles')
      .upsert({
        user_id: session.user.id,
        display_name: updates.display_name || profile?.display_name || 'Creator',
        primary_niche: updates.primary_niche || profile?.primary_niche || 'lifestyle',
        ...updates,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (!error && data) {
      setProfile(data as UserProfile);
    }
    return { data, error };
  }, [session, profile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

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
