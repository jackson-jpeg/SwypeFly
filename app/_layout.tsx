import '../global.css';
import { useEffect, useState, useCallback } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  Syne_400Regular,
  Syne_500Medium,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuthContext } from '../hooks/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { initSentry } from '../utils/sentry';
import { queryClient } from '../services/queryClient';
import { colors } from '../constants/theme';
import { ToastContainer } from '../components/common/ToastContainer';
import { useGeolocation } from '../hooks/useGeolocation';

// Keep splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync();

function useWebStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Initialize Sentry + Web Vitals on web
    initSentry();
    import('../utils/webVitals').then(({ initWebVitals }) => initWebVitals());

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
        background-color: #F5ECD7;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
    themeColor.setAttribute('content', '#F5ECD7');

    document.title = 'SoGoJet — Discover Cheap Flights to Amazing Places';

    // OG meta tags for social sharing
    const metaTags: { attr: string; key: string; content: string }[] = [
      { attr: 'property', key: 'og:title', content: 'SoGoJet — Discover Cheap Flights to Amazing Places' },
      { attr: 'property', key: 'og:description', content: 'Swipe through stunning destinations and find the cheapest flights from your city. TikTok meets travel deals.' },
      { attr: 'property', key: 'og:type', content: 'website' },
      { attr: 'property', key: 'og:url', content: 'https://sogojet.com' },
      { attr: 'property', key: 'og:image', content: 'https://sogojet.com/api/og' },
      { attr: 'name', key: 'description', content: 'Swipe through stunning destinations and find the cheapest flights from your city. Discover deals to 200+ destinations worldwide.' },
      { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
      { attr: 'name', key: 'twitter:title', content: 'SoGoJet — Discover Cheap Flights' },
      { attr: 'name', key: 'twitter:description', content: 'Swipe through stunning destinations and find the cheapest flights from your city.' },
      { attr: 'name', key: 'twitter:image', content: 'https://sogojet.com/api/og' },
    ];
    for (const { attr, key, content } of metaTags) {
      if (!document.querySelector(`meta[${attr}="${key}"]`)) {
        const meta = document.createElement('meta');
        meta.setAttribute(attr, key);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    }

    // JSON-LD structured data for SEO
    if (!document.querySelector('script[type="application/ld+json"]')) {
      const jsonLd = document.createElement('script');
      jsonLd.type = 'application/ld+json';
      jsonLd.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'SoGoJet',
        url: 'https://sogojet.com',
        description: 'Discover cheap flights to amazing places. Swipe, save, and book your next adventure.',
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Web, iOS, Android',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://sogojet.com/?search={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      });
      document.head.appendChild(jsonLd);
    }

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

    // Service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
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

/** Redirects based on auth state — guest by default, no login wall */
function useAuthGuard() {
  const { session, isLoading, isGuest, hasCompletedOnboarding, browseAsGuest } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const segs = segments as string[];
    const inAuthGroup = segs[0] === 'auth';
    const hasAccess = session !== null || isGuest;

    if (!hasAccess && !inAuthGroup) {
      // Auto-enable guest mode — straight to feed, no login wall
      browseAsGuest();
    } else if (session && hasCompletedOnboarding && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, isGuest, hasCompletedOnboarding, segments, browseAsGuest]);
}

function AuthGatedLayout() {
  useGeolocation();
  useAuthGuard();
  const { isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
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
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen
        name="quiz"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="budget"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="subscribe"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="booking/[destinationId]"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useWebStyles();
  const [mounted, setMounted] = useState(false);

  const [fontsLoaded] = useFonts({
    Syne_400Regular,
    Syne_500Medium,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    BebasNeue_400Regular,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if ((!mounted && Platform.OS === 'web') || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutRootView}>
            <StatusBar style="dark" />
            <AuthGatedLayout />
            <ToastContainer />
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
