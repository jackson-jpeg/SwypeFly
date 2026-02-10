import { View, Text, ScrollView, Pressable, Share, Platform, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useDestination } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { usePriceCheck, useDestinationGuide } from '../../hooks/useAI';
import { useUIStore } from '../../stores/uiStore';
import { colors, spacing, fontSize, fontWeight, radii, layout, shadows } from '../../constants/theme';
import { SectionHeader } from '../../components/common/SectionHeader';
import ImageGallery from '../../components/destination/ImageGallery';
import { DestinationHero } from '../../components/destination/DestinationHero';
import { QuickStats } from '../../components/destination/QuickStats';
import { BudgetCard } from '../../components/destination/BudgetCard';
import { ActionBar } from '../../components/destination/ActionBar';
import { StickyBookBar } from '../../components/destination/StickyBookBar';
import ItineraryTimeline from '../../components/destination/ItineraryTimeline';
import RestaurantCards from '../../components/destination/RestaurantCards';
import LivePulse from '../../components/destination/LivePulse';
import NearbyGems from '../../components/destination/NearbyGems';
import TripStrategist from '../../components/destination/TripStrategist';

export default function DestinationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toggle, isSaved } = useSaveDestination();
  const { data: destination, isLoading, error } = useDestination(id);
  const departureCode = useUIStore((s) => s.departureCode);
  const [shareCopied, setShareCopied] = useState(false);

  const priceCheck = usePriceCheck(departureCode, destination?.iataCode || '');
  const { data: guide } = useDestinationGuide(destination?.city, destination?.country);

  // ─── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: colors.background }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${colors.border}`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────
  if (!destination || error) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: colors.background }}>
          <span style={{ color: colors.text.primary, fontSize: fontSize['3xl'] }}>Destination not found</span>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.text.primary, fontSize: fontSize['3xl'] }}>Destination not found</Text>
      </View>
    );
  }

  const saved = isSaved(destination.id);
  const images = destination.imageUrls?.length ? destination.imageUrls : [destination.imageUrl];

  const marker = typeof process !== 'undefined'
    ? (process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER || '')
    : '';

  const handleShare = async () => {
    const text = `Check out ${destination.city}, ${destination.country} on SoGoJet! ${destination.tagline}`;
    if (Platform.OS === 'web') {
      if (navigator.share) {
        try { await navigator.share({ title: destination.city, text }); } catch {}
      } else {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
      return;
    }
    try {
      await Share.share({ message: text });
    } catch { /* cancelled */ }
  };

  // ─── Web ────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <div style={{ backgroundColor: colors.background, minHeight: '100vh', position: 'relative' }}>
        {/* Close button */}
        <button
          onClick={() => router.back()}
          style={{
            position: 'fixed', top: spacing['4'], left: spacing['4'], zIndex: 50,
            width: layout.closeBtnSize, height: layout.closeBtnSize, borderRadius: layout.closeBtnSize / 2,
            backgroundColor: colors.overlay.whiteStrong, backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${colors.borderLight}`,
            color: colors.text.primary, fontSize: fontSize['3xl'], cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: shadows.web.lg,
          }}
        >
          &#10005;
        </button>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', height: '100vh', maxWidth: layout.maxContentWidth, margin: '0 auto' }}>
          {/* Hero - Image Gallery */}
          <ImageGallery images={images} city={destination.city} />

          {/* Content */}
          <div style={{ padding: `0 ${spacing['6']}px ${spacing['30']}px ${spacing['6']}px`, marginTop: -8 }}>
            {/* ─── Hero + Essential Info (above the fold) ─── */}
            <DestinationHero destination={destination} />

            {/* ─── At a Glance ─── */}
            <QuickStats destination={destination} />

            <div style={{ height: 1, backgroundColor: colors.border, margin: `${spacing['6']}px 0` }} />

            {/* About */}
            <SectionHeader title="About" />
            <p style={{ margin: `${spacing['2']}px 0 0 0`, color: colors.text.body, fontSize: fontSize.xl, lineHeight: 1.7 }}>
              {destination.description}
            </p>

            {/* Live Pulse */}
            <LivePulse city={destination.city} country={destination.country} />

            {/* Best Time to Visit */}
            <SectionHeader title="Best Time to Visit" />
            <p style={{ margin: `${spacing['2']}px 0 0 0`, color: colors.text.body, fontSize: fontSize.xl }}>
              {destination.bestMonths.join(', ')}
            </p>

            <div style={{ height: 1, backgroundColor: colors.border, margin: `${spacing['6']}px 0` }} />

            {/* ─── Plan Your Trip (AI cluster) ─── */}
            <div style={{ backgroundColor: 'rgba(129,140,248,0.03)', borderRadius: radii['2xl'], padding: `${spacing['5']}px`, marginLeft: -spacing['5'], marginRight: -spacing['5'], marginBottom: spacing['6'] }}>
              <ItineraryTimeline itinerary={guide?.itinerary ?? destination.itinerary} isAI={!!guide?.itinerary} />
              <RestaurantCards restaurants={guide?.restaurants ?? destination.restaurants} isAI={!!guide?.restaurants} />
              <NearbyGems city={destination.city} country={destination.country} />
              <TripStrategist destinationId={destination.id} city={destination.city} country={destination.country} />
            </div>

            {/* ─── Budget ─── */}
            <SectionHeader title="Budget Estimate" />
            <div style={{ marginTop: spacing['3'] }}>
              <BudgetCard destination={destination} priceCheck={priceCheck} />
            </div>

            <div style={{ height: 1, backgroundColor: colors.border, margin: `${spacing['6']}px 0` }} />

            {/* ─── Actions ─── */}
            <ActionBar
              departureCode={departureCode}
              iataCode={destination.iataCode}
              city={destination.city}
              country={destination.country}
              marker={marker}
              saved={saved}
              shareCopied={shareCopied}
              onToggleSave={() => toggle(destination.id)}
              onShare={handleShare}
            />

            {/* Disclaimer */}
            <p style={{
              color: colors.text.muted, fontSize: fontSize.md, textAlign: 'center',
              margin: `${spacing['6']}px 0 0 0`, lineHeight: 1.5,
            }}>
              Prices are approximate and may vary. We may earn a commission from bookings.
            </p>
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <StickyBookBar
          flightPrice={destination.flightPrice}
          currency={destination.currency}
          priceSource={destination.priceSource}
          departureCode={departureCode}
          iataCode={destination.iataCode}
          marker={marker}
        />
      </div>
    );
  }

  // ─── Native ─────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView bounces={false}>
        <ImageGallery images={images} city={destination.city} />

        <View style={{ padding: spacing['6'], paddingBottom: spacing['30'] }}>
          {/* Hero + Essential Info */}
          <DestinationHero destination={destination} />

          {/* At a Glance */}
          <QuickStats destination={destination} />

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing['6'] }} />

          {/* About */}
          <SectionHeader title="About" />
          <Text style={{ color: colors.text.body, fontSize: fontSize.xl, lineHeight: 24, marginTop: spacing['2'] }}>
            {destination.description}
          </Text>

          {/* Live Pulse */}
          <LivePulse city={destination.city} country={destination.country} />

          {/* Best Time to Visit */}
          <SectionHeader title="Best Time to Visit" />
          <Text style={{ color: colors.text.body, fontSize: fontSize.xl, marginTop: spacing['2'] }}>
            {destination.bestMonths.join(', ')}
          </Text>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing['6'] }} />

          {/* Plan Your Trip (AI cluster) */}
          <View style={{ backgroundColor: 'rgba(129,140,248,0.03)', borderRadius: radii['2xl'], padding: spacing['5'], marginHorizontal: -spacing['5'], marginBottom: spacing['6'] }}>
            <ItineraryTimeline itinerary={guide?.itinerary ?? destination.itinerary} isAI={!!guide?.itinerary} />
            <RestaurantCards restaurants={guide?.restaurants ?? destination.restaurants} isAI={!!guide?.restaurants} />
            <NearbyGems city={destination.city} country={destination.country} />
            <TripStrategist destinationId={destination.id} city={destination.city} country={destination.country} />
          </View>

          {/* Budget */}
          <SectionHeader title="Budget Estimate" />
          <View style={{ marginTop: spacing['3'] }}>
            <BudgetCard destination={destination} priceCheck={priceCheck} />
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing['6'] }} />

          {/* Actions */}
          <ActionBar
            departureCode={departureCode}
            iataCode={destination.iataCode}
            city={destination.city}
            country={destination.country}
            marker={marker}
            saved={saved}
            shareCopied={shareCopied}
            onToggleSave={() => toggle(destination.id)}
            onShare={handleShare}
          />

          {/* Disclaimer */}
          <Text style={{
            color: colors.text.muted, fontSize: fontSize.md, textAlign: 'center',
            marginTop: spacing['6'], lineHeight: 18,
          }}>
            Prices are approximate and may vary. We may earn a commission from bookings.
          </Text>
        </View>
      </ScrollView>

      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        style={{
          position: 'absolute', top: 52, left: spacing['4'],
          width: layout.closeBtnSize, height: layout.closeBtnSize, borderRadius: layout.closeBtnSize / 2,
          backgroundColor: colors.overlay.whiteStrong,
          alignItems: 'center', justifyContent: 'center',
          ...shadows.native.lg,
        }}
      >
        <Text style={{ color: colors.text.primary, fontSize: fontSize['3xl'], fontWeight: fontWeight.semibold }}>{'\u2715'}</Text>
      </Pressable>

      {/* Sticky bottom CTA */}
      <StickyBookBar
        flightPrice={destination.flightPrice}
        currency={destination.currency}
        priceSource={destination.priceSource}
        departureCode={departureCode}
        iataCode={destination.iataCode}
        marker={marker}
      />
    </View>
  );
}
