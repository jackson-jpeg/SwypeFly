import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useDestination } from '@/hooks/useDestination';
import { useBookingSearch } from '@/hooks/useBooking';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import BookingHeader from '@/components/BookingHeader';

const CABIN_CLASSES = ['economy', 'business', 'first'] as const;
const CABIN_LABELS = ['Economy', 'Business', 'First'] as const;

/* ── component ─────────────────────────────────────────────────── */
export default function FlightSelectionScreen() {
  const navigate = useNavigate();
  const { destinationId, feedPrice, setOffer, setCabinClass, passengerCount, setPassengerCount } = useBookingStore();
  const { departureCode } = useUIStore();
  const { data: dest } = useDestination(destinationId ?? undefined);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedCabin, setSelectedCabin] = useState(0);
  const passengers = passengerCount;
  const setPassengers = setPassengerCount;

  const searchParams = useMemo(() => {
    if (!dest) return null;
    return {
      origin: departureCode,
      destination: dest.iataCode,
      departureDate: dest?.departureDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      returnDate: dest?.returnDate,
      passengers: Array.from({ length: passengers }, () => ({ type: 'adult' as const })),
      cabinClass: CABIN_CLASSES[selectedCabin],
      priceHint: feedPrice ?? dest.flightPrice,
    };
  }, [dest, departureCode, selectedCabin, passengers, feedPrice]);

  const { data: offers, isLoading, isError } = useBookingSearch(searchParams);

  if (isLoading || (!offers?.length && !isError)) {
    return (
      <div
        className="screen-fixed"
        style={{ background: colors.duskSand, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        <BookingHeader step={1} stepLabel="Flight Selection" onBack={() => navigate(-1)} onClose={() => navigate('/')} />
        <div style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.mutedText, padding: 40, textAlign: 'center' }}>
          Finding the best flights...
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

  const selectedOffer = offers[selectedDateIdx] ?? offers[0]!;
  // No artificial multipliers — offers already reflect cabin class pricing from search
  const adjustedPrice = selectedOffer.totalAmount;

  const data = {
    destination: dest?.city ?? 'Destination',
    destinationImage: dest?.imageUrl ?? '',
    route: `${departureCode} \u2192 ${dest?.iataCode ?? 'JTR'}`,
    price: adjustedPrice,
    dates: offers.map((o, i) => {
      const dep = new Date(o.slices[0]!.departureTime);
      const ret = new Date(o.slices[1]!.departureTime);
      const nights = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
      const range = `${dep.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${ret.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
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
        <span
          style={{
            display: 'block',
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 12,
            lineHeight: '16px',
            color: colors.mutedText,
            marginTop: 4,
          }}
        >
          Round trip &middot; {CABIN_LABELS[selectedCabin]} &middot; per person
        </span>
      </div>

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
            onClick={() => setSelectedDateIdx(i)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 12,
              padding: '14px 16px',
              gap: 12,
              ...(d.selected
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
                color: d.selected ? colors.confirmGreen : colors.deepDusk,
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
          onClick={() => { setOffer(selectedOffer); setCabinClass(CABIN_CLASSES[selectedCabin] ?? 'economy'); navigate('/booking/passengers'); }}
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
            Lock This Deal
          </span>
        </button>
      </div>
    </div>
  );
}
