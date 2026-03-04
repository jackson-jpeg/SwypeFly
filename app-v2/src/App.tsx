import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/AuthContext';
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/tokens';

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
const WishlistScreen = lazy(() => import('@/screens/WishlistScreen'));
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen'));
const QuizScreen = lazy(() => import('@/screens/QuizScreen'));
const LegalScreen = lazy(() => import('@/screens/LegalScreen'));
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
  const needsOnboarding = session && !isGuest && !hasOnboarded;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={session || isGuest ? <Navigate to="/" /> : <LoginScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/" element={needsAuth ? <Navigate to="/login" /> : needsOnboarding ? <Navigate to="/onboarding" /> : <FeedScreen />} />
        <Route path="/destination/:id" element={needsAuth ? <Navigate to="/login" /> : <DestinationDetailScreen />} />
        <Route path="/booking/flights" element={needsAuth ? <Navigate to="/login" /> : <FlightSelectionScreen />} />
        <Route path="/booking/passengers" element={needsAuth ? <Navigate to="/login" /> : <PassengerDetailsScreen />} />
        <Route path="/booking/seats" element={needsAuth ? <Navigate to="/login" /> : <SeatSelectionScreen />} />
        <Route path="/booking/extras" element={needsAuth ? <Navigate to="/login" /> : <BagsExtrasScreen />} />
        <Route path="/booking/review" element={needsAuth ? <Navigate to="/login" /> : <ReviewPaymentScreen />} />
        <Route path="/booking/confirmation" element={needsAuth ? <Navigate to="/login" /> : <ConfirmationScreen />} />
        <Route path="/wishlist" element={needsAuth ? <Navigate to="/login" /> : <WishlistScreen />} />
        <Route path="/settings" element={needsAuth ? <Navigate to="/login" /> : <SettingsScreen />} />
        <Route path="/legal/:type" element={<LegalScreen />} />
        <Route path="/saved" element={<Navigate to="/wishlist" replace />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/quiz" element={<QuizScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Suspense>
  );
}
