import { View, Text, ScrollView, Pressable, Share, Platform, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { useDestination } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { formatFlightPrice, formatHotelPrice } from '../../utils/formatPrice';
import { flightLink, hotelLink, activitiesLink } from '../../utils/affiliateLinks';
import { useUIStore } from '../../stores/uiStore';
import ImageGallery from '../../components/destination/ImageGallery';
import FlightScheduleBadge from '../../components/destination/FlightScheduleBadge';
import ItineraryTimeline from '../../components/destination/ItineraryTimeline';
import RestaurantCards from '../../components/destination/RestaurantCards';

export default function DestinationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toggle, isSaved } = useSaveDestination();
  const { data: destination, isLoading, error } = useDestination(id);
  const departureCode = useUIStore((s) => s.departureCode);
  const [shareCopied, setShareCopied] = useState(false);

  if (isLoading) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#F8FAFC' }}>
          <div style={{ width: 24, height: 24, border: '3px solid #E2E8F0', borderTopColor: '#38BDF8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator color="#38BDF8" />
      </View>
    );
  }

  if (!destination || error) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#F8FAFC' }}>
          <span style={{ color: '#1E293B', fontSize: 18 }}>Destination not found</span>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <Text style={{ color: '#1E293B', fontSize: 18 }}>Destination not found</Text>
      </View>
    );
  }

  const saved = isSaved(destination.id);
  const images = destination.imageUrls?.length ? destination.imageUrls : [destination.imageUrl];

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

  const marker = typeof process !== 'undefined'
    ? (process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER || '')
    : '';

  // ─── Web ──────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', position: 'relative' }}>
        <style>{`
          .sg-cta-btn { transition: filter 0.15s, transform 0.15s; }
          .sg-cta-btn:hover { filter: brightness(1.05); transform: scale(1.02); }
          .sg-cta-btn:active { transform: scale(0.98); }
        `}</style>

        {/* Close button - white circle with blur */}
        <button
          onClick={() => router.back()}
          style={{
            position: 'fixed', top: 16, left: 16, zIndex: 50,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.06)',
            color: '#1E293B', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          &#10005;
        </button>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', height: '100vh', maxWidth: 680, margin: '0 auto' }}>
          {/* Hero - Image Gallery */}
          <ImageGallery images={images} city={destination.city} />

          {/* Content */}
          <div style={{ padding: '0 24px 120px 24px', marginTop: -8 }}>
            {/* Title + Rating + Duration */}
            <h1 style={{
              margin: 0, color: '#0F172A', fontSize: 32, fontWeight: 800,
              letterSpacing: -0.5, lineHeight: 1.1,
            }}>
              {destination.city}, {destination.country}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#F59E0B', fontSize: 14 }}>&#9733;</span>
                <span style={{ color: '#334155', fontSize: 14, fontWeight: 600 }}>
                  {destination.rating.toFixed(1)}
                </span>
                <span style={{ color: '#94A3B8', fontSize: 13 }}>
                  ({destination.reviewCount.toLocaleString()})
                </span>
              </div>
              <span style={{ color: '#CBD5E1' }}>|</span>
              <span style={{ color: '#64748B', fontSize: 14 }}>
                {destination.flightDuration} flight
              </span>
            </div>
            <p style={{
              margin: '8px 0 0 0', color: '#64748B', fontSize: 15,
              fontStyle: 'italic',
            }}>
              &ldquo;{destination.tagline}&rdquo;
            </p>

            {/* Flight schedule badge (conditional) */}
            {destination.available_flight_days && destination.available_flight_days.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <FlightScheduleBadge days={destination.available_flight_days} />
              </div>
            )}

            {/* Vibe Tags - sky-blue tints */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {destination.vibeTags.map((tag) => (
                <span key={tag} style={{
                  backgroundColor: 'rgba(56,189,248,0.1)', borderRadius: 20,
                  padding: '5px 14px', border: '1px solid rgba(56,189,248,0.2)',
                  color: '#0EA5E9', fontSize: 13, fontWeight: 600,
                  textTransform: 'capitalize' as const,
                }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Quick stats row */}
            <div style={{
              display: 'flex', gap: 12, marginTop: 20,
              flexWrap: 'wrap',
            }}>
              <div style={{
                flex: '1 1 0', minWidth: 100,
                backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: 12, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>Avg Temp</div>
                <div style={{ color: '#1E293B', fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  {destination.averageTemp}&deg;F
                </div>
              </div>
              <div style={{
                flex: '1 1 0', minWidth: 100,
                backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: 12, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>Flight</div>
                <div style={{ color: '#1E293B', fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  {destination.flightDuration}
                </div>
              </div>
              <div style={{
                flex: '1 1 0', minWidth: 100,
                backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: 12, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>Rating</div>
                <div style={{ color: '#1E293B', fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  {destination.rating.toFixed(1)} &#9733;
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: '#E2E8F0', margin: '24px 0' }} />

            {/* About */}
            <h3 style={{ margin: 0, color: '#1E293B', fontSize: 18, fontWeight: 700 }}>About</h3>
            <p style={{
              margin: '8px 0 0 0', color: '#475569', fontSize: 15, lineHeight: 1.7,
            }}>
              {destination.description}
            </p>

            {/* Itinerary (conditional) */}
            <ItineraryTimeline itinerary={destination.itinerary} />

            {/* Local Bites restaurants (conditional) */}
            <RestaurantCards restaurants={destination.restaurants} />

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: '#E2E8F0', margin: '24px 0' }} />

            {/* Best Time to Visit */}
            <h3 style={{ margin: 0, color: '#1E293B', fontSize: 18, fontWeight: 700 }}>
              Best Time to Visit
            </h3>
            <p style={{ margin: '8px 0 0 0', color: '#475569', fontSize: 15 }}>
              {destination.bestMonths.join(', ')}
            </p>

            {/* Budget Estimate */}
            <h3 style={{ margin: '20px 0 0 0', color: '#1E293B', fontSize: 18, fontWeight: 700 }}>
              Budget Estimate
            </h3>
            <div style={{
              marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
              border: '1px solid #E2E8F0',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontSize: 14 }}>Flights</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#1E293B', fontSize: 15, fontWeight: 600 }}>
                    {formatFlightPrice(destination.flightPrice, destination.currency, destination.priceSource)}
                  </span>
                  {(destination.priceSource === 'travelpayouts' || destination.priceSource === 'amadeus') && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#22C55E',
                      backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 4,
                      padding: '2px 6px', letterSpacing: 0.5,
                    }}>
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              {destination.priceFetchedAt && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#94A3B8', fontSize: 11 }}>
                    Updated {(() => {
                      const hrs = Math.round((Date.now() - new Date(destination.priceFetchedAt).getTime()) / 3600000);
                      return hrs < 1 ? 'just now' : `${hrs}h ago`;
                    })()}
                  </span>
                </div>
              )}
              <div style={{ height: 1, backgroundColor: '#F1F5F9' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontSize: 14 }}>Hotels</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#1E293B', fontSize: 15, fontWeight: 600 }}>
                    {formatHotelPrice(destination.hotelPricePerNight, destination.currency, destination.hotelPriceSource)}
                  </span>
                  {destination.hotelPriceSource === 'liteapi' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#22C55E',
                      backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 4,
                      padding: '2px 6px', letterSpacing: 0.5,
                    }}>
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 1, backgroundColor: '#F1F5F9' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontSize: 14 }}>Flight time</span>
                <span style={{ color: '#475569', fontSize: 14 }}>
                  {destination.flightDuration}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: '#E2E8F0', margin: '24px 0' }} />

            {/* CTAs - sky-blue primary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="sg-cta-btn"
                onClick={() => {
                  const url = flightLink(departureCode, destination.iataCode, marker);
                  window.open(url, '_blank');
                }}
                style={{
                  background: '#38BDF8', color: '#FFFFFF', border: 'none', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 2px 8px rgba(56,189,248,0.3)',
                }}
              >
                &#9992;&#65039; Check Flights
              </button>
              <button
                className="sg-cta-btn"
                onClick={() => {
                  const url = hotelLink(destination.city, destination.country, marker);
                  window.open(url, '_blank');
                }}
                style={{
                  background: '#0EA5E9', color: '#FFFFFF', border: 'none', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 2px 8px rgba(14,165,233,0.25)',
                }}
              >
                &#127976; Find Hotels
              </button>
              <button
                className="sg-cta-btn"
                onClick={() => {
                  const url = activitiesLink(destination.city, destination.country, marker);
                  window.open(url, '_blank');
                }}
                style={{
                  background: '#FFFFFF', color: '#1E293B',
                  border: '1px solid #E2E8F0', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                &#127759; Things to Do
              </button>

              {/* Save */}
              <button
                className="sg-cta-btn"
                onClick={() => toggle(destination.id)}
                style={{
                  background: saved ? 'rgba(56,189,248,0.1)' : '#FFFFFF',
                  color: saved ? '#0EA5E9' : '#1E293B',
                  border: saved ? '1px solid rgba(56,189,248,0.3)' : '1px solid #E2E8F0',
                  borderRadius: 16, padding: '16px 24px', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {saved ? '\u2764\uFE0F Saved' : '\u{1F90D} Save'}
              </button>

              {/* Share */}
              <button
                className="sg-cta-btn"
                onClick={handleShare}
                style={{
                  background: '#FFFFFF', color: '#1E293B',
                  border: '1px solid #E2E8F0', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {shareCopied ? 'Copied to clipboard' : '\u{1F4E4} Share'}
              </button>
            </div>

            {/* Disclaimer */}
            <p style={{
              color: '#94A3B8', fontSize: 12, textAlign: 'center',
              margin: '24px 0 0 0', lineHeight: 1.5,
            }}>
              Prices are approximate and may vary. We may earn a commission from bookings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Native ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView bounces={false}>
        {/* Hero - Image Gallery */}
        <ImageGallery images={images} city={destination.city} />

        <View style={{ padding: 24, paddingBottom: 120 }}>
          {/* Title + Rating + Duration */}
          <Text style={{ color: '#0F172A', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
            {destination.city}, {destination.country}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#F59E0B', fontSize: 14 }}>{'\u2733'}</Text>
              <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600' }}>
                {destination.rating.toFixed(1)}
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>
                ({destination.reviewCount.toLocaleString()})
              </Text>
            </View>
            <Text style={{ color: '#CBD5E1' }}>|</Text>
            <Text style={{ color: '#64748B', fontSize: 14 }}>
              {destination.flightDuration} flight
            </Text>
          </View>
          <Text style={{
            color: '#64748B', fontSize: 15, fontStyle: 'italic', marginTop: 8,
          }}>
            &ldquo;{destination.tagline}&rdquo;
          </Text>

          {/* Flight schedule badge (conditional) */}
          {destination.available_flight_days && destination.available_flight_days.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <FlightScheduleBadge days={destination.available_flight_days} />
            </View>
          )}

          {/* Vibe Tags - sky-blue tints */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {destination.vibeTags.map((tag) => (
              <View key={tag} style={{
                backgroundColor: 'rgba(56,189,248,0.1)', borderRadius: 20,
                paddingHorizontal: 14, paddingVertical: 5,
                borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)',
              }}>
                <Text style={{
                  color: '#0EA5E9', fontSize: 13, fontWeight: '600',
                  textTransform: 'capitalize',
                }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>

          {/* Quick stats row */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <View style={{
              flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
              borderRadius: 12, padding: 12, alignItems: 'center',
            }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500' }}>Avg Temp</Text>
              <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                {destination.averageTemp}{'\u00B0'}F
              </Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
              borderRadius: 12, padding: 12, alignItems: 'center',
            }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500' }}>Flight</Text>
              <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                {destination.flightDuration}
              </Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
              borderRadius: 12, padding: 12, alignItems: 'center',
            }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500' }}>Rating</Text>
              <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                {destination.rating.toFixed(1)} {'\u2B50'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 24 }} />

          {/* About */}
          <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700' }}>About</Text>
          <Text style={{ color: '#475569', fontSize: 15, lineHeight: 24, marginTop: 8 }}>
            {destination.description}
          </Text>

          {/* Itinerary (conditional) */}
          <ItineraryTimeline itinerary={destination.itinerary} />

          {/* Local Bites restaurants (conditional) */}
          <RestaurantCards restaurants={destination.restaurants} />

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 24 }} />

          {/* Best Time to Visit */}
          <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700' }}>
            Best Time to Visit
          </Text>
          <Text style={{ color: '#475569', fontSize: 15, marginTop: 8 }}>
            {destination.bestMonths.join(', ')}
          </Text>

          {/* Budget Estimate */}
          <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700', marginTop: 20 }}>
            Budget Estimate
          </Text>
          <View style={{
            backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 12,
            borderWidth: 1, borderColor: '#E2E8F0', gap: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#64748B', fontSize: 14 }}>Flights</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#1E293B', fontSize: 15, fontWeight: '600' }}>
                  {formatFlightPrice(destination.flightPrice, destination.currency, destination.priceSource)}
                </Text>
                {(destination.priceSource === 'travelpayouts' || destination.priceSource === 'amadeus') && (
                  <View style={{
                    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 4,
                    paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#22C55E', letterSpacing: 0.5 }}>
                      LIVE
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {destination.priceFetchedAt && (
              <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'right' }}>
                Updated {(() => {
                  const hrs = Math.round((Date.now() - new Date(destination.priceFetchedAt).getTime()) / 3600000);
                  return hrs < 1 ? 'just now' : `${hrs}h ago`;
                })()}
              </Text>
            )}
            <View style={{ height: 1, backgroundColor: '#F1F5F9' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#64748B', fontSize: 14 }}>Hotels</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#1E293B', fontSize: 15, fontWeight: '600' }}>
                  {formatHotelPrice(destination.hotelPricePerNight, destination.currency, destination.hotelPriceSource)}
                </Text>
                {destination.hotelPriceSource === 'liteapi' && (
                  <View style={{
                    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 4,
                    paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#22C55E', letterSpacing: 0.5 }}>
                      LIVE
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: '#F1F5F9' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#64748B', fontSize: 14 }}>Flight time</Text>
              <Text style={{ color: '#475569', fontSize: 14 }}>{destination.flightDuration}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 24 }} />

          {/* CTAs - sky-blue primary */}
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => {
                // Native: open link via Linking
                const url = flightLink(departureCode, destination.iataCode, marker);
                import('react-native').then(({ Linking }) => Linking.openURL(url));
              }}
              style={{
                backgroundColor: '#38BDF8', borderRadius: 16, padding: 16,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {'\u2708\uFE0F'} Check Flights
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const url = hotelLink(destination.city, destination.country, marker);
                import('react-native').then(({ Linking }) => Linking.openURL(url));
              }}
              style={{
                backgroundColor: '#0EA5E9', borderRadius: 16, padding: 16,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {'\uD83C\uDFE8'} Find Hotels
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const url = activitiesLink(destination.city, destination.country, marker);
                import('react-native').then(({ Linking }) => Linking.openURL(url));
              }}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: '#E2E8F0',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '700' }}>
                {'\uD83C\uDF0F'} Things to Do
              </Text>
            </Pressable>

            {/* Save */}
            <Pressable
              onPress={() => toggle(destination.id)}
              style={{
                backgroundColor: saved ? 'rgba(56,189,248,0.1)' : '#FFFFFF',
                borderRadius: 16, padding: 16,
                borderWidth: 1,
                borderColor: saved ? 'rgba(56,189,248,0.3)' : '#E2E8F0',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{
                color: saved ? '#0EA5E9' : '#1E293B',
                fontSize: 16, fontWeight: '700',
              }}>
                {saved ? '\u2764\uFE0F Saved' : '\uD83E\uDD0D Save'}
              </Text>
            </Pressable>

            {/* Share */}
            <Pressable
              onPress={handleShare}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: '#E2E8F0',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '700' }}>
                {'\uD83D\uDCE4'} Share
              </Text>
            </Pressable>
          </View>

          {/* Disclaimer */}
          <Text style={{
            color: '#94A3B8', fontSize: 12, textAlign: 'center',
            marginTop: 24, lineHeight: 18,
          }}>
            Prices are approximate and may vary. We may earn a commission from bookings.
          </Text>
        </View>
      </ScrollView>

      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        style={{
          position: 'absolute', top: 52, left: 16,
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.85)',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
        }}
      >
        <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '600' }}>{'\u2715'}</Text>
      </Pressable>
    </View>
  );
}
