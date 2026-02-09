import '../global.css';
import { useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuthContext } from '../hooks/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function useWebStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.id = 'sogojet-global';
    style.textContent = `
      * { box-sizing: border-box; }
      html, body, #root, #main {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: #0A0A0A;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        overscroll-behavior: none;
      }
      /* Kill all scrollbars globally */
      ::-webkit-scrollbar { display: none; }
      * { scrollbar-width: none; }
    `;
    document.head.appendChild(style);

    // Set meta viewport for mobile web
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');

    // Set theme color
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColor);
    }
    themeColor.setAttribute('content', '#0A0A0A');

    document.title = 'SoGoJet — So many places to go — So Go Jet.';

    // PWA: add manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.json';
      document.head.appendChild(manifest);
    }

    // PWA: apple-touch-icon
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.setAttribute('sizes', '180x180');
      icon.href = '/assets/icon-180.png';
      document.head.appendChild(icon);
    }

    // PWA: mobile-web-app-capable
    if (!document.querySelector('meta[name="mobile-web-app-capable"]')) {
      const capable = document.createElement('meta');
      capable.setAttribute('name', 'mobile-web-app-capable');
      capable.setAttribute('content', 'yes');
      document.head.appendChild(capable);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const capable = document.createElement('meta');
      capable.setAttribute('name', 'apple-mobile-web-app-capable');
      capable.setAttribute('content', 'yes');
      document.head.appendChild(capable);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const style = document.createElement('meta');
      style.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      style.setAttribute('content', 'black-translucent');
      document.head.appendChild(style);
    }

    // Travelpayouts ownership verification
    if (!document.querySelector('script[src*="emrldtp.cc"]')) {
      const tpScript = document.createElement('script');
      tpScript.async = true;
      tpScript.src = 'https://emrldtp.cc/NDk2OTgy.js?t=496982';
      document.head.appendChild(tpScript);
    }
  }, []);
}

/** Redirects based on auth state */
function useAuthGuard() {
  const { session, isLoading, isGuest, hasCompletedOnboarding } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const segs = segments as string[];
    const inAuthGroup = segs[0] === 'auth';
    const onOnboarding = segs[0] === 'auth' && segs[1] === 'onboarding';
    const hasAccess = session !== null || isGuest;

    if (!hasAccess && !inAuthGroup) {
      // Not signed in & not guest → send to login
      router.replace('/auth/login');
    } else if (session && !hasCompletedOnboarding && !onOnboarding) {
      // Signed in but hasn't done onboarding → send to onboarding
      router.replace('/auth/onboarding');
    } else if (session && hasCompletedOnboarding && inAuthGroup) {
      // Signed in + onboarded but still on auth screen → send to feed
      router.replace('/(tabs)');
    }
  }, [session, isLoading, isGuest, hasCompletedOnboarding, segments]);
}

function AuthGatedLayout() {
  useAuthGuard();
  const { isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/onboarding" />
      <Stack.Screen
        name="destination/[id]"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useWebStyles();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
          <StatusBar style="light" />
          <AuthGatedLayout />
        </GestureHandlerRootView>
      </AuthProvider>
    </QueryClientProvider>
  );
}
