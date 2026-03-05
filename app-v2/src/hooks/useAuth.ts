import { useEffect, useState, useCallback } from 'react';
import { useUser, useAuth as useClerkAuth, useSignIn, useSignUp } from '@clerk/clerk-react';
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
  signInWithTikTok: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsVerification?: boolean }>;
  verifyEmail: (code: string) => Promise<{ error: string | null }>;
  resendVerification: () => Promise<{ error: string | null }>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (code: string, newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  browseAsGuest: () => void;
  requireAuth: () => boolean;
}

export type Auth = AuthState & AuthActions;

export function useAuth(): Auth {
  const { isSignedIn, isLoaded, userId, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const isGuest = useUIStore((s) => s.isGuest);
  const setGuest = useUIStore((s) => s.setGuest);

  // Map Clerk user to our interface
  const user: AppwriteUser | null =
    isSignedIn && clerkUser
      ? {
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
          name: clerkUser.fullName ?? clerkUser.firstName ?? '',
        }
      : null;

  const session = user ? { userId: user.id } : null;

  // Keep API client token in sync with Clerk session
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      getToken().then((token) => {
        setAuthToken(token);
        setTokenReady(true);
      });
      setGuest(false);
    } else {
      setAuthToken(null);
      setTokenReady(true);
    }
  }, [isLoaded, isSignedIn, getToken, setGuest]);

  // Re-fetch token on 401 from any API call
  useEffect(() => {
    const handler = () => {
      if (isSignedIn) {
        getToken({ skipCache: true }).then((t) => setAuthToken(t));
      }
    };
    window.addEventListener('sogojet:auth-expired', handler);
    return () => window.removeEventListener('sogojet:auth-expired', handler);
  }, [isSignedIn, getToken]);

  // Onboarding state is persisted locally in uiStore
  const checkOnboarding = useCallback(async () => {
    const { hasOnboarded } = useUIStore.getState();
    setHasCompletedOnboarding(hasOnboarded);
    setOnboardingChecked(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || onboardingChecked) return;
    checkOnboarding();
    useSavedStore.getState().syncFromServer();
  }, [isLoaded, isSignedIn, userId, onboardingChecked, checkOnboarding]);

  // OAuth sign-ins via Clerk redirect
  const signInWithGoogle = useCallback(async () => {
    if (!signIn) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err) {
      console.error('[auth] Google sign-in failed:', err);
    }
  }, [signIn]);

  const signInWithApple = useCallback(async () => {
    if (!signIn) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_apple',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err) {
      console.error('[auth] Apple sign-in failed:', err);
    }
  }, [signIn]);

  const signInWithTikTok = useCallback(async () => {
    if (!signIn) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_tiktok',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err) {
      console.error('[auth] TikTok sign-in failed:', err);
    }
  }, [signIn]);

  // Email sign-in
  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!signIn) return { error: 'Auth not ready' };
      try {
        const result = await signIn.create({ identifier: email, password });
        if (result.status === 'complete') {
          return { error: null };
        }
        return { error: 'Additional verification required' };
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'errors' in err
            ? (err as { errors: { message: string }[] }).errors[0]?.message ?? 'Sign in failed'
            : err instanceof Error
              ? err.message
              : 'Sign in failed';
        return { error: message };
      }
    },
    [signIn],
  );

  // Email sign-up
  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!signUp) return { error: 'Auth not ready' };
      try {
        const result = await signUp.create({ emailAddress: email, password });
        if (result.status === 'complete') {
          return { error: null };
        }
        // Needs email verification
        if (result.status === 'missing_requirements') {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          return { error: null, needsVerification: true };
        }
        return { error: 'Additional verification required' };
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'errors' in err
            ? (err as { errors: { message: string }[] }).errors[0]?.message ?? 'Sign up failed'
            : err instanceof Error
              ? err.message
              : 'Sign up failed';
        return { error: message };
      }
    },
    [signUp],
  );

  // Email verification
  const verifyEmail = useCallback(
    async (code: string) => {
      if (!signUp) return { error: 'Auth not ready' };
      try {
        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === 'complete') {
          return { error: null };
        }
        return { error: 'Verification incomplete. Please try again.' };
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'errors' in err
            ? (err as { errors: { message: string }[] }).errors[0]?.message ?? 'Invalid code'
            : err instanceof Error
              ? err.message
              : 'Verification failed';
        return { error: message };
      }
    },
    [signUp],
  );

  // Resend verification code
  const resendVerification = useCallback(
    async () => {
      if (!signUp) return { error: 'Auth not ready' };
      try {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Failed to resend code' };
      }
    },
    [signUp],
  );

  // Forgot password — sends reset code to email
  const forgotPassword = useCallback(
    async (email: string) => {
      if (!signIn) return { error: 'Auth not ready' };
      try {
        await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
        return { error: null };
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'errors' in err
            ? (err as { errors: { message: string }[] }).errors[0]?.message ?? 'Failed to send reset code'
            : err instanceof Error
              ? err.message
              : 'Failed to send reset code';
        return { error: message };
      }
    },
    [signIn],
  );

  // Reset password — verifies code + sets new password
  const resetPassword = useCallback(
    async (code: string, newPassword: string) => {
      if (!signIn) return { error: 'Auth not ready' };
      try {
        const result = await signIn.attemptFirstFactor({
          strategy: 'reset_password_email_code',
          code,
          password: newPassword,
        });
        if (result.status === 'complete') {
          return { error: null };
        }
        return { error: 'Password reset incomplete. Please try again.' };
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'errors' in err
            ? (err as { errors: { message: string }[] }).errors[0]?.message ?? 'Invalid code or password'
            : err instanceof Error
              ? err.message
              : 'Password reset failed';
        return { error: message };
      }
    },
    [signIn],
  );

  const signOutFn = useCallback(async () => {
    try {
      await clerkSignOut();
    } catch {
      // Ignore sign-out errors
    }
    setAuthToken(null);
    setGuest(false);
    setHasCompletedOnboarding(false);
    setOnboardingChecked(false);
  }, [clerkSignOut, setGuest]);

  const browseAsGuest = useCallback(() => {
    setGuest(true);
  }, [setGuest]);

  const requireAuth = useCallback(() => {
    return user !== null;
  }, [user]);

  const isLoading = !isLoaded || (isSignedIn && (!onboardingChecked || !tokenReady));

  return {
    session,
    user,
    isLoading,
    isGuest,
    hasCompletedOnboarding,
    signInWithGoogle,
    signInWithApple,
    signInWithTikTok,
    signInWithEmail,
    signUpWithEmail,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    signOut: signOutFn,
    browseAsGuest,
    requireAuth,
  };
}
