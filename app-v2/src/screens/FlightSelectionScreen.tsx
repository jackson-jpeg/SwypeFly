import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';

/* ── Shared BookingHeader ──────────────────────────────────────── */
export function BookingHeader({
  step,
  totalSteps = 6,
  stepLabel,
  onBack,
  onClose,
}: {
  step: number;
  totalSteps?: number;
  stepLabel: string;
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
          backgroundImage: 'url(/images/santorini.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/* ── stub data ─────────────────────────────────────────────────── */
const FLIGHT_DATA = {
  destination: 'Santorini',
  destinationImage: '/images/santorini.jpg',
  route: 'JFK \u2192 JTR \u00b7 1 stop via ATH',
  price: 387,
  strikethrough: 542,
  discountPct: 29,
  dates: [
    { range: 'Jun 15 \u2013 Jun 22', nights: 7, note: 'Cheapest option', price: 387, selected: true },
    { range: 'Jun 22 \u2013 Jun 29', nights: 7, note: undefined, price: 412, selected: false },
    { range: 'Jul 1 \u2013 Jul 8', nights: 7, note: 'Peak season', price: 509, selected: false },
  ],
  cabinClasses: ['Economy', 'Business', 'First'] as const,
  selectedCabin: 0,
  passengers: 1,
};

/* ── component ─────────────────────────────────────────────────── */
export default function FlightSelectionScreen() {
  const navigate = useNavigate();
  const data = FLIGHT_DATA;

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
          Round trip &middot; Economy &middot; per person
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
            style={{
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

        {/* Choose different dates */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              lineHeight: '16px',
              color: colors.mutedText,
            }}
          >
            Choose different dates
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#E8C9A060',
                flexShrink: 0,
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#A8C4B830',
                flexShrink: 0,
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
            Estimated total
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
              ${data.price}
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 12,
                lineHeight: '16px',
                color: colors.mutedText,
              }}
            >
              per person
            </span>
          </div>
        </div>

        {/* Lock This Deal */}
        <button
          onClick={() => navigate('/booking/passengers')}
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
