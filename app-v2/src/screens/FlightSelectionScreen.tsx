import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useDestination } from '@/hooks/useDestination';
import { useBookingSearch } from '@/hooks/useBooking';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import BookingHeader from '@/components/BookingHeader';

const CABIN_CLASSES = ['economy', 'business', 'first'] as const;
const CABIN_LABELS = ['Economy', 'Business', 'First'] as const;

/* ── Cached offer card (Best Deal from feed) ───────────────────── */
interface CachedOfferRaw {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at: string;
  slices: {
    origin: string;
    destination: string;
    segments: {
      airline: string;
      airline_code: string;
      flight_number: string;
      departing_at: string;
      arriving_at: string;
      aircraft: string;
      origin: string;
      destination: string;
    }[];
  }[];
  passengers: { id: string; type: string }[];
}

function CachedOfferCard({ offer, selected, onSelect }: { offer: CachedOfferRaw; selected: boolean; onSelect: () => void }) {
  const firstSlice = offer.slices[0];
  const firstSegment = firstSlice?.segments[0];
  const dep = firstSegment ? new Date(firstSegment.departing_at) : null;
  const depLabel = dep
    ? dep.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
  const route = firstSlice ? `${firstSlice.origin} \u2192 ${firstSlice.destination}` : '';
  const stops = (firstSlice?.segments.length ?? 1) - 1;

  return (
    <div
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        padding: '14px 16px',
        gap: 8,
        border: selected ? '1.5px solid #7BAF8E' : '1.5px solid #7BAF8E80',
        backgroundColor: selected ? '#7BAF8E15' : '#7BAF8E08',
      }}
    >
      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#7BAF8E',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#5A8F6B',
            }}
          >
            Best Deal from Feed
          </span>
        </div>
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontSize: 22,
            fontWeight: 800,
            lineHeight: '26px',
            color: selected ? '#5A8F6B' : colors.deepDusk,
          }}
        >
          ${offer.total_amount}
        </span>
      </div>

      {/* Flight info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {firstSegment && (
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              fontWeight: 600,
              lineHeight: '16px',
              color: colors.deepDusk,
            }}
          >
            {firstSegment.airline} {firstSegment.flight_number}
          </span>
        )}
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 11,
            lineHeight: '14px',
            color: colors.mutedText,
          }}
        >
          {route} &middot; {stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Departure info */}
      {depLabel && (
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 11,
            lineHeight: '14px',
            color: colors.borderTint,
          }}
        >
          Departs {depLabel}
        </span>
      )}
    </div>
  );
}

/* ── component ─────────────────────────────────────────────────── */
export default function FlightSelectionScreen() {
  const navigate = useNavigate();
  const { destinationId, feedPrice, setOffer, setCabinClass, passengerCount, setPassengerCount, cachedOfferJson } = useBookingStore();
  const { departureCode } = useUIStore();
  const { data: dest } = useDestination(destinationId ?? undefined);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedCabin, setSelectedCabin] = useState(0);
  const passengers = passengerCount;
  const setPassengers = setPassengerCount;
  const [useCachedOffer, setUseCachedOffer] = useState(false);

  // Parse cached Duffel offer from feed (if available and not expired)
  const cachedOffer = useMemo(() => {
    if (!cachedOfferJson) return null;
    try {
      const parsed = JSON.parse(cachedOfferJson);
      if (parsed.expires_at && new Date(parsed.expires_at) > new Date()) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, [cachedOfferJson]);

  const searchParams = useMemo(() => {
    if (!dest) return null;

    const depDateStr = dest?.departureDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const depDate = new Date(depDateStr + 'T00:00:00');

    // Always ensure round-trip: compute return date (min 2 days, max 10 days from departure)
    let retDate: Date;
    if (dest?.returnDate) {
      retDate = new Date(dest.returnDate + 'T00:00:00');
      const tripDays = Math.round((retDate.getTime() - depDate.getTime()) / 86400000);
      if (tripDays < 2) {
        retDate = new Date(depDate.getTime() + 2 * 86400000);
      } else if (tripDays > 10) {
        retDate = new Date(depDate.getTime() + 7 * 86400000);
      }
    } else {
      // Default: 5-day trip
      retDate = new Date(depDate.getTime() + 5 * 86400000);
    }
    const retDateStr = retDate.toISOString().slice(0, 10);

    return {
      origin: departureCode,
      destination: dest.iataCode,
      departureDate: depDateStr,
      returnDate: retDateStr,
      passengers: Array.from({ length: passengers }, () => ({ type: 'adult' as const })),
      cabinClass: CABIN_CLASSES[selectedCabin],
      priceHint: feedPrice ?? dest.flightPrice,
    };
  }, [dest, departureCode, selectedCabin, passengers, feedPrice]);

  const { data: offers, isLoading, isError } = useBookingSearch(searchParams);

  // ─── Offer expiration tracking (hooks must be before any early returns) ───
  const [timeLeft, setTimeLeft] = useState('');
  const [offerExpired, setOfferExpired] = useState(false);

  const selectedOffer = offers?.[selectedDateIdx] ?? offers?.[0] ?? null;

  const checkExpiry = useCallback(() => {
    if (!selectedOffer?.expiresAt) return;
    const diff = new Date(selectedOffer.expiresAt).getTime() - Date.now();
    if (diff <= 0) {
      setOfferExpired(true);
      setTimeLeft('Expired');
      return;
    }
    setOfferExpired(false);
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    setTimeLeft(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
  }, [selectedOffer?.expiresAt]);

  useEffect(() => {
    checkExpiry();
    const id = setInterval(checkExpiry, 1000);
    return () => clearInterval(id);
  }, [checkExpiry]);

  if (isLoading || (!offers?.length && !isError)) {
    return (
      <div
        className="screen-fixed"
        style={{ background: colors.duskSand, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}
      >
        <BookingHeader step={1} stepLabel="Flight Selection" onBack={() => navigate(-1)} onClose={() => navigate('/')} />

        {/* Show cached offer while live search loads */}
        {cachedOffer && (
          <div style={{ padding: '16px 20px 0' }}>
            <CachedOfferCard offer={cachedOffer} selected={true} onSelect={() => {}} />
          </div>
        )}

        <div style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.mutedText, padding: 40, textAlign: 'center' }}>
          {cachedOffer ? 'Searching for more options...' : 'Finding the best flights...'}
        </div>
      </div>
    );
  }

  if (isError || !offers?.length) {
    return (
      <div
        className="screen-fixed"
        style={{ background: colors.duskSand, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        <BookingHeader step={1} stepLabel="Flight Selection" onBack={() => navigate(-1)} onClose={() => navigate('/')} />
        <div style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.mutedText, padding: 40, textAlign: 'center' }}>
          {isError ? 'Unable to load flight offers. Please try again.' : 'No flights available for this route. Try a different destination.'}
        </div>
      </div>
    );
  }

  // No artificial multipliers — offers already reflect cabin class pricing from search
  const adjustedPrice = useCachedOffer && cachedOffer
    ? parseFloat(cachedOffer.total_amount)
    : selectedOffer!.totalAmount;

  const data = {
    destination: dest?.city ?? 'Destination',
    destinationImage: dest?.imageUrl ?? '',
    route: `${departureCode} \u2192 ${dest?.iataCode ?? 'JTR'}`,
    price: adjustedPrice,
    dates: offers.map((o, i) => {
      const depSlice = o.slices[0];
      const retSlice = o.slices[1];
      const dep = depSlice ? new Date(depSlice.departureTime) : new Date();
      const ret = retSlice ? new Date(retSlice.departureTime) : dep;
      const nights = Math.max(0, Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)));
      const depLabel = dep.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const retLabel = ret.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const range = retSlice ? `${depLabel} \u2013 ${retLabel}` : depLabel;
      return {
        range,
        nights,
        note: i === 0 ? 'Cheapest option' : o.totalAmount > 500 ? 'Peak season' : undefined,
        price: o.totalAmount,
        selected: i === selectedDateIdx,
      };
    }),
    selectedCabin,
    passengers,
  };

  return (
    <div
      className="screen-fixed"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ─── Booking Header ───────────────────────────────────── */}
      <BookingHeader
        step={1}
        stepLabel="Flight Selection"
        bgImage={dest?.imageUrl}
        onBack={() => navigate(-1)}
        onClose={() => navigate('/')}
      />

      {/* ─── Destination Banner ───────────────────────────────── */}
      <div style={{ padding: '0 20px' }}>
        <div
          style={{
            width: '100%',
            height: 80,
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${data.destinationImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: colors.deepDusk,
            }}
          />
          {/* Left gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontSize: 20,
                fontWeight: 800,
                lineHeight: '24px',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {data.destination}
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11,
                lineHeight: '14px',
                color: '#FFFFFFCC',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {data.route}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Price Display ────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        {/* Price row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontSize: 42,
              fontWeight: 800,
              lineHeight: '52px',
              letterSpacing: '-0.02em',
              color: colors.deepDusk,
            }}
          >
            ${data.price}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              lineHeight: '16px',
              color: colors.mutedText,
            }}
          >
            Round trip &middot; {CABIN_LABELS[selectedCabin]} &middot; per person
          </span>
          {timeLeft && (
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11,
                fontWeight: 600,
                lineHeight: '14px',
                color: offerExpired ? '#C44' : colors.borderTint,
                backgroundColor: offerExpired ? '#C4440F' : '#C9A99A20',
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              {offerExpired ? 'Price expired — re-search' : `Offer expires in ${timeLeft}`}
            </span>
          )}
        </div>
      </div>

      {/* ─── Cached Offer (Best Deal) ─────────────────────────── */}
      {cachedOffer && (
        <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 10,
              fontWeight: 600,
              lineHeight: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: colors.mutedText,
            }}
          >
            Instant offer
          </span>
          <CachedOfferCard
            offer={cachedOffer}
            selected={useCachedOffer}
            onSelect={() => setUseCachedOffer(true)}
          />
        </div>
      )}

      {/* ─── Date Options ─────────────────────────────────────── */}
      <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 10,
            fontWeight: 600,
            lineHeight: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: colors.mutedText,
          }}
        >
          Best dates for this price
        </span>

        {data.dates.map((d, i) => (
          <div
            key={i}
            onClick={() => { setSelectedDateIdx(i); setUseCachedOffer(false); }}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 12,
              padding: '14px 16px',
              gap: 12,
              ...(d.selected && !useCachedOffer
                ? {
                    backgroundColor: '#7BAF8E15',
                    border: '1.5px solid #7BAF8E',
                  }
                : {
                    border: '1px solid #D4CCC0',
                  }),
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: '18px',
                  color: colors.deepDusk,
                }}
              >
                {d.range}
              </span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 11,
                  lineHeight: '14px',
                  color: colors.mutedText,
                }}
              >
                {d.nights} nights{d.note ? ` \u00b7 ${d.note}` : ''}
              </span>
            </div>
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontSize: 20,
                fontWeight: 700,
                lineHeight: '24px',
                color: d.selected && !useCachedOffer ? colors.confirmGreen : colors.deepDusk,
              }}
            >
              ${d.price}
            </span>
          </div>
        ))}

      </div>

      {/* ─── Cabin Class ──────────────────────────────────────── */}
      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 10,
            fontWeight: 600,
            lineHeight: '12px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: colors.sageDrift,
          }}
        >
          Cabin Class
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {CABIN_LABELS.map((cls, i) => (
            <button
              key={cls}
              onClick={() => setSelectedCabin(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 36,
                borderRadius: 18,
                paddingLeft: 16,
                paddingRight: 16,
                ...(i === selectedCabin
                  ? { backgroundColor: colors.sageDrift }
                  : { border: `1px solid ${colors.borderTint}`, backgroundColor: 'transparent' }),
              }}
            >
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: '16px',
                  color: i === selectedCabin ? '#FFFFFF' : colors.deepDusk,
                }}
              >
                {cls}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Passengers ───────────────────────────────────────── */}
      <div style={{ padding: '12px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: 12,
            padding: '14px 16px',
            backgroundColor: colors.offWhite,
            border: '1px solid #C9A99A40',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: '18px',
                color: colors.deepDusk,
              }}
            >
              Passengers
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11,
                lineHeight: '14px',
                color: colors.mutedText,
              }}
            >
              Adults (12+)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Minus */}
            <button
              onClick={() => setPassengers(Math.max(1, passengers - 1))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#E8C9A060',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 18,
                lineHeight: '22px',
                color: colors.deepDusk,
                minWidth: 12,
                textAlign: 'center',
              }}
            >
              {data.passengers}
            </span>
            {/* Plus */}
            <button
              onClick={() => setPassengers(Math.min(9, passengers + 1))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#A8C4B830',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Bottom CTA ───────────────────────────────────────── */}
      <div style={{ padding: '10px 20px 28px', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
        {/* Estimated total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              lineHeight: '16px',
              color: colors.borderTint,
            }}
          >
            {passengers > 1 ? `Total (${passengers} passengers)` : 'Estimated total'}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontSize: 28,
                fontWeight: 800,
                lineHeight: '34px',
                color: colors.deepDusk,
              }}
            >
              ${data.price * passengers}
            </span>
            {passengers === 1 && <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 12,
                lineHeight: '16px',
                color: colors.mutedText,
              }}
            >
              per person
            </span>}
          </div>
        </div>

        {/* Lock This Deal */}
        <button
          onClick={() => {
            if (offerExpired && !useCachedOffer) {
              // Force re-search by resetting date index to trigger new query
              setSelectedDateIdx(0);
              window.location.reload();
              return;
            }
            if (useCachedOffer && cachedOffer) {
              // Convert cached Duffel offer to BookingOffer format
              const converted: import('@/api/types').BookingOffer = {
                id: cachedOffer.id,
                totalAmount: parseFloat(cachedOffer.total_amount),
                totalCurrency: cachedOffer.total_currency,
                baseAmount: parseFloat(cachedOffer.total_amount),
                taxAmount: 0,
                slices: cachedOffer.slices.map((s: CachedOfferRaw['slices'][0]) => ({
                  origin: s.origin,
                  destination: s.destination,
                  departureTime: s.segments[0]?.departing_at ?? '',
                  arrivalTime: s.segments[s.segments.length - 1]?.arriving_at ?? '',
                  duration: '',
                  stops: s.segments.length - 1,
                  airline: s.segments[0]?.airline ?? '',
                  flightNumber: s.segments[0]?.flight_number ?? '',
                  aircraft: s.segments[0]?.aircraft ?? '',
                })),
                cabinClass: CABIN_CLASSES[selectedCabin] ?? 'economy',
                passengers: cachedOffer.passengers,
                expiresAt: cachedOffer.expires_at,
                availableServices: [],
              };
              setOffer(converted);
            } else {
              setOffer(selectedOffer!);
            }
            setCabinClass(CABIN_CLASSES[selectedCabin] ?? 'economy');
            navigate('/booking/passengers');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: '20px',
              color: colors.paleHorizon,
            }}
          >
            {offerExpired ? 'Re-search Flights' : 'Lock This Deal'}
          </span>
        </button>
      </div>
    </div>
  );
}
