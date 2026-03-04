import { useEffect, useState, useCallback } from 'react';
import { account, databases, DATABASE_ID, COLLECTIONS } from '@/services/appwrite';
import { Query } from 'appwrite';
import { useUIStore } from '@/stores/uiStore';
import { useSavedStore } from '@/stores/savedStore';
import { setAuthToken } from '@/api/client';

interface AppwriteUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  session: { userId: string } | null;
  user: AppwriteUser | null;
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
  requireAuth: () => boolean;
}

export type Auth = AuthState & AuthActions;

/** Refresh JWT and inject it into the API client */
async function refreshJWT() {
  try {
    const user = await account.get();
    if (!user?.$id) return;
    const jwt = await account.createJWT();
    if (jwt?.jwt) {
      setAuthToken(jwt.jwt);
    }
  } catch {
    setAuthToken(null);
  }
}

export function useAuth(): Auth {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const isGuest = useUIStore((s) => s.isGuest);
  const setGuest = useUIStore((s) => s.setGuest);

  const checkOnboarding = useCallback(async (userId: string) => {
    try {
      const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
        Query.equal('user_id', userId),
        Query.limit(1),
      ]);

      if (result.documents.length > 0) {
        const prefs = result.documents[0]!;
        setHasCompletedOnboarding(prefs['has_completed_onboarding'] ?? false);
        if (prefs['departure_city'] && prefs['departure_code']) {
          const store = useUIStore.getState();
          if (
            store.departureCity !== prefs['departure_city'] ||
            store.departureCode !== prefs['departure_code']
          ) {
            useUIStore.setState({
              departureCity: prefs['departure_city'] as string,
              departureCode: prefs['departure_code'] as string,
            });
          }
        }
      } else {
        setHasCompletedOnboarding(true);
      }
    } catch {
      setHasCompletedOnboarding(true);
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const appwriteUser = await account.get();
        if (cancelled) return;
        const u: AppwriteUser = {
          id: appwriteUser.$id,
          email: appwriteUser.email,
          name: appwriteUser.name,
        };
        setUser(u);
        setGuest(false);
        await refreshJWT();
        await checkOnboarding(u.id);
        useSavedStore.getState().syncFromServer(u.id);
      } catch {
        if (cancelled) return;
        setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [checkOnboarding, setGuest]);

  const signInWithGoogle = useCallback(async () => {
    const successUrl = window.location.origin;
    const failureUrl = `${window.location.origin}/login`;
    account.createOAuth2Session('google' as never, successUrl, failureUrl);
  }, []);

  const signInWithApple = useCallback(async () => {
    const successUrl = window.location.origin;
    const failureUrl = `${window.location.origin}/login`;
    account.createOAuth2Session('apple' as never, successUrl, failureUrl);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        await account.createEmailPasswordSession(email, password);
        const appwriteUser = await account.get();
        const u: AppwriteUser = {
          id: appwriteUser.$id,
          email: appwriteUser.email,
          name: appwriteUser.name,
        };
        setUser(u);
        setGuest(false);
        await refreshJWT();
        await checkOnboarding(u.id);
        useSavedStore.getState().syncFromServer(u.id);
        return { error: null };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Sign in failed';
        return { error: message };
      }
    },
    [checkOnboarding, setGuest],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        const { ID } = await import('appwrite');
        await account.create(ID.unique(), email, password);
        await account.createEmailPasswordSession(email, password);
        const appwriteUser = await account.get();
        const u: AppwriteUser = {
          id: appwriteUser.$id,
          email: appwriteUser.email,
          name: appwriteUser.name,
        };
        setUser(u);
        setGuest(false);
        await refreshJWT();
        setHasCompletedOnboarding(true);
        useSavedStore.getState().syncFromServer(u.id);
        return { error: null };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Sign up failed';
        return { error: message };
      }
    },
    [setGuest],
  );

  const signOut = useCallback(async () => {
    try {
      await account.deleteSession('current');
    } catch {
      // Session may already be gone
    }
    setUser(null);
    setGuest(false);
    setAuthToken(null);
    setHasCompletedOnboarding(false);
  }, [setGuest]);

  const browseAsGuest = useCallback(() => {
    setGuest(true);
  }, [setGuest]);

  const requireAuth = useCallback(() => {
    return user !== null;
  }, [user]);

  const session = user ? { userId: user.id } : null;

  return {
    session,
    user,
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
