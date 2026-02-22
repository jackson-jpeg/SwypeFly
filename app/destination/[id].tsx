import { View, Text, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useDestination } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { useUIStore } from '../../stores/uiStore';
import { colors, spacing, fontSize, fontWeight, radii, layout, shadows } from '../../constants/theme';
import { SectionHeader } from '../../components/common/SectionHeader';
import ImageGallery from '../../components/destination/ImageGallery';
import { DestinationHero } from '../../components/destination/DestinationHero';
import { QuickStats } from '../../components/destination/QuickStats';
import { StickyBookBar } from '../../components/destination/StickyBookBar';
import ItineraryTimeline from '../../components/destination/ItineraryTimeline';
import RestaurantCards from '../../components/destination/RestaurantCards';
import { TravelTips } from '../../components/destination/TravelTips';
import { SimilarDestinations } from '../../components/destination/SimilarDestinations';
import { hotelLink, activitiesLink } from '../../utils/affiliateLinks';
import { CompareModal } from '../../components/common/CompareModal';
import { Footer } from '../../components/common/Footer';

export default function DestinationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toggle, isSaved } = useSaveDestination();
  const { data: destination, isLoading, error } = useDestination(id);
  const departureCode = useUIStore((s) => s.departureCode);
  const [shareCopied, setShareCopied] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // ─── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: colors.dark.background }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${colors.dark.border}`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────
  if (!destination || error) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: colors.dark.background }}>
          <span style={{ color: colors.dark.text.primary, fontSize: fontSize['3xl'] }}>Destination not found</span>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark.background }}>
        <Text style={{ color: colors.dark.text.primary, fontSize: fontSize['3xl'] }}>Destination not found</Text>
      </View>
    );
  }

  const saved = isSaved(destination.id);
  const images = destination.imageUrls?.length ? destination.imageUrls : [destination.imageUrl];
  const effectivePrice = destination.livePrice ?? destination.flightPrice;

  const marker = typeof process !== 'undefined'
    ? (process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER || '')
    : '';

  const handleShare = async () => {
    const { shareDestination } = await import('../../utils/share');
    const shared = await shareDestination(
      destination.city, destination.country, destination.tagline,
      destination.id, effectivePrice, destination.currency,
    );
    if (shared && Platform.OS === 'web' && !(typeof navigator !== 'undefined' && navigator.share)) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  // ─── Web ────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <div style={{ backgroundColor: colors.dark.background, minHeight: '100vh', position: 'relative' }}>
        {/* Close button */}
        <button
          onClick={() => router.back()}
          style={{
            position: 'fixed', top: spacing['4'], left: spacing['4'], zIndex: 50,
            width: layout.closeBtnSize, height: layout.closeBtnSize, borderRadius: layout.closeBtnSize / 2,
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${colors.dark.borderLight}`,
            color: '#FFFFFF', fontSize: fontSize['3xl'], cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: shadows.web.lg,
          }}
        >&#10005;</button>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', height: '100vh', maxWidth: layout.maxContentWidth, margin: '0 auto', scrollBehavior: 'smooth' }}>
          {/* 1. Hero — Image Gallery */}
          <ImageGallery images={images} city={destination.city} />

          <div style={{ padding: `0 ${spacing['6']}px ${spacing['30']}px ${spacing['6']}px`, marginTop: -8 }}>
            {/* 2. Info — Hero + Essential */}
            <DestinationHero destination={destination} />
            <QuickStats destination={destination} />

            {/* Description */}
            <p style={{ margin: `${spacing['4']}px 0 0 0`, color: colors.dark.text.body, fontSize: fontSize.xl, lineHeight: 1.7 }}>
              {destination.description}
            </p>

            {/* Vibe tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: spacing['4'] }}>
              {destination.vibeTags.map((tag) => (
                <span key={tag} style={{
                  padding: '4px 12px', borderRadius: 9999,
                  backgroundColor: colors.primaryBackground,
                  color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
                  textTransform: 'capitalize',
                }}>{tag}</span>
              ))}
            </div>

            {/* Best months */}
            <div style={{ marginTop: spacing['4'] }}>
              <span style={{ color: colors.dark.text.secondary, fontSize: fontSize.lg, fontWeight: fontWeight.medium }}>
                Best time: {destination.bestMonths.join(', ')}
              </span>
            </div>

            <div style={{ height: 1, backgroundColor: colors.dark.border, margin: `${spacing['6']}px 0` }} />

            {/* 3. Flight Deal Card */}
            <div style={{
              padding: spacing['5'], borderRadius: radii['2xl'],
              backgroundColor: colors.dark.surface,
              border: `1px solid ${colors.dark.border}`,
              boxShadow: shadows.web.md,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                <span style={{ fontSize: fontSize['5xl'], fontWeight: fontWeight.extrabold, color: colors.dark.text.primary }}>
                  ${effectivePrice}
                </span>
                <span style={{
                  padding: '4px 10px', borderRadius: 9999,
                  backgroundColor: destination.priceSource === 'estimate' ? colors.dark.surfaceElevated : colors.successBackground,
                  color: destination.priceSource === 'estimate' ? colors.dark.text.muted : colors.successDark,
                  fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
                }}>
                  {destination.priceSource === 'estimate' ? 'Estimated' : 'Live price'}
                </span>
              </div>
              {destination.airline && (
                <p style={{ margin: 0, color: colors.dark.text.secondary, fontSize: fontSize.lg }}>
                  {destination.airline} · {destination.flightDuration}
                </p>
              )}
              {!destination.airline && (
                <p style={{ margin: 0, color: colors.dark.text.secondary, fontSize: fontSize.lg }}>
                  Round-trip · {destination.flightDuration}
                </p>
              )}
              {destination.departureDate && destination.returnDate && (
                <p style={{ margin: `${spacing['2']}px 0 0 0`, color: colors.dark.text.muted, fontSize: fontSize.md }}>
                  {destination.departureDate} — {destination.returnDate}
                  {destination.tripDurationDays && ` (${destination.tripDurationDays} days)`}
                </p>
              )}
            </div>

            {/* Trip cost estimator */}
            {destination.hotelPricePerNight > 0 && effectivePrice > 0 && (() => {
              const nights = destination.tripDurationDays ? destination.tripDurationDays - 1 : 5;
              const hotelTotal = destination.hotelPricePerNight * nights;
              const totalTrip = effectivePrice + hotelTotal;
              return (
                <div style={{
                  marginTop: spacing['5'],
                  padding: `${spacing['4']}px ${spacing['5']}px`,
                  borderRadius: radii['2xl'],
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0.02) 100%)',
                  border: `1px solid rgba(56,189,248,0.15)`,
                }}>
                  <div style={{ color: colors.dark.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing['3'] }}>
                    💰 Estimated Trip Cost ({nights} nights)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.dark.text.secondary, fontSize: fontSize.lg }}>
                      <span>✈️ Flights (roundtrip)</span><span>${effectivePrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.dark.text.secondary, fontSize: fontSize.lg }}>
                      <span>🏨 Hotel ({nights} nights × ${destination.hotelPricePerNight})</span><span>${hotelTotal}</span>
                    </div>
                    <div style={{ height: 1, backgroundColor: colors.dark.border, margin: `${spacing['2']}px 0` }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.dark.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold }}>
                      <span>Total</span><span>${totalTrip}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Activities CTA */}
            <button
              onClick={() => window.open(activitiesLink(destination.city, destination.country, marker), '_blank')}
              style={{
                width: '100%', marginTop: spacing['3'],
                padding: '14px 0', borderRadius: radii.xl,
                background: 'transparent',
                border: `1.5px solid ${colors.border}`,
                color: colors.text.primary,
                fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >🎭 Find Activities & Tours</button>

            {/* Prices from other airports */}
            {destination.otherPrices && destination.otherPrices.length > 0 && (
              <div style={{ marginTop: spacing['4'] }}>
                <div style={{ color: colors.dark.text.muted, fontSize: fontSize.md, fontWeight: fontWeight.medium, marginBottom: spacing['2'] }}>
                  Also available from
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {destination.otherPrices.map((op: { origin: string; price: number }) => (
                    <div key={op.origin} style={{
                      padding: '6px 14px', borderRadius: 9999,
                      backgroundColor: colors.dark.surfaceElevated,
                      border: `1px solid ${colors.dark.border}`,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ color: colors.dark.text.secondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{op.origin}</span>
                      <span style={{ color: colors.dark.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>${op.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hotel card */}
            {destination.hotelPricePerNight > 0 && (
              <div style={{
                marginTop: spacing['4'],
                padding: spacing['5'], borderRadius: radii['2xl'],
                backgroundColor: colors.dark.surface,
                border: `1px solid ${colors.dark.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ color: colors.dark.text.muted, fontSize: fontSize.md }}>Hotels from</div>
                  <div style={{ color: colors.dark.text.primary, fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold }}>
                    ${destination.hotelPricePerNight}<span style={{ fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.dark.text.muted }}>/night</span>
                  </div>
                </div>
                <button
                  onClick={() => window.open(hotelLink(destination.city, destination.country, marker), '_blank')}
                  style={{
                    background: 'transparent', border: `1.5px solid ${colors.primary}`,
                    color: colors.primary, borderRadius: radii.lg,
                    padding: `${spacing['2']}px ${spacing['5']}px`,
                    fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
                  }}
                >Browse Hotels ↗</button>
              </div>
            )}

            <div style={{ height: 1, backgroundColor: colors.dark.border, margin: `${spacing['6']}px 0` }} />

            {/* 4. Itinerary */}
            {destination.itinerary && destination.itinerary.length > 0 && (
              <>
                <ItineraryTimeline itinerary={destination.itinerary} />
                <div style={{ height: 1, backgroundColor: colors.dark.border, margin: `${spacing['6']}px 0` }} />
              </>
            )}

            {/* Restaurants */}
            {destination.restaurants && destination.restaurants.length > 0 && (
              <RestaurantCards restaurants={destination.restaurants} />
            )}

            {/* Travel Tips */}
            {destination.travelTips && (
              <>
                <div style={{ height: 1, backgroundColor: colors.dark.border, margin: `${spacing['6']}px 0` }} />
                <TravelTips destination={destination} />
              </>
            )}

            {/* Similar destinations */}
            <SimilarDestinations current={destination} />

            <div style={{ height: 1, backgroundColor: colors.dark.border, margin: `${spacing['6']}px 0` }} />

            {/* Save + Share row */}
            <div style={{ display: 'flex', gap: 12, marginTop: spacing['6'] }}>
              <button
                onClick={() => toggle(destination.id)}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: radii.xl,
                  backgroundColor: saved ? colors.primaryTint : colors.dark.surfaceElevated,
                  border: saved ? `1px solid ${colors.primaryBorder}` : `1px solid ${colors.dark.border}`,
                  color: saved ? colors.primary : colors.dark.text.primary,
                  fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
                }}
              >{saved ? '♥ Saved' : '♡ Save'}</button>
              <button
                onClick={handleShare}
                style={{
                  padding: '14px 24px', borderRadius: radii.xl,
                  backgroundColor: colors.dark.surfaceElevated,
                  border: `1px solid ${colors.dark.border}`,
                  color: colors.dark.text.primary,
                  fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
                }}
              >{shareCopied ? '✓ Copied' : '↗ Share'}</button>
              <button
                onClick={() => setCompareOpen(true)}
                style={{
                  padding: '14px 18px', borderRadius: radii.xl,
                  backgroundColor: colors.dark.surfaceElevated,
                  border: `1px solid ${colors.dark.border}`,
                  color: colors.dark.text.primary,
                  fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
                }}
              >⚖️</button>
            </div>

            {/* Compare modal */}
            <CompareModal destination={destination} visible={compareOpen} onClose={() => setCompareOpen(false)} />

            {/* Disclaimer */}
            <p style={{
              color: colors.dark.text.muted, fontSize: fontSize.md, textAlign: 'center',
              margin: `${spacing['6']}px 0 0 0`, lineHeight: 1.5,
            }}>
              Prices are approximate and may vary. We may earn a commission from bookings.
            </p>

            <Footer />
          </div>
        </div>

        {/* 5. Sticky CTA */}
        <StickyBookBar
          flightPrice={effectivePrice}
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
    <View style={{ flex: 1, backgroundColor: colors.dark.background }}>
      <ScrollView bounces={false}>
        <ImageGallery images={images} city={destination.city} />

        <View style={{ padding: spacing['6'], paddingBottom: spacing['30'] }}>
          <DestinationHero destination={destination} />
          <QuickStats destination={destination} />

          <Text style={{ color: colors.dark.text.body, fontSize: fontSize.xl, lineHeight: 24, marginTop: spacing['4'] }}>
            {destination.description}
          </Text>

          {/* Vibe tags */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing['4'] }}>
            {destination.vibeTags.map((tag) => (
              <View key={tag} style={{
                paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999,
                backgroundColor: colors.primaryBackground,
              }}>
                <Text style={{ color: colors.primary, fontSize: fontSize.sm, fontWeight: '600', textTransform: 'capitalize' }}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={{ color: colors.dark.text.secondary, fontSize: fontSize.lg, fontWeight: '500', marginTop: spacing['4'] }}>
            Best time: {destination.bestMonths.join(', ')}
          </Text>

          <View style={{ height: 1, backgroundColor: colors.dark.border, marginVertical: spacing['6'] }} />

          {/* Flight Deal Card */}
          <View style={{
            padding: spacing['5'], borderRadius: radii['2xl'],
            backgroundColor: colors.dark.surface,
            borderWidth: 1, borderColor: colors.dark.border,
            ...shadows.native.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <Text style={{ fontSize: fontSize['5xl'], fontWeight: '800', color: colors.dark.text.primary }}>
                ${effectivePrice}
              </Text>
            </View>
            <Text style={{ color: colors.dark.text.secondary, fontSize: fontSize.lg }}>
              {destination.airline ? `${destination.airline} · ` : 'Round-trip · '}{destination.flightDuration}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.dark.border, marginVertical: spacing['6'] }} />

          {destination.itinerary && destination.itinerary.length > 0 && (
            <>
              <ItineraryTimeline itinerary={destination.itinerary} />
              <View style={{ height: 1, backgroundColor: colors.dark.border, marginVertical: spacing['6'] }} />
            </>
          )}

          {destination.restaurants && destination.restaurants.length > 0 && (
            <RestaurantCards restaurants={destination.restaurants} />
          )}

          <Text style={{
            color: colors.dark.text.muted, fontSize: fontSize.md, textAlign: 'center',
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center', justifyContent: 'center',
          ...shadows.native.lg,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: fontSize['3xl'], fontWeight: fontWeight.semibold }}>{'\u2715'}</Text>
      </Pressable>

      <StickyBookBar
        flightPrice={effectivePrice}
        currency={destination.currency}
        priceSource={destination.priceSource}
        departureCode={departureCode}
        iataCode={destination.iataCode}
        marker={marker}
      />
    </View>
  );
}
