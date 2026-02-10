import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { useUIStore } from '../stores/uiStore';
import { captureException } from '../utils/sentry';
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

export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const initialEventHandled = useRef(false);

  // Guest mode from persisted uiStore
  const isGuest = useUIStore((s) => s.isGuest);
  const setGuest = useUIStore((s) => s.setGuest);

  // Check onboarding status when we get a session
  const checkOnboarding = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('has_completed_onboarding, departure_city, departure_code')
        .eq('user_id', userId)
        .single();

      if (error) {
        captureException(error, { context: 'checkOnboarding', userId });
        // Table may not exist yet — default to true to skip onboarding
        setHasCompletedOnboarding(true);
        return;
      }

      setHasCompletedOnboarding(data?.has_completed_onboarding ?? false);
      // Hydrate departure city from Supabase if set
      if (data?.departure_city && data?.departure_code) {
        const store = useUIStore.getState();
        if (store.departureCity !== data.departure_city || store.departureCode !== data.departure_code) {
          useUIStore.setState({ departureCity: data.departure_city, departureCode: data.departure_code });
        }
      }
    } catch (err) {
      captureException(err, { context: 'checkOnboarding.catch', userId });
      setHasCompletedOnboarding(true);
    }
  }, []);

  useEffect(() => {
    // Subscribe to auth changes FIRST (before getSession) to avoid race condition
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Skip the initial event since we handle it via getSession below
      if (!initialEventHandled.current) {
        initialEventHandled.current = true;
        return;
      }
      setSession(newSession);
      if (newSession) {
        setGuest(false);
        checkOnboarding(newSession.user.id);
      }
    });

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) {
        checkOnboarding(initialSession.user.id).then(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkOnboarding, setGuest]);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'sogojet://auth/callback',
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
          redirectTo: 'sogojet://auth/callback',
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
    setGuest(false);
    await supabase.auth.signOut();
  }, [setGuest]);

  const browseAsGuest = useCallback(() => {
    setGuest(true);
  }, [setGuest]);

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
