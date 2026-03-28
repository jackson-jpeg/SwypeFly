import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from '../stores/settingsStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { colors } from '../theme/tokens';
import ToastContainer from '../components/common/ToastContainer';
import LaunchMark from '../components/common/LaunchMark';
import AppDownloadBanner from '../components/common/AppDownloadBanner';
import useAnimatedFavicon from '../hooks/useAnimatedFavicon';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const segments = useSegments();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait a tick for Zustand hydration
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const onOnboarding = segments[0] === 'onboarding';

    if (!hasCompletedOnboarding && !onOnboarding) {
      router.replace('/onboarding');
    } else if (hasCompletedOnboarding && onOnboarding) {
      router.replace('/(tabs)');
    }
  }, [ready, hasCompletedOnboarding, segments]);

  if (!ready) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'BebasNeue-Regular': BebasNeue_400Regular,
    Inter_400Regular,
    Inter_600SemiBold,
    PlayfairDisplay_400Regular_Italic,
  });
  const [showLaunchMark, setShowLaunchMark] = useState(true);

  useAnimatedFavicon();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Register service worker for offline support (web only)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — not critical
      });
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Swipe through stunning destinations and find the cheapest flights from your city. SoGoJet — your AI-powered travel deal finder." />
        <meta name="theme-color" content="#0A0806" />
        <title>SoGoJet — Discover Cheap Flights</title>
        {/* Vintage terminal CSS effects to match iOS aesthetic */}
        <style>{`
          body {
            background: #0A0806;
            /* Subtle noise texture overlay */
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          }
          /* Subtle warm radial glow behind content */
          #root::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none;
            z-index: 0;
            background: radial-gradient(ellipse at 50% 20%, rgba(247,232,160,0.04) 0%, transparent 60%);
          }
          /* Faint horizontal scanlines */
          #root::after {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none;
            z-index: 1;
            background: repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent 3px,
              rgba(0,0,0,0.015) 3px,
              rgba(0,0,0,0.015) 4px
            );
          }
          /* Custom scrollbar for dark theme */
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #2A2218; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #3A3228; }
          /* Selection color */
          ::selection { background: rgba(247,232,160,0.25); color: #F7E8A0; }
          /* Respect reduced motion preference */
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
          }
        `}</style>
        <meta
          name="description"
          content="Swipe through stunning destinations and find the cheapest flights from your city. Book in seconds."
        />
        <meta property="og:title" content="SoGoJet — Discover Cheap Flights" />
        <meta
          property="og:description"
          content="TikTok-style flight deal discovery. Swipe, save, and book the cheapest flights."
        />
        <meta property="og:image" content="https://sogojet.com/api/og" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SoGoJet" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SoGoJet — Discover Cheap Flights" />
        <meta name="twitter:image" content="https://sogojet.com/api/og" />
        <meta name="theme-color" content="#0A0806" />
        <meta name="apple-itunes-app" content="app-id=6746076960" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/assets/icon-180.png" sizes="180x180" />
        <link
          rel="icon"
          href="/assets/favicon-frame-0.png"
          sizes="64x64"
          data-sogojet-favicon="true"
        />
        <link rel="shortcut icon" href="/assets/favicon-frame-0.png" data-sogojet-favicon="true" />
      </Head>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <OnboardingGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen
                name="destination/[id]"
                options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
              />
            </Stack>
          </OnboardingGate>
          <StatusBar style="light" />
          <ToastContainer />
          <AppDownloadBanner />
        </QueryClientProvider>
      </ErrorBoundary>
      <LaunchMark visible={showLaunchMark} onFinish={() => setShowLaunchMark(false)} />
    </GestureHandlerRootView>
  );
}
