import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useDestination } from '@/hooks/useDestination';
import { useBookingSearch } from '@/hooks/useBooking';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import BookingHeader from '@/components/BookingHeader';
import RouteMap from '@/components/RouteMap';
import AirlineLogo from '@/components/AirlineLogo';
import type { BookingOffer, FlightSlice } from '@/api/types';

const CABIN_CLASSES = ['economy', 'business', 'first'] as const;
const CABIN_LABELS = ['Economy', 'Business', 'First'] as const;

/** Map small/regional airports to nearby major hubs with better Duffel coverage */
const AIRPORT_FALLBACKS: Record<string, string> = {
  PVD: 'BOS', // Providence → Boston Logan
  PIE: 'TPA', // St. Pete-Clearwater → Tampa
  SXB: 'CDG', // Strasbourg → Paris CDG
  BDL: 'BOS', // Hartford → Boston
  ISP: 'JFK', // Long Island → JFK
  SWF: 'EWR', // Stewart → Newark
  HPN: 'JFK', // Westchester → JFK
  ABE: 'PHL', // Allentown → Philadelphia
  MDT: 'PHL', // Harrisburg → Philadelphia
  SRQ: 'TPA', // Sarasota → Tampa
  PBI: 'FLL', // West Palm → Fort Lauderdale
  TYS: 'BNA', // Knoxville → Nashville
  GSO: 'CLT', // Greensboro → Charlotte
};

/* ── Helpers for rich flight cards ─────────────────────────────── */

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(dur: string): string {
  if (!dur) return '';
  // Handle ISO 8601 duration (P1DT8H20M or PT4H35M) or already formatted strings
  const iso = dur.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (iso && (iso[1] || iso[2] || iso[3])) {
    const totalH = (parseInt(iso[1] || '0') * 24) + parseInt(iso[2] || '0');
    const m = iso[3] ? ` ${iso[3]}m` : '';
    return `${totalH}h${m}`.trim();
  }
  return dur;
}

function computeDurationMinutes(slice: FlightSlice): number {
  if (slice.duration) {
    const iso = slice.duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
    if (iso && (iso[1] || iso[2] || iso[3])) return ((parseInt(iso[1] || '0') * 24) + parseInt(iso[2] || '0')) * 60 + parseInt(iso[3] || '0');
    // Handle pre-parsed "32h 20m" format
    const parsed = slice.duration.match(/(\d+)h\s*(\d+)m/);
    if (parsed) return parseInt(parsed[1] ?? '0') * 60 + parseInt(parsed[2] ?? '0');
  }
  // Fallback: compute from departure/arrival times
  if (slice.departureTime && slice.arrivalTime) {
    return (new Date(slice.arrivalTime).getTime() - new Date(slice.departureTime).getTime()) / 60000;
  }
  return Infinity;
}

function totalDurationMinutes(offer: BookingOffer): number {
  return offer.slices.reduce((sum, s) => sum + computeDurationMinutes(s), 0);
}

function stopsLabel(stops: number): string {
  if (stops === 0) return 'Nonstop';
  return `${stops} stop${stops > 1 ? 's' : ''}`;
}

type OfferBadge = 'cheapest' | 'fastest' | null;

function computeBadges(offers: BookingOffer[]): OfferBadge[] {
  if (offers.length === 0) return [];
  let cheapestIdx = 0;
  let fastestIdx = 0;
  let cheapestPrice = Infinity;
  let fastestDur = Infinity;

  offers.forEach((o, i) => {
    if (o.totalAmount < cheapestPrice) { cheapestPrice = o.totalAmount; cheapestIdx = i; }
    const dur = totalDurationMinutes(o);
    if (dur < fastestDur) { fastestDur = dur; fastestIdx = i; }
  });

  const badges: OfferBadge[] = offers.map(() => null);
  // If cheapest and fastest are the same offer, label it cheapest (more useful)
  if (cheapestIdx === fastestIdx) {
    badges[cheapestIdx] = 'cheapest';
  } else {
    badges[cheapestIdx] = 'cheapest';
    badges[fastestIdx] = 'fastest';
  }
  return badges;
}

/* ── SliceSummary: one row for outbound or return ──────────────── */

function SliceSummary({ slice, label }: { slice: FlightSlice; label: string }) {
  const dep = formatTime(slice.departureTime);
  const arr = formatTime(slice.arrivalTime);
  const dur = formatDuration(slice.duration);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 9,
          fontWeight: 600,
          lineHeight: '12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colors.mutedText,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: '18px',
            color: colors.deepDusk,
          }}
        >
          {dep} &rarr; {arr}
        </span>
        {(dur || slice.stops !== undefined) && (
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 11,
              lineHeight: '14px',
              color: colors.mutedText,
            }}
          >
            {dur ? `${dur}` : ''}{dur && slice.stops !== undefined ? ' \u00b7 ' : ''}{slice.stops !== undefined ? stopsLabel(slice.stops) : ''}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── FlightOfferCard ───────────────────────────────────────────── */

function FlightOfferCard({
  offer,
  badge,
  selected,
  onSelect,
}: {
  offer: BookingOffer;
  badge: OfferBadge;
  selected: boolean;
  onSelect: () => void;
}) {
  const outbound = offer.slices[0];
  const returnSlice = offer.slices[1];
  const airlineName = outbound?.airline || 'Airline';
  const airlineCode = outbound?.flightNumber?.match(/^([A-Z]{2})/)?.[1] ?? '';

  return (
    <div
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        display: 'flex',
        borderRadius: 12,
        padding: '14px 16px',
        gap: 12,
        ...(selected
          ? { backgroundColor: '#7BAF8E15', border: '1.5px solid #7BAF8E' }
          : { border: '1px solid #D4CCC0' }),
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* Left: flight details */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
        {/* Airline + badge row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {airlineCode && <AirlineLogo code={airlineCode} size={20} />}
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              fontWeight: 700,
              lineHeight: '16px',
              color: colors.deepDusk,
            }}
          >
            {airlineName}
          </span>
          {badge && (
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 9,
                fontWeight: 700,
                lineHeight: '12px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: badge === 'cheapest' ? '#5A8F6B' : colors.terracotta,
                backgroundColor: badge === 'cheapest' ? '#7BAF8E1A' : '#D4734A1A',
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              {badge === 'cheapest' ? 'Cheapest' : 'Fastest'}
            </span>
          )}
        </div>

        {/* Outbound slice */}
        {outbound && <SliceSummary slice={outbound} label="Outbound" />}

        {/* Return slice */}
        {returnSlice && <SliceSummary slice={returnSlice} label="Return" />}
      </div>

      {/* Right: price */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontSize: 22,
            fontWeight: 800,
            lineHeight: '26px',
            color: selected ? '#5A8F6B' : colors.deepDusk,
          }}
        >
          ${offer.totalAmount.toFixed(2)}
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 10,
            lineHeight: '14px',
            color: colors.mutedText,
          }}
        >
          per person
        </span>
      </div>
    </div>
  );
}

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {firstSegment && (
          <>
            {firstSegment.airline_code && <AirlineLogo code={firstSegment.airline_code} size={20} />}
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
          </>
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
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'departure'>('price');
  const [maxStops, setMaxStops] = useState<number | null>(null); // null = any

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

  // Resolve destination IATA: use fallback hub for small airports, skip same-as-origin
  const resolvedDestCode = useMemo(() => {
    if (!dest?.iataCode) return null;
    let code = dest.iataCode.toUpperCase();
    // If small airport, use nearby major hub
    const fallback = AIRPORT_FALLBACKS[code];
    if (fallback) code = fallback;
    // Can't fly to same airport as origin
    if (code === departureCode.toUpperCase()) return null;
    return code;
  }, [dest?.iataCode, departureCode]);

  const searchParams = useMemo(() => {
    if (!dest || !resolvedDestCode) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDep = new Date(today.getTime() + 2 * 86400000); // At least 2 days from now

    let depDate: Date;
    if (dest?.departureDate) {
      depDate = new Date(dest.departureDate + 'T00:00:00');
      // If cached date is in the past or too soon, push to 14 days out
      if (depDate < minDep) {
        depDate = new Date(today.getTime() + 14 * 86400000);
      }
    } else {
      depDate = new Date(today.getTime() + 14 * 86400000);
    }
    const depDateStr = depDate.toISOString().slice(0, 10);

    // Always ensure round-trip: compute return date (min 2 days, max 10 days from departure)
    let retDate: Date;
    if (dest?.returnDate) {
      retDate = new Date(dest.returnDate + 'T00:00:00');
      const tripDays = Math.round((retDate.getTime() - depDate.getTime()) / 86400000);
      if (tripDays < 2 || tripDays > 10) {
        retDate = new Date(depDate.getTime() + 5 * 86400000);
      }
    } else {
      // Default: 5-day trip
      retDate = new Date(depDate.getTime() + 5 * 86400000);
    }
    const retDateStr = retDate.toISOString().slice(0, 10);

    return {
      origin: departureCode,
      destination: resolvedDestCode,
      departureDate: depDateStr,
      returnDate: retDateStr,
      passengers: Array.from({ length: passengers }, () => ({ type: 'adult' as const })),
      cabinClass: CABIN_CLASSES[selectedCabin],
      priceHint: feedPrice ?? dest.flightPrice,
    };
  }, [dest, resolvedDestCode, departureCode, selectedCabin, passengers, feedPrice]);

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

  // Sort & filter offers (must be before early returns for hook ordering)
  const sortedOffers = useMemo(() => {
    if (!offers) return [];
    let filtered = [...offers];

    // Filter by max stops
    if (maxStops !== null) {
      filtered = filtered.filter(o =>
        o.slices.every(s => (s.stops ?? 0) <= maxStops)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price': return a.totalAmount - b.totalAmount;
        case 'duration': return totalDurationMinutes(a) - totalDurationMinutes(b);
        case 'departure': {
          const aTime = new Date(a.slices[0]?.departureTime ?? '').getTime();
          const bTime = new Date(b.slices[0]?.departureTime ?? '').getTime();
          return aTime - bTime;
        }
        default: return 0;
      }
    });
    return filtered;
  }, [offers, sortBy, maxStops]);

  // Must be before early returns to maintain consistent hook call order
  const badges = useMemo(() => (sortedOffers.length ? computeBadges(sortedOffers) : []), [sortedOffers]);

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

  // Same-origin guard: destination is user's departure city
  if (dest && !resolvedDestCode) {
    return (
      <div
        className="screen-fixed"
        style={{ background: colors.duskSand, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        <BookingHeader step={1} stepLabel="Flight Selection" onBack={() => navigate(-1)} onClose={() => navigate('/')} />
        <div style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
          <div style={{ fontSize: 16, color: colors.deepDusk, fontWeight: 600, marginBottom: 8 }}>
            You're already here!
          </div>
          <div style={{ fontSize: 14, color: colors.mutedText, lineHeight: 1.5 }}>
            {dest.city} is your departure city. Explore other destinations to find great flight deals.
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              borderRadius: 8,
              background: colors.terracotta,
              color: '#fff',
              border: 'none',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Browse Destinations
          </button>
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
        <div style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✈️</div>
          <div style={{ fontSize: 16, color: colors.deepDusk, fontWeight: 600, marginBottom: 8 }}>
            No flights found
          </div>
          <div style={{ fontSize: 14, color: colors.mutedText, lineHeight: 1.5 }}>
            {isError
              ? 'Unable to load flight offers. Please try again later.'
              : `No direct flights available to ${dest?.city ?? 'this destination'}. Try a different date or destination.`}
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              borderRadius: 8,
              background: colors.terracotta,
              color: '#fff',
              border: 'none',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go Back
          </button>
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
    route: `${departureCode} → ${resolvedDestCode ?? dest?.iataCode ?? 'JTR'}`,
    price: adjustedPrice,
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

      {/* ─── Route Map ────────────────────────────────────────── */}
      <div style={{ padding: '0 20px' }}>
        <RouteMap
          originCode={departureCode}
          destCode={dest?.iataCode ?? ''}
          airlineName={offers?.[0]?.slices[0]?.airline}
          duration={offers?.[0]?.slices[0]?.duration ? formatDuration(offers[0]!.slices[0]!.duration) : undefined}
        />
      </div>

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
            ${data.price.toFixed(2)}
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

      {/* ─── Flight Offers ───────────────────────────────────── */}
      <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            Available flights
          </span>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 11,
              lineHeight: '14px',
              color: colors.borderTint,
            }}
          >
            {sortedOffers.length} option{sortedOffers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sort & Filter controls */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {(['price', 'duration', 'departure'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                backgroundColor: sortBy === key ? colors.sageDrift : colors.offWhite,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: sortBy === key ? '#FFFFFF' : colors.mutedText,
                }}
              >
                {key === 'price' ? 'Price' : key === 'duration' ? 'Duration' : 'Departure'}
              </span>
            </button>
          ))}
          <div style={{ width: 1, height: 24, backgroundColor: colors.borderTint, alignSelf: 'center', opacity: 0.3 }} />
          {([null, 0, 1, 2] as const).map((val) => (
            <button
              key={String(val)}
              onClick={() => setMaxStops(val)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                backgroundColor: maxStops === val ? colors.sageDrift : colors.offWhite,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: maxStops === val ? '#FFFFFF' : colors.mutedText,
                }}
              >
                {val === null ? 'Any' : val === 0 ? 'Nonstop' : `${val} max`}
              </span>
            </button>
          ))}
        </div>

        {sortedOffers.map((offer, i) => (
          <FlightOfferCard
            key={offer.id || i}
            offer={offer}
            badge={badges[i] ?? null}
            selected={i === selectedDateIdx && !useCachedOffer}
            onSelect={() => { setSelectedDateIdx(i); setUseCachedOffer(false); }}
          />
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
              ${(data.price * passengers).toFixed(2)}
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
