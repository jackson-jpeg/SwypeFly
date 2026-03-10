import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useAuthContext } from '@/hooks/AuthContext';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import { useDestination } from '@/hooks/useDestination';
import QRCode from '@/components/QRCode';
import AirlineLogo from '@/components/AirlineLogo';
import Confetti from '@/components/Confetti';

/* ───── CSS keyframes for card/check animations ───── */
const CONFETTI_STYLE_ID = 'sogojet-confirm-keyframes';

function injectConfettiStyles() {
  if (document.getElementById(CONFETTI_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = CONFETTI_STYLE_ID;
  style.textContent = `
    @keyframes card-slide-up {
      0% { transform: translateY(40px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes check-pop {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes headline-fade {
      0% { transform: translateY(12px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/* ───── screen ───── */
export default function ConfirmationScreen() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const booking = useBookingStore();
  const { departureCode, departureCity } = useUIStore();
  const { data: dest } = useDestination(booking.destinationId ?? undefined);
  const order = booking.orderResponse;
  const confirmEmail = user?.email || (booking.passengers[0]?.email) || 'your email';
  const seatDesignator = booking.selectedSeat ?? '—';
  const destCity = dest?.city ?? 'Santorini';
  const destIata = dest?.iataCode ?? 'JTR';
  const paxName = order?.passengers?.[0]?.name
    ?? (booking.passengers[0] ? `${booking.passengers[0].given_name} ${booking.passengers[0].family_name}` : user?.name ?? 'Guest');
  const bookingCode = order?.bookingReference ?? `SGJET-${destIata}-PEND`;
  const outboundSlice = booking.selectedOffer?.slices?.[0];
  const airlineName = outboundSlice?.airline ?? '';
  const airlineCode = outboundSlice?.flightNumber?.match(/^([A-Z]{2})/)?.[1] ?? '';

  const [shareLabel, setShareLabel] = useState('Share Your Trip');
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    injectConfettiStyles();
  }, []);

  async function handleShare() {
    const text = `I just booked a trip to ${destCity}! \u2708\uFE0F via SoGoJet`;
    const url = 'https://sogojet.com';

    if (navigator.share) {
      try {
        await navigator.share({ title: `Trip to ${destCity}`, text, url });
      } catch {
        /* user cancelled — ignore */
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareLabel('Copied!');
        setTimeout(() => setShareLabel('Share Your Trip'), 2000);
      } catch {
        /* clipboard denied — ignore */
      }
    }
  }

  return (
    <div
      className="screen-fixed"
      style={{
        background: `linear-gradient(180deg, ${colors.confirmGreen}18 0%, ${colors.duskSand} 35%)`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* canvas confetti explosion */}
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {/* background photo at 8% opacity */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: dest?.imageUrl ? `url(${dest.imageUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.08,
          pointerEvents: 'none',
        }}
      />

      {/* header — minimal for confirmation */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 56,
          paddingBottom: 8,
          gap: 8,
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontSize: 15,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: colors.deepDusk,
            letterSpacing: '0.04em',
          }}
        >
          SoGoJet
        </span>
        {/* full progress bar — all filled */}
        <div style={{ display: 'flex', gap: 3, width: '100%', paddingInline: 20 }}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.sageDrift }} />
          ))}
        </div>
      </div>

      {/* scrollable content */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          paddingInline: 24,
          paddingTop: 32,
          paddingBottom: 32,
          zIndex: 1,
        }}
      >
        {/* green checkmark circle */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: `${colors.confirmGreen}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'check-pop 0.5s ease-out forwards',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        {/* headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            animation: 'headline-fade 0.6s 0.2s ease-out both',
          }}
        >
          <h1
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 28,
              lineHeight: '34px',
              textTransform: 'uppercase',
              color: colors.deepDusk,
              textAlign: 'center',
              margin: 0,
            }}
          >
            You're Going to {destCity}!
          </h1>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              color: colors.borderTint,
            }}
          >
            Confirmation sent to {confirmEmail}
          </span>
          {order && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: order.status === 'confirmed' ? `${colors.confirmGreen}20` : '#F5E6D820',
                borderRadius: 6,
                padding: '4px 10px',
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 12,
                fontWeight: 600,
                color: order.status === 'confirmed' ? colors.confirmGreen : colors.borderTint,
              }}
            >
              {order.status === 'confirmed' ? 'Confirmed' : 'Pending'}
            </span>
          )}
        </div>

        {/* boarding pass card — animated entrance */}
        <div
          style={{
            width: '100%',
            backgroundColor: colors.offWhite,
            borderRadius: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'card-slide-up 0.7s 0.35s ease-out both',
          }}
        >
          {/* top section */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* passenger name + airline */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 500, color: colors.sageDrift, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {paxName}
              </span>
              {airlineName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {airlineCode && <AirlineLogo code={airlineCode} size={20} />}
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, fontWeight: 600, color: colors.deepDusk }}>
                    {airlineName}
                  </span>
                </div>
              )}
            </div>
            {/* header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: colors.deepDusk,
                  letterSpacing: '0.04em',
                }}
              >
                SoGoJet
              </span>
              <span
                style={{
                  fontFamily: `"${fonts.mono}", system-ui, sans-serif`,
                  fontSize: 22,
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: colors.borderTint,
                }}
              >
                Boarding Pass
              </span>
            </div>

            {/* route */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', color: colors.borderTint, letterSpacing: '0.05em' }}>
                  From
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                    fontSize: 36,
                    fontWeight: 800,
                    color: colors.deepDusk,
                    lineHeight: '40px',
                  }}
                >
                  {departureCode}
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.borderTint }}>
                  {departureCity}
                </span>
              </div>

              {/* airplane + stops */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
                </svg>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, color: colors.mutedText }}>
                  {booking.selectedOffer?.slices?.[0]?.stops === 0 ? 'Nonstop' : `${booking.selectedOffer?.slices?.[0]?.stops ?? 1} stop${(booking.selectedOffer?.slices?.[0]?.stops ?? 1) > 1 ? 's' : ''}`}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', color: colors.borderTint, letterSpacing: '0.05em' }}>
                  To
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                    fontSize: 36,
                    fontWeight: 800,
                    color: colors.deepDusk,
                    lineHeight: '40px',
                  }}
                >
                  {destIata}
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.borderTint }}>
                  {destCity}
                </span>
              </div>
            </div>

            {/* details grid */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[
                { label: 'Date', value: (() => {
                  const dep = booking.selectedOffer?.slices?.[0]?.departureTime;
                  if (!dep) return 'TBD';
                  const d = new Date(dep);
                  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},\n${d.getFullYear()}`;
                })() },
                { label: 'Gate', value: 'TBD' },
                { label: 'Seat', value: seatDesignator },
                { label: 'Board', value: (() => {
                  const dep = booking.selectedOffer?.slices?.[0]?.departureTime;
                  if (!dep) return 'TBD';
                  const d = new Date(dep);
                  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                })() },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: colors.borderTint,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 15,
                      fontWeight: 600,
                      color: colors.deepDusk,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* dashed divider */}
          <div
            style={{
              borderTop: `2px dashed ${colors.borderTint}`,
              marginInline: 16,
            }}
          />

          {/* QR code section */}
          <div
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              position: 'relative',
            }}
          >
            {/* faint background image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: dest?.imageUrl ? `url(${dest.imageUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.06,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                pointerEvents: 'none',
              }}
            />
            {/* QR code — encodes booking reference for scanner apps */}
            <div style={{ position: 'relative' }}>
              <QRCode value={bookingCode} size={100} bgColor="#3B2F2A" fgColor="#FFFFFF" />
            </div>
            <span
              style={{
                position: 'relative',
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11,
                color: colors.mutedText,
                letterSpacing: '0.02em',
              }}
            >
              {bookingCode}
            </span>
          </div>
        </div>
      </div>

      {/* Hotel cross-sell */}
      {dest?.latitude && dest?.longitude && (
        <div
          style={{
            position: 'relative',
            paddingInline: 24,
            zIndex: 1,
            animation: 'card-slide-up 0.7s 0.6s ease-out both',
          }}
        >
          <div
            style={{
              width: '100%',
              backgroundColor: colors.offWhite,
              border: '1px solid #C9A99A20',
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: `${colors.sageDrift}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.sageDrift} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l8-4v18" />
                  <path d="M19 21V11l-6-4" />
                  <path d="M9 9v.01" />
                  <path d="M9 12v.01" />
                  <path d="M9 15v.01" />
                  <path d="M9 18v.01" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                    fontSize: 14,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: colors.deepDusk,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Complete Your Trip
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 13,
                    color: colors.mutedText,
                  }}
                >
                  Find hotels in {destCity}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                const depDate = booking.selectedOffer?.slices?.[0]?.departureTime?.split('T')[0] ?? '';
                const retDate = booking.selectedOffer?.slices?.[1]?.departureTime?.split('T')[0] ?? '';
                navigate(`/booking/hotels?lat=${dest.latitude}&lng=${dest.longitude}&checkIn=${depDate}&checkOut=${retDate}&city=${encodeURIComponent(destCity)}`);
              }}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                backgroundColor: 'transparent',
                border: `1.5px solid ${colors.sageDrift}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.sageDrift} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 14,
                  fontWeight: 600,
                  color: colors.sageDrift,
                }}
              >
                Browse Hotels
              </span>
            </button>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div
        style={{
          position: 'relative',
          paddingInline: 20,
          paddingBottom: 32,
          paddingTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 1,
        }}
      >
        {/* Share Your Trip */}
        <button
          onClick={handleShare}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.confirmGreen,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 16,
              fontWeight: 600,
              color: '#FFFFFF',
            }}
          >
            {shareLabel}
          </span>
        </button>

        {/* View Your Trips */}
        <button
          onClick={() => { booking.reset(); navigate('/trips'); }}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 16,
              fontWeight: 600,
              color: colors.paleHorizon,
            }}
          >
            View Your Trips
          </span>
        </button>

        {/* Back to Explore — tertiary link */}
        <button
          onClick={() => { booking.reset(); navigate('/'); }}
          style={{
            width: '100%',
            height: 40,
            borderRadius: 14,
            backgroundColor: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              fontWeight: 500,
              color: colors.borderTint,
            }}
          >
            Back to Explore
          </span>
        </button>
      </div>
    </div>
  );
}
