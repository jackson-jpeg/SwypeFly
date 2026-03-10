import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { useAuthContext } from '@/hooks/AuthContext';
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/tokens';
import DesktopShell from '@/components/DesktopShell';
import GuestGate from '@/components/GuestGate';

// Lazy-load all screens for code splitting
const LoginScreen = lazy(() => import('@/screens/LoginScreen'));
const OnboardingScreen = lazy(() => import('@/screens/OnboardingScreen'));
const FeedScreen = lazy(() => import('@/screens/FeedScreen'));
const DestinationDetailScreen = lazy(() => import('@/screens/DestinationDetailScreen'));
const FlightSelectionScreen = lazy(() => import('@/screens/FlightSelectionScreen'));
const PassengerDetailsScreen = lazy(() => import('@/screens/PassengerDetailsScreen'));
const SeatSelectionScreen = lazy(() => import('@/screens/SeatSelectionScreen'));
const BagsExtrasScreen = lazy(() => import('@/screens/BagsExtrasScreen'));
const ReviewPaymentScreen = lazy(() => import('@/screens/ReviewPaymentScreen'));
const ConfirmationScreen = lazy(() => import('@/screens/ConfirmationScreen'));
const TripsScreen = lazy(() => import('@/screens/TripsScreen'));
const WishlistScreen = lazy(() => import('@/screens/WishlistScreen'));
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen'));
const SearchScreen = lazy(() => import('@/screens/SearchScreen'));
const HotelSearchScreen = lazy(() => import('@/screens/HotelSearchScreen'));
const HotelBookingScreen = lazy(() => import('@/screens/HotelBookingScreen'));
const AlertsScreen = lazy(() => import('@/screens/AlertsScreen'));
const QuizScreen = lazy(() => import('@/screens/QuizScreen'));
const LegalScreen = lazy(() => import('@/screens/LegalScreen'));
const DealsScreen = lazy(() => import('@/screens/DealsScreen'));
const NotFoundScreen = lazy(() => import('@/screens/NotFoundScreen'));

function LoadingScreen() {
  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}

export default function App() {
  const { isLoading, session, isGuest } = useAuthContext();
  const hasOnboarded = useUIStore((s) => s.hasOnboarded);

  if (isLoading) return <LoadingScreen />;

  const needsAuth = !session && !isGuest;
  const needsRealAuth = !session; // guests can't book — must sign in
  const needsOnboarding = session && !isGuest && !hasOnboarded;

  return (
    <DesktopShell>
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/sso-callback" element={<><AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/onboarding" /><div id="clerk-captcha" /></>} />
        <Route path="/login" element={session && !isGuest ? <Navigate to="/" /> : <LoginScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/" element={needsAuth ? <Navigate to="/login" /> : needsOnboarding ? <Navigate to="/onboarding" /> : <FeedScreen />} />
        <Route path="/search" element={needsAuth ? <Navigate to="/login" /> : <SearchScreen />} />
        <Route path="/destination/:id" element={needsAuth ? <Navigate to="/login" /> : <DestinationDetailScreen />} />
        <Route path="/booking/flights" element={needsAuth ? <Navigate to="/login" state={{ returnTo: '/booking/flights' }} /> : <FlightSelectionScreen />} />
        <Route path="/booking/passengers" element={needsRealAuth ? <GuestGate action="Book This Flight" description="Sign in to complete your booking. Your flight selection will be saved." /> : <PassengerDetailsScreen />} />
        <Route path="/booking/seats" element={needsRealAuth ? <GuestGate action="Book This Flight" description="Sign in to complete your booking. Your flight selection will be saved." /> : <SeatSelectionScreen />} />
        <Route path="/booking/extras" element={needsRealAuth ? <GuestGate action="Book This Flight" description="Sign in to complete your booking. Your flight selection will be saved." /> : <BagsExtrasScreen />} />
        <Route path="/booking/review" element={needsRealAuth ? <GuestGate action="Book This Flight" description="Sign in to complete your booking. Your flight selection will be saved." /> : <ReviewPaymentScreen />} />
        <Route path="/booking/confirmation" element={needsRealAuth ? <GuestGate action="Book This Flight" description="Sign in to complete your booking. Your flight selection will be saved." /> : <ConfirmationScreen />} />
        <Route path="/booking/hotels" element={needsAuth ? <Navigate to="/login" state={{ returnTo: '/booking/hotels' }} /> : <HotelSearchScreen />} />
        <Route path="/booking/hotel" element={needsRealAuth ? <GuestGate action="Book a Hotel" description="Sign in to complete your hotel booking." /> : <HotelBookingScreen />} />
        <Route path="/trips" element={needsRealAuth ? <GuestGate action="View Your Trips" description="Sign in to see your booked trips, itineraries, and travel history." /> : <TripsScreen />} />
        <Route path="/wishlist" element={needsAuth ? <Navigate to="/login" /> : <WishlistScreen />} />
        <Route path="/alerts" element={needsAuth ? <Navigate to="/login" /> : <AlertsScreen />} />
        <Route path="/settings" element={needsAuth ? <Navigate to="/login" /> : <SettingsScreen />} />
        <Route path="/legal/:type" element={<LegalScreen />} />
        <Route path="/saved" element={<Navigate to="/wishlist" replace />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/deals" element={<DealsScreen />} />
        <Route path="/quiz" element={<QuizScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Suspense>
    </DesktopShell>
  );
}
