import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  hasCompletedOnboarding: boolean;
}

interface AuthActions {
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  browseAsGuest: () => void;
  /** Returns true if user has a real session (not guest) */
  requireAuth: () => boolean;
}

export type Auth = AuthState & AuthActions;

// Guest mode flag persisted in memory (resets on app restart)
let guestMode = false;

export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Check onboarding status when we get a session
  const checkOnboarding = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('has_completed_onboarding')
        .eq('user_id', userId)
        .single();
      setHasCompletedOnboarding(data?.has_completed_onboarding ?? false);
    } catch {
      // Table may not exist yet if Supabase isn't set up — default to true to skip onboarding
      setHasCompletedOnboarding(true);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkOnboarding(session.user.id).then(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setIsGuest(false);
        guestMode = false;
        checkOnboarding(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkOnboarding]);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
    } else {
      // Native: use deep link redirect
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'swypefly://auth/callback',
        },
      });
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS === 'web') {
      await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'swypefly://auth/callback',
        },
      });
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    guestMode = false;
    setIsGuest(false);
    await supabase.auth.signOut();
  }, []);

  const browseAsGuest = useCallback(() => {
    guestMode = true;
    setIsGuest(true);
  }, []);

  const requireAuth = useCallback(() => {
    return session !== null;
  }, [session]);

  return {
    session,
    user: session?.user ?? null,
    isLoading,
    isGuest,
    hasCompletedOnboarding,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    browseAsGuest,
    requireAuth,
  };
}
