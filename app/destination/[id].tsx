import { View, Text, ScrollView, Pressable, Share, Platform, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { useDestination } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { formatFlightPrice, formatHotelPrice } from '../../utils/formatPrice';
import { flightLink, hotelLink, activitiesLink } from '../../utils/affiliateLinks';
import { useUIStore } from '../../stores/uiStore';

export default function DestinationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toggle, isSaved } = useSaveDestination();
  const { data: destination, isLoading, error } = useDestination(id);
  const departureCode = useUIStore((s) => s.departureCode);

  if (isLoading) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0A0A0A' }}>
          <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#FF6B35', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }}>
        <ActivityIndicator color="#FF6B35" />
      </View>
    );
  }

  if (!destination || error) {
    if (Platform.OS === 'web') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0A0A0A' }}>
          <span style={{ color: '#fff', fontSize: 18 }}>Destination not found</span>
        </div>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }}>
        <Text style={{ color: '#fff', fontSize: 18 }}>Destination not found</Text>
      </View>
    );
  }

  const saved = isSaved(destination.id);
  const images = destination.imageUrls?.length ? destination.imageUrls : [destination.imageUrl];

  const [shareCopied, setShareCopied] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

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

  if (Platform.OS === 'web') {
    return (
      <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', position: 'relative' }}>
        <style>{`
          .sg-cta-btn { transition: filter 0.15s, transform 0.15s; }
          .sg-cta-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
          .sg-cta-btn:active { transform: scale(0.98); }
          .sg-carousel { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
          .sg-carousel::-webkit-scrollbar { display: none; }
          .sg-carousel-img { scroll-snap-align: start; scroll-snap-stop: always; }
        `}</style>
        {/* Close button */}
        <button
          onClick={() => router.back()}
          style={{
            position: 'fixed', top: 16, left: 16, zIndex: 50,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', height: '100vh', maxWidth: 680, margin: '0 auto' }}>
          {/* Photo Carousel */}
          <div style={{ width: '100%', position: 'relative' }}>
            <div
              className="sg-carousel"
              style={{
                display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
              }}
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                const idx = Math.round(target.scrollLeft / target.clientWidth);
                setCarouselIndex(idx);
              }}
            >
              {images.map((url, i) => (
                <div
                  key={i}
                  className="sg-carousel-img"
                  style={{ minWidth: '100%', aspectRatio: '4/3', position: 'relative', flexShrink: 0 }}
                >
                  <img
                    src={url}
                    alt={`${destination.city} ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ))}
            </div>
            {/* Gradient fade */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
              background: 'linear-gradient(transparent, #0A0A0A)',
              pointerEvents: 'none',
            }} />
            {/* Pagination dots */}
            {images.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 6, zIndex: 5,
              }}>
                {images.map((_, i) => (
                  <div key={i} style={{
                    width: i === carouselIndex ? 16 : 6, height: 6, borderRadius: 3,
                    backgroundColor: i === carouselIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.2s ease',
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ padding: '0 24px 120px 24px', marginTop: -16 }}>
            {/* Title */}
            <h1 style={{ margin: 0, color: '#fff', fontSize: 32, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>
              {destination.city}, {destination.country}
            </h1>
            <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.5)', fontSize: 15, fontStyle: 'italic' }}>
              "{destination.tagline}"
            </p>

            {/* Vibe Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {destination.vibeTags.map((tag) => (
                <span key={tag} style={{
                  backgroundColor: 'rgba(255,107,53,0.15)', borderRadius: 20,
                  padding: '5px 14px', border: '1px solid rgba(255,107,53,0.2)',
                  color: '#FF8F65', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' as const,
                }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '24px 0' }} />

            {/* About */}
            <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>About</h3>
            <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6 }}>
              {destination.description}
            </p>

            {/* Best Time */}
            <h3 style={{ margin: '20px 0 0 0', color: '#fff', fontSize: 18, fontWeight: 700 }}>Best Time to Visit</h3>
            <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>
              {destination.bestMonths.join(', ')}
            </p>

            {/* Budget */}
            <h3 style={{ margin: '20px 0 0 0', color: '#fff', fontSize: 18, fontWeight: 700 }}>Budget Estimate</h3>
            <div style={{
              marginTop: 12, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Flights</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
                    {formatFlightPrice(destination.flightPrice, destination.currency, destination.priceSource)}
                  </span>
                  {(destination.priceSource === 'travelpayouts' || destination.priceSource === 'amadeus') && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#4ADE80',
                      backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 4,
                      padding: '2px 6px', letterSpacing: 0.5,
                    }}>
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              {destination.priceFetchedAt && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
                    Updated {(() => {
                      const hrs = Math.round((Date.now() - new Date(destination.priceFetchedAt).getTime()) / 3600000);
                      return hrs < 1 ? 'just now' : `${hrs}h ago`;
                    })()}
                  </span>
                </div>
              )}
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Hotels</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
                    {formatHotelPrice(destination.hotelPricePerNight, destination.currency, destination.hotelPriceSource)}
                  </span>
                  {destination.hotelPriceSource === 'liteapi' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#4ADE80',
                      backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 4,
                      padding: '2px 6px', letterSpacing: 0.5,
                    }}>
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Flight time</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                  {destination.flightDuration}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '24px 0' }} />

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="sg-cta-btn"
                onClick={() => {
                  const url = flightLink(departureCode, destination.iataCode, marker);
                  window.open(url, '_blank');
                }}
                style={{
                  background: '#FF6B35', color: '#fff', border: 'none', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                Check Flights
              </button>
              <button
                className="sg-cta-btn"
                onClick={() => {
                  const url = hotelLink(destination.city, destination.country, marker);
                  window.open(url, '_blank');
                }}
                style={{
                  background: '#2196F3', color: '#fff', border: 'none', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                Find Hotels
              </button>
              <button
                className="sg-cta-btn"
                onClick={() => {
                  const url = activitiesLink(destination.city, destination.country, marker);
                  window.open(url, '_blank');
                }}
                style={{
                  background: '#1A1A1A', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                Things to Do
              </button>

              {/* Save */}
              <button
                className="sg-cta-btn"
                onClick={() => toggle(destination.id)}
                style={{
                  background: saved ? 'rgba(255,107,53,0.15)' : '#1A1A1A',
                  color: saved ? '#FF8F65' : '#fff',
                  border: saved ? '1px solid rgba(255,107,53,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16, padding: '16px 24px', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {saved ? 'Saved' : 'Save'}
              </button>

              {/* Share */}
              <button
                className="sg-cta-btn"
                onClick={handleShare}
                style={{
                  background: '#1A1A1A', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
                  padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {shareCopied ? 'Copied to clipboard' : 'Share'}
              </button>
            </div>

            {/* Disclaimer */}
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', margin: '24px 0 0 0', lineHeight: 1.5 }}>
              Prices are approximate and may vary. We may earn a commission from bookings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Native fallback
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <ScrollView bounces={false}>
        <View style={{ width: '100%', aspectRatio: 1.33 }}>
          <Image source={{ uri: destination.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
        </View>
        <View style={{ padding: 24, paddingBottom: 120 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{destination.city}, {destination.country}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontStyle: 'italic', marginTop: 8 }}>"{destination.tagline}"</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {destination.vibeTags.map((tag) => (
              <View key={tag} style={{ backgroundColor: 'rgba(255,107,53,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,107,53,0.2)' }}>
                <Text style={{ color: '#FF8F65', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 24 }} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>About</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 24, marginTop: 8 }}>{destination.description}</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 20 }}>Best Time to Visit</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 8 }}>{destination.bestMonths.join(', ')}</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 20 }}>Budget Estimate</Text>
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, marginTop: 12, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 18 }}>✈️</Text>
              <Text style={{ color: '#fff', fontSize: 15 }}>Flights {formatFlightPrice(destination.flightPrice, destination.currency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 18 }}>🏨</Text>
              <Text style={{ color: '#fff', fontSize: 15 }}>Hotels {formatHotelPrice(destination.hotelPricePerNight, destination.currency)}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 24 }} />
          <Pressable onPress={() => toggle(destination.id)} style={{ backgroundColor: saved ? 'rgba(255,107,53,0.15)' : '#1A1A1A', borderRadius: 16, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{saved ? '❤️ Saved' : '🤍 Save'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: 52, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
      </Pressable>
    </View>
  );
}
