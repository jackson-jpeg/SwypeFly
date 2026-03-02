import { View, Text, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useDestination } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { useUIStore } from '../../stores/uiStore';
import { colors, spacing, fontSize, fontWeight, radii, layout, shadows, fonts, textPresets, buttons } from '../../constants/theme';
import { SectionHeader } from '../../components/common/SectionHeader';
import ImageGallery from '../../components/destination/ImageGallery';
import { DestinationHero } from '../../components/destination/DestinationHero';
import { QuickStats } from '../../components/destination/QuickStats';
import { StickyBookBar } from '../../components/destination/StickyBookBar';
import ItineraryTimeline from '../../components/destination/ItineraryTimeline';
import RestaurantCards from '../../components/destination/RestaurantCards';
import { TravelTips } from '../../components/destination/TravelTips';
import { WeatherWidget } from '../../components/destination/WeatherWidget';
import { SimilarDestinations } from '../../components/destination/SimilarDestinations';
import { hotelLink, activitiesLink } from '../../utils/affiliateLinks';
import { CompareModal } from '../../components/common/CompareModal';
import { Footer } from '../../components/common/Footer';
import { AiTripPlanner } from '../../components/destination/AiTripPlanner';
import { PriceAlertButton } from '../../components/destination/PriceAlertButton';

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: colors.duskSand }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${colors.divider}`, borderTopColor: colors.deepDusk, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.duskSand }}>
        <ActivityIndicator color={colors.deepDusk} />
      </View>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────
  if (!destination || error) {
    if (Platform.OS === 'web') {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', backgroundColor: colors.duskSand, gap: 16, padding: 32,
        }}>
          <span style={{ fontSize: 48 }}>🔍</span>
          <span style={{ color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
            {error ? 'Something went wrong' : 'Destination not found'}
          </span>
          <span style={{ color: colors.text.muted, fontSize: fontSize.md, textAlign: 'center', maxWidth: 320 }}>
            {error ? 'We couldn\'t load this destination. Check your connection and try again.' : 'This destination may have been removed or the link is invalid.'}
          </span>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={() => router.back()}
              style={{
                ...buttons.secondary, padding: '10px 24px',
                background: 'none', color: colors.detailSubtitle, fontSize: fontSize.md,
                fontWeight: fontWeight.semibold, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Go Back</button>
            {error && (
              <button
                onClick={() => window.location.reload()}
                style={{
                  ...buttons.primary, padding: '10px 24px', border: 'none',
                  background: colors.deepDusk, color: colors.paleHorizon, fontSize: fontSize.md,
                  fontWeight: fontWeight.semibold, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Retry</button>
            )}
          </div>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.duskSand, padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
        <Text style={{ color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, textAlign: 'center', marginBottom: 8 }}>
          {error ? 'Something went wrong' : 'Destination not found'}
        </Text>
        <Text style={{ color: colors.text.muted, fontSize: fontSize.md, textAlign: 'center', marginBottom: 20 }}>
          {error ? 'Check your connection and try again.' : 'This destination may have been removed.'}
        </Text>
        <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: buttons.primary.borderRadius, backgroundColor: colors.deepDusk }}>
          <Text style={{ color: colors.paleHorizon, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Dynamic SEO: update page title + OG meta for this destination
  useEffect(() => {
    if (Platform.OS !== 'web' || !destination) return;
    const prevTitle = document.title;
    const price = destination.livePrice ?? destination.flightPrice;
    document.title = `${destination.city}, ${destination.country} — From $${price} | SoGoJet`;

    const ogUpdates: Record<string, string> = {
      'og:title': `${destination.city}, ${destination.country} — Flights from $${price}`,
      'og:description': destination.tagline || `Discover ${destination.city} with SoGoJet`,
      'og:image': `https://sogojet.com/api/og?id=${destination.id}`,
      'og:url': `https://sogojet.com/destination/${destination.id}`,
    };
    const originals: Record<string, string> = {};
    for (const [key, value] of Object.entries(ogUpdates)) {
      const el = document.querySelector(`meta[property="${key}"]`);
      if (el) {
        originals[key] = el.getAttribute('content') || '';
        el.setAttribute('content', value);
      }
    }
    return () => {
      document.title = prevTitle;
      for (const [key, value] of Object.entries(originals)) {
        document.querySelector(`meta[property="${key}"]`)?.setAttribute('content', value);
      }
    };
  }, [destination]);

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
      <div style={{ backgroundColor: colors.duskSand, minHeight: '100vh', position: 'relative' }}>
        {/* Close button */}
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            position: 'fixed', top: spacing['4'], left: spacing['4'], zIndex: 50,
            width: layout.closeBtnSize, height: layout.closeBtnSize, borderRadius: layout.closeBtnSize / 2,
            backgroundColor: 'rgba(44,31,26,0.5)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${colors.borderLight}`,
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
            <DestinationHero destination={destination} saved={saved} onToggleSave={() => toggle(destination.id)} />
            <QuickStats destination={destination} />
            <WeatherWidget city={destination.city} country={destination.country} averageTemp={destination.averageTemp} />

            <div style={{ height: 1, backgroundColor: colors.divider, margin: `${spacing['6']}px 0` }} />

            {/* ─── ABOUT THIS PLACE ─── */}
            <div>
              <div style={{
                ...textPresets.display.sectionHeading,
                marginBottom: spacing['3'],
              }}>
                ABOUT THIS PLACE
              </div>
              <p style={{ margin: 0, color: colors.text.body, fontSize: fontSize.xl, lineHeight: 1.7 }}>
                {destination.description}
              </p>

              {/* Highlights from vibeTags */}
              {destination.vibeTags.length > 0 && (
                <div style={{ marginTop: spacing['4'] }}>
                  <div style={{ color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing['2'] }}>
                    Highlights
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {destination.vibeTags.map((tag) => (
                      <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: colors.warmDusk, fontSize: 14 }}>★</span>
                        <span style={{ color: colors.text.body, fontSize: fontSize.lg, textTransform: 'capitalize' }}>
                          {tag === 'foodie' ? 'Amazing local cuisine & food scene' :
                           tag === 'beach' ? 'Beautiful beaches & coastal scenery' :
                           tag === 'culture' ? 'Rich cultural experiences & heritage' :
                           tag === 'adventure' ? 'Thrilling adventure activities' :
                           tag === 'historic' ? 'Fascinating historical landmarks' :
                           tag === 'nature' ? 'Stunning natural landscapes' :
                           tag === 'romantic' ? 'Perfect romantic getaway setting' :
                           tag === 'nightlife' ? 'Vibrant nightlife & entertainment' :
                           tag === 'mountain' ? 'Breathtaking mountain scenery' :
                           tag === 'tropical' ? 'Tropical paradise vibes' :
                           tag === 'city' ? 'Exciting urban exploration' :
                           tag === 'luxury' ? 'World-class luxury experiences' :
                           tag === 'budget' ? 'Great value for money' :
                           tag === 'winter' ? 'Magical winter wonderland' :
                           (tag as string).charAt(0).toUpperCase() + (tag as string).slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Info Bar */}
              <div style={{
                display: 'flex', gap: spacing['4'], marginTop: spacing['4'],
                padding: `${spacing['3']}px ${spacing['4']}px`,
                backgroundColor: colors.paleHorizon,
                borderRadius: radii.lg,
                border: `1px solid ${colors.divider}`,
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 140 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <div>
                    <div style={{ color: colors.text.muted, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>Best Time</div>
                    <div style={{ color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
                      {destination.bestMonths.slice(0, 3).join(', ')}
                    </div>
                  </div>
                </div>
                <div style={{ width: 1, backgroundColor: colors.divider, alignSelf: 'stretch' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 140 }}>
                  <span style={{ fontSize: 16 }}>💰</span>
                  <div>
                    <div style={{ color: colors.text.muted, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>Daily Budget</div>
                    <div style={{ color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
                      ~${Math.round(destination.hotelPricePerNight + 50)}/day
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: colors.divider, margin: `${spacing['6']}px 0` }} />

            {/* ─── FLIGHT DEAL CARD ─── */}
            <div style={{
              padding: spacing['5'], borderRadius: radii['2xl'],
              backgroundColor: colors.paleHorizon,
              border: `1px solid ${colors.divider}`,
              boxShadow: shadows.web.md,
            }}>
              <div style={{
                color: colors.sageDrift, fontSize: 10, fontWeight: fontWeight.bold,
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing['2'],
              }}>
                FLIGHT DEAL
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: spacing['1'] }}>
                <span style={{ fontFamily: `${fonts.display}, sans-serif`, fontSize: 36, fontWeight: fontWeight.extrabold, color: colors.text.primary }}>
                  ${effectivePrice}
                </span>
                <span style={{ color: colors.text.muted, fontSize: fontSize.lg }}>round trip</span>
                {destination.priceSource !== 'estimate' && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 9999,
                    backgroundColor: colors.successBackground,
                    color: colors.livePriceGreen,
                    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
                    marginLeft: 4,
                  }}>Live price</span>
                )}
              </div>
              <div style={{ color: colors.detailSubtitle, fontSize: fontSize.lg, marginBottom: spacing['3'] }}>
                From {departureCode || 'TPA'}
                {destination.airline ? ` · ${destination.airline}` : ''} · {destination.flightDuration}
              </div>
              {destination.departureDate && destination.returnDate && (
                <div style={{ color: colors.text.muted, fontSize: fontSize.md, marginBottom: spacing['3'] }}>
                  {destination.departureDate} — {destination.returnDate}
                  {destination.tripDurationDays && ` (${destination.tripDurationDays} days)`}
                </div>
              )}
              {destination.priceFetchedAt && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: colors.text.muted, fontSize: fontSize.sm, marginBottom: spacing['3'],
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: destination.priceSource !== 'estimate' ? colors.sageDrift : colors.warmDusk,
                    display: 'inline-block',
                  }} />
                  Price updated {(() => {
                    const diff = Date.now() - new Date(destination.priceFetchedAt).getTime();
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    if (hours < 1) return 'just now';
                    if (hours < 24) return `${hours}h ago`;
                    return `${Math.floor(hours / 24)}d ago`;
                  })()}
                </div>
              )}
              <button
                onClick={() => {
                  const url = `https://www.aviasales.com/search/${departureCode || 'TPA'}01${destination.iataCode}01?marker=${marker}`;
                  window.open(url, '_blank');
                }}
                style={{
                  width: '100%', height: buttons.primary.height, borderRadius: buttons.primary.borderRadius,
                  backgroundColor: colors.deepDusk, border: 'none',
                  color: colors.paleHorizon, fontSize: 17, fontWeight: fontWeight.semibold,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: `${fonts.body}, sans-serif`,
                }}
              >
                Select This Flight
              </button>
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
                  backgroundColor: colors.paleHorizon,
                  border: `1px solid ${colors.divider}`,
                }}>
                  <div style={{ color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing['3'] }}>
                    Estimated Trip Cost ({nights} nights)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.detailSubtitle, fontSize: fontSize.lg }}>
                      <span>Flights (roundtrip)</span><span>${effectivePrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.detailSubtitle, fontSize: fontSize.lg }}>
                      <span>Hotel ({nights} nights × ${destination.hotelPricePerNight})</span><span>${hotelTotal}</span>
                    </div>
                    <div style={{ height: 1, backgroundColor: colors.divider, margin: `${spacing['2']}px 0` }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold }}>
                      <span>Total</span><span>${totalTrip}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: spacing['4'] }}>
              <button
                onClick={() => window.open(hotelLink(destination.city, destination.country, marker), '_blank')}
                style={{
                  flex: 1, height: buttons.secondary.height, borderRadius: buttons.secondary.borderRadius,
                  backgroundColor: 'transparent',
                  border: `1.5px solid ${colors.secondaryBorder}`,
                  color: colors.deepDusk, fontSize: fontSize.lg, fontWeight: fontWeight.bold,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >Find Hotels</button>
              <button
                onClick={() => window.open(activitiesLink(destination.city, destination.country, marker), '_blank')}
                style={{
                  flex: 1, height: buttons.secondary.height, borderRadius: buttons.secondary.borderRadius,
                  backgroundColor: 'transparent',
                  border: `1.5px solid ${colors.secondaryBorder}`,
                  color: colors.deepDusk, fontSize: fontSize.lg, fontWeight: fontWeight.bold,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >Browse Activities</button>
            </div>

            {/* Travel insurance link */}
            <button
              onClick={() => window.open(`https://www.worldnomads.com/travel-insurance/?utm_source=sogojet&utm_medium=web`, '_blank')}
              style={{
                width: '100%', marginTop: spacing['2'],
                padding: '12px 0', borderRadius: radii.md,
                background: 'transparent',
                border: `1px solid ${colors.borderLight}`,
                color: colors.detailSubtitle,
                fontSize: fontSize.md, fontWeight: fontWeight.medium, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >Get Travel Insurance</button>

            {/* Price Alert */}
            <PriceAlertButton
              destinationId={destination.id}
              currentPrice={effectivePrice}
            />

            {/* Prices from other airports */}
            {destination.otherPrices && destination.otherPrices.length > 0 && (
              <div style={{ marginTop: spacing['4'] }}>
                <div style={{ color: colors.text.muted, fontSize: fontSize.md, fontWeight: fontWeight.medium, marginBottom: spacing['2'] }}>
                  Also available from
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {destination.otherPrices.map((op: { origin: string; price: number }) => (
                    <div key={op.origin} style={{
                      padding: '6px 14px', borderRadius: 9999,
                      backgroundColor: colors.paleHorizon,
                      border: `1px solid ${colors.divider}`,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ color: colors.detailSubtitle, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{op.origin}</span>
                      <span style={{ color: colors.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>${op.price}</span>
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
                backgroundColor: colors.paleHorizon,
                border: `1px solid ${colors.divider}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ color: colors.text.muted, fontSize: fontSize.md }}>Hotels from</div>
                  <div style={{ color: colors.text.primary, fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold }}>
                    ${destination.hotelPricePerNight}<span style={{ fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.text.muted }}>/night</span>
                  </div>
                </div>
                <button
                  onClick={() => window.open(hotelLink(destination.city, destination.country, marker), '_blank')}
                  style={{
                    background: 'transparent', border: `1.5px solid ${colors.secondaryBorder}`,
                    color: colors.deepDusk, borderRadius: radii.lg,
                    padding: `${spacing['2']}px ${spacing['5']}px`,
                    fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >Browse Hotels</button>
              </div>
            )}

            <div style={{ height: 1, backgroundColor: colors.divider, margin: `${spacing['6']}px 0` }} />

            {/* 4. Itinerary */}
            {destination.itinerary && destination.itinerary.length > 0 && (
              <>
                <ItineraryTimeline itinerary={destination.itinerary} />
                <div style={{ height: 1, backgroundColor: colors.divider, margin: `${spacing['6']}px 0` }} />
              </>
            )}

            {/* Restaurants */}
            {destination.restaurants && destination.restaurants.length > 0 && (
              <RestaurantCards restaurants={destination.restaurants} />
            )}

            {/* Travel Tips */}
            {destination.travelTips && (
              <>
                <div style={{ height: 1, backgroundColor: colors.divider, margin: `${spacing['6']}px 0` }} />
                <TravelTips destination={destination} />
              </>
            )}

            {/* AI Trip Planner */}
            <AiTripPlanner city={destination.city} country={destination.country} />

            {/* Similar destinations */}
            <SimilarDestinations current={destination} />

            <div style={{ height: 1, backgroundColor: colors.divider, margin: `${spacing['6']}px 0` }} />

            {/* Save + Share row */}
            <div style={{ display: 'flex', gap: 12, marginTop: spacing['6'] }}>
              <button
                onClick={() => toggle(destination.id)}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: radii.md,
                  backgroundColor: saved ? colors.successBackground : colors.paleHorizon,
                  border: saved ? `1.5px solid ${colors.successBorder}` : `1px solid ${colors.divider}`,
                  color: saved ? colors.sageDrift : colors.text.primary,
                  fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >{saved ? '♥ Saved' : '♡ Save'}</button>
              <button
                onClick={handleShare}
                style={{
                  padding: '14px 24px', borderRadius: radii.md,
                  backgroundColor: colors.paleHorizon,
                  border: `1px solid ${colors.divider}`,
                  color: colors.text.primary,
                  fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >{shareCopied ? '✓ Copied' : '↗ Share'}</button>
              <button
                onClick={() => setCompareOpen(true)}
                aria-label="Compare destinations"
                style={{
                  padding: '14px 18px', borderRadius: radii.md,
                  backgroundColor: colors.paleHorizon,
                  border: `1px solid ${colors.divider}`,
                  color: colors.text.primary,
                  fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >⚖️</button>
            </div>

            {/* Compare modal */}
            <CompareModal destination={destination} visible={compareOpen} onClose={() => setCompareOpen(false)} />

            {/* Disclaimer */}
            <p style={{
              color: colors.text.muted, fontSize: fontSize.md, textAlign: 'center',
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
    <View style={{ flex: 1, backgroundColor: colors.duskSand }}>
      <ScrollView bounces={false}>
        <ImageGallery images={images} city={destination.city} />

        <View style={{ padding: spacing['6'], paddingBottom: spacing['30'] }}>
          <DestinationHero destination={destination} />
          <QuickStats destination={destination} />

          <Text style={{ color: colors.text.body, fontSize: fontSize.xl, lineHeight: 24, marginTop: spacing['4'] }}>
            {destination.description}
          </Text>

          {/* Vibe tags */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing['4'] }}>
            {destination.vibeTags.map((tag) => (
              <View key={tag} style={{
                paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999,
                backgroundColor: colors.paleHorizon,
                borderWidth: 1, borderColor: colors.divider,
              }}>
                <Text style={{ color: colors.deepDusk, fontSize: fontSize.sm, fontWeight: '600', textTransform: 'capitalize' }}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={{ color: colors.detailSubtitle, fontSize: fontSize.lg, fontWeight: '500', marginTop: spacing['4'] }}>
            Best time: {destination.bestMonths.join(', ')}
          </Text>

          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing['6'] }} />

          {/* Flight Deal Card */}
          <View style={{
            padding: spacing['5'], borderRadius: radii['2xl'],
            backgroundColor: colors.paleHorizon,
            borderWidth: 1, borderColor: colors.divider,
            ...shadows.native.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <Text style={{ fontSize: fontSize['5xl'], fontWeight: '800', color: colors.text.primary }}>
                ${effectivePrice}
              </Text>
            </View>
            <Text style={{ color: colors.detailSubtitle, fontSize: fontSize.lg }}>
              {destination.airline ? `${destination.airline} · ` : 'Round-trip · '}{destination.flightDuration}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing['6'] }} />

          {destination.itinerary && destination.itinerary.length > 0 && (
            <>
              <ItineraryTimeline itinerary={destination.itinerary} />
              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing['6'] }} />
            </>
          )}

          {destination.restaurants && destination.restaurants.length > 0 && (
            <RestaurantCards restaurants={destination.restaurants} />
          )}

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
