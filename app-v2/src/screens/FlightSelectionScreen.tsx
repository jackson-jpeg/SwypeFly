import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { STUB_BOOKING_OFFERS, getStubDestination } from '@/api/stubs';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';

/* ── Shared BookingHeader ──────────────────────────────────────── */
export function BookingHeader({
  step,
  totalSteps = 6,
  stepLabel,
  bgImage,
  onBack,
  onClose,
}: {
  step: number;
  totalSteps?: number;
  stepLabel: string;
  bgImage?: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 56,
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Nav row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontSize: 15,
            fontWeight: 800,
            lineHeight: '20px',
            letterSpacing: '0em',
            textTransform: 'uppercase',
            color: colors.deepDusk,
          }}
        >
          SoGoJet
        </span>
        <button onClick={onClose} style={{ padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 12, gap: 8 }}>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 11,
            fontWeight: 600,
            lineHeight: '14px',
            color: colors.sageDrift,
          }}
        >
          Step {step} of {totalSteps}
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: '14px',
            color: colors.borderTint,
          }}
        >
          {stepLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', paddingTop: 8, gap: 3 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 0%',
              height: 3,
              borderRadius: 2,
              backgroundColor: i < step ? colors.sageDrift : colors.warmDusk,
            }}
          />
        ))}
      </div>

      {/* Background photo strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          backgroundImage: `url(${bgImage || 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=600'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/* ── component ─────────────────────────────────────────────────── */
export default function FlightSelectionScreen() {
  const navigate = useNavigate();
  const { destinationId, setOffer } = useBookingStore();
  const { departureCode } = useUIStore();
  const dest = getStubDestination(destinationId ?? '2');
  const offers = STUB_BOOKING_OFFERS;
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedCabin, setSelectedCabin] = useState(0);
  const [passengers, setPassengers] = useState(1);

  const selectedOffer = offers[selectedDateIdx]!;
  const cabinMultiplier = selectedCabin === 1 ? 2.8 : selectedCabin === 2 ? 5.2 : 1;
  const cheapest = Math.min(...offers.map((o) => o.totalAmount));
  const strikethrough = Math.round(cheapest * 1.4 * cabinMultiplier);
  const adjustedPrice = Math.round(selectedOffer.totalAmount * cabinMultiplier);
  const discountPct = Math.round(((strikethrough - Math.round(cheapest * cabinMultiplier)) / strikethrough) * 100);

  const data = {
    destination: dest?.city ?? 'Santorini',
    destinationImage: dest?.imageUrl ?? 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=600',
    route: `${departureCode} \u2192 ${dest?.iataCode ?? 'JTR'} \u00b7 1 stop`,
    price: adjustedPrice,
    strikethrough,
    discountPct,
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
    cabinClasses: ['Economy', 'Business', 'First'] as const,
    selectedCabin,
    passengers,
  };

  return (
    <div
      className="screen"
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
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              lineHeight: '18px',
              color: colors.mutedText,
              textDecoration: 'line-through',
            }}
          >
            ${data.strikethrough}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: colors.confirmGreen,
              borderRadius: 6,
              padding: '3px 8px',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '12px',
              color: '#FFFFFF',
            }}
          >
            {data.discountPct}% OFF
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
          Round trip &middot; {data.cabinClasses[selectedCabin]} &middot; per person
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
          {data.cabinClasses.map((cls, i) => (
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
                ...(i === data.selectedCabin
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
                  color: i === data.selectedCabin ? '#FFFFFF' : colors.deepDusk,
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
              onClick={() => setPassengers((p) => Math.max(1, p - 1))}
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
              onClick={() => setPassengers((p) => Math.min(9, p + 1))}
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
          onClick={() => { setOffer(selectedOffer); navigate('/booking/passengers'); }}
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
