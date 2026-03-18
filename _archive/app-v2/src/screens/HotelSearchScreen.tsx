import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { colors, fonts, typography } from '@/tokens';
import { apiFetch } from '@/api/client';
import BookingHeader from '@/components/BookingHeader';
import type { HotelSearchResult } from '@/api/types';

type SortMode = 'price' | 'rating';

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={i < rating ? colors.terracotta : 'none'}
          stroke={i < rating ? colors.terracotta : colors.borderTint}
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

function BoardTypeLabel({ boardType }: { boardType: string | null }) {
  if (!boardType) return null;
  const labels: Record<string, string> = {
    room_only: 'Room Only',
    breakfast_included: 'Breakfast Included',
    half_board: 'Half Board',
    full_board: 'Full Board',
    all_inclusive: 'All Inclusive',
  };
  return (
    <span
      style={{
        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: colors.confirmGreen,
        backgroundColor: '#C8DDD430',
        padding: '3px 8px',
        borderRadius: 6,
      }}
    >
      {labels[boardType] ?? boardType.replace(/_/g, ' ')}
    </span>
  );
}

export default function HotelSearchScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const lat = parseFloat(params.get('lat') ?? '0');
  const lng = parseFloat(params.get('lng') ?? '0');
  const checkIn = params.get('checkIn') ?? '';
  const checkOut = params.get('checkOut') ?? '';
  const city = params.get('city') ?? 'Destination';

  const [hotels, setHotels] = useState<HotelSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('price');

  useEffect(() => {
    if (!lat && !lng) {
      setError('Missing location coordinates');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const results = await apiFetch<HotelSearchResult[]>('/api/booking?action=hotel-search', {
          method: 'POST',
          body: JSON.stringify({ latitude: lat, longitude: lng, checkIn, checkOut }),
        });
        if (!cancelled) setHotels(results);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to search hotels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng, checkIn, checkOut]);

  const sorted = useMemo(() => {
    const list = [...hotels];
    if (sortBy === 'price') list.sort((a, b) => a.cheapestTotalAmount - b.cheapestTotalAmount);
    else list.sort((a, b) => (b.reviewScore ?? 0) - (a.reviewScore ?? 0));
    return list;
  }, [hotels, sortBy]);

  const handleSelect = (hotel: HotelSearchResult, roomId?: string) => {
    const qs = new URLSearchParams({
      accommodationId: hotel.accommodationId,
      roomId: roomId ?? '',
      checkIn,
      checkOut,
      hotelName: hotel.name,
      photoUrl: hotel.photoUrl ?? '',
      price: String(hotel.cheapestTotalAmount),
      currency: hotel.currency,
    });
    navigate(`/booking/hotel?${qs.toString()}`);
  };

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BookingHeader
        step={1}
        totalSteps={2}
        stepLabel="Select Hotel"
        onBack={() => navigate(-1)}
        onClose={() => navigate('/')}
      />

      <div style={{ padding: '0 20px 20px', flex: 1 }}>
        {/* Title */}
        <h1
          style={{
            ...typography.headline,
            color: colors.deepDusk,
            margin: '0 0 4px',
          }}
        >
          Hotels in {city}
        </h1>
        {checkIn && checkOut && (
          <p
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              color: colors.mutedText,
              margin: '0 0 16px',
            }}
          >
            {new Date(checkIn + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' '}&ndash;{' '}
            {new Date(checkOut + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}

        {/* Sort toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['price', 'rating'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortBy(mode)}
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 20,
                border: sortBy === mode ? `2px solid ${colors.deepDusk}` : `1px solid ${colors.borderTint}`,
                background: sortBy === mode ? colors.deepDusk : 'transparent',
                color: sortBy === mode ? colors.paleHorizon : colors.bodyText,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {mode === 'price' ? 'Price' : 'Rating'}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: colors.offWhite,
                  borderRadius: 16,
                  height: 160,
                  animation: 'shimmer 1.5s ease-in-out infinite',
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: 12,
              padding: 16,
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              color: '#991B1B',
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {!loading && !error && sorted.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 15,
              color: colors.mutedText,
            }}
          >
            No hotels found for these dates.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((hotel) => (
            <div
              key={hotel.accommodationId}
              style={{
                background: colors.offWhite,
                border: '1px solid #C9A99A20',
                borderRadius: 16,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Photo + badge */}
              <div style={{ position: 'relative', height: 160 }}>
                {hotel.photoUrl ? (
                  <img
                    src={hotel.photoUrl}
                    alt={hotel.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: `linear-gradient(135deg, ${colors.sageDrift}, ${colors.warmDusk})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: 32 }}>&#127976;</span>
                  </div>
                )}
                {/* Price badge */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    background: colors.deepDusk,
                    color: colors.paleHorizon,
                    borderRadius: 10,
                    padding: '6px 12px',
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  ${hotel.cheapestTotalAmount}
                  <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7 }}>/total</span>
                </div>
              </div>

              {/* Details */}
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                        fontWeight: 700,
                        fontSize: 16,
                        color: colors.deepDusk,
                        margin: 0,
                      }}
                    >
                      {hotel.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <StarRating rating={hotel.rating} />
                      {hotel.reviewScore != null && (
                        <span
                          style={{
                            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                            fontSize: 12,
                            color: colors.mutedText,
                          }}
                        >
                          {hotel.reviewScore}/10
                          {hotel.reviewCount ? ` (${hotel.reviewCount.toLocaleString()})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <BoardTypeLabel boardType={hotel.boardType} />

                {/* Room options if available */}
                {hotel.rooms && hotel.rooms.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {hotel.rooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => handleSelect(hotel, room.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: colors.duskSand,
                          border: `1px solid ${colors.borderTint}40`,
                          borderRadius: 10,
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                            fontSize: 14,
                            fontWeight: 500,
                            color: colors.deepDusk,
                          }}
                        >
                          {room.name}
                        </span>
                        <span
                          style={{
                            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                            fontSize: 14,
                            fontWeight: 700,
                            color: colors.terracotta,
                          }}
                        >
                          ${room.pricePerNight}/nt
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Fallback select button when no rooms */}
                {(!hotel.rooms || hotel.rooms.length === 0) && (
                  <button
                    onClick={() => handleSelect(hotel)}
                    style={{
                      marginTop: 4,
                      height: 44,
                      borderRadius: 12,
                      background: colors.deepDusk,
                      color: colors.paleHorizon,
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 15,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
