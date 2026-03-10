import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { colors, fonts, typography } from '@/tokens';
import { apiFetch } from '@/api/client';
import BookingHeader from '@/components/BookingHeader';
import type { HotelQuoteResponse, HotelBookingResponse } from '@/api/types';

function CheckIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

type BookingStep = 'quote' | 'form' | 'paying' | 'confirmed';

export default function HotelBookingScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const accommodationId = params.get('accommodationId') ?? '';
  const roomId = params.get('roomId') ?? '';
  const checkIn = params.get('checkIn') ?? '';
  const checkOut = params.get('checkOut') ?? '';
  const hotelName = params.get('hotelName') ?? 'Hotel';
  const photoUrl = params.get('photoUrl') ?? '';
  const hintPrice = params.get('price') ?? '';
  const currency = params.get('currency') ?? 'USD';

  const [step, setStep] = useState<BookingStep>('quote');
  const [quote, setQuote] = useState<HotelQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form fields
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [confirmation, setConfirmation] = useState<HotelBookingResponse | null>(null);

  // Fetch quote on mount
  useEffect(() => {
    if (!accommodationId) {
      setError('Missing hotel information');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const result = await apiFetch<HotelQuoteResponse>('/api/booking?action=hotel-quote', {
          method: 'POST',
          body: JSON.stringify({ accommodationId, roomId, checkIn, checkOut }),
        });
        if (!cancelled) {
          setQuote(result);
          setStep('form');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to get quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accommodationId, roomId, checkIn, checkOut]);

  const handleBook = async () => {
    if (!quote || !guestName.trim() || !guestEmail.trim()) return;

    setStep('paying');
    setError('');

    try {
      // Create payment intent
      const pi = await apiFetch<{ clientSecret: string; paymentIntentId: string }>('/api/booking?action=payment-intent', {
        method: 'POST',
        body: JSON.stringify({
          offerId: quote.quoteId,
          amount: Math.round(quote.totalAmount * 100),
          currency: quote.currency.toLowerCase(),
        }),
      });

      // In stub mode, payment is auto-succeeded. In live mode, you'd handle Stripe Elements here.
      const result = await apiFetch<HotelBookingResponse>('/api/booking?action=hotel-book', {
        method: 'POST',
        body: JSON.stringify({
          quoteId: quote.quoteId,
          paymentIntentId: pi.paymentIntentId,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
        }),
      });

      setConfirmation(result);
      setStep('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
      setStep('form');
    }
  };

  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    borderRadius: 10,
    border: `1px solid ${colors.borderTint}60`,
    background: colors.duskSand,
    padding: '0 14px',
    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
    fontSize: 15,
    color: colors.deepDusk,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: colors.sageDrift,
    marginBottom: 6,
  };

  // ─── Confirmed state ─────────────────────────────────────────────
  if (step === 'confirmed' && confirmation) {
    return (
      <div
        className="screen"
        style={{
          background: colors.duskSand,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <CheckIcon />
        <h1
          style={{
            ...typography.headline,
            color: colors.deepDusk,
            margin: '16px 0 8px',
          }}
        >
          Hotel Booked!
        </h1>
        <p
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 15,
            color: colors.bodyText,
            margin: '0 0 8px',
          }}
        >
          {confirmation.hotelName}
        </p>
        <p
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 13,
            color: colors.mutedText,
            margin: '0 0 24px',
          }}
        >
          {new Date(confirmation.checkIn + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' '}&ndash;{' '}
          {new Date(confirmation.checkOut + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>

        <div
          style={{
            background: colors.offWhite,
            border: '1px solid #C9A99A20',
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Confirmation</span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 16,
                fontWeight: 700,
                color: colors.deepDusk,
                letterSpacing: '0.04em',
              }}
            >
              {confirmation.confirmationReference}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Total Paid</span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 16,
                fontWeight: 700,
                color: colors.terracotta,
              }}
            >
              ${confirmation.totalAmount}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Status</span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 13,
                fontWeight: 600,
                color: colors.confirmGreen,
                textTransform: 'capitalize',
              }}
            >
              {confirmation.status}
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate('/trips')}
          style={{
            marginTop: 24,
            height: 52,
            borderRadius: 14,
            background: colors.deepDusk,
            color: colors.paleHorizon,
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            maxWidth: 400,
          }}
        >
          View My Trips
        </button>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 8,
            height: 44,
            borderRadius: 12,
            background: 'transparent',
            border: `1.5px solid ${colors.borderTint}`,
            color: colors.deepDusk,
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            maxWidth: 400,
          }}
        >
          Back to Feed
        </button>
      </div>
    );
  }

  // ─── Main flow ─────────────────────────────────────────────────────
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
        step={2}
        totalSteps={2}
        stepLabel="Book Hotel"
        onBack={() => navigate(-1)}
        onClose={() => navigate('/')}
      />

      <div style={{ padding: '0 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Hotel card */}
        <div
          style={{
            background: colors.offWhite,
            border: '1px solid #C9A99A20',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {photoUrl && (
            <img
              src={photoUrl}
              alt={hotelName}
              style={{ width: '100%', height: 140, objectFit: 'cover' }}
            />
          )}
          <div style={{ padding: 16 }}>
            <h2
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontWeight: 700,
                fontSize: 18,
                color: colors.deepDusk,
                margin: 0,
              }}
            >
              {quote?.hotelName || hotelName}
            </h2>
            {quote?.roomName && (
              <p
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 13,
                  color: colors.mutedText,
                  margin: '4px 0 0',
                }}
              >
                {quote.roomName}
              </p>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <div>
                <div style={labelStyle}>Check-in</div>
                <div
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.deepDusk,
                  }}
                >
                  {checkIn ? new Date(checkIn + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Check-out</div>
                <div
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.deepDusk,
                  }}
                >
                  {checkOut ? new Date(checkOut + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Nights</div>
                <div
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.deepDusk,
                  }}
                >
                  {nights}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              color: colors.mutedText,
            }}
          >
            Getting your rate...
          </div>
        )}

        {error && (
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

        {/* Price summary */}
        {quote && (
          <div
            style={{
              background: colors.offWhite,
              border: '1px solid #C9A99A20',
              borderRadius: 16,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={labelStyle}>Rate Summary</div>
            {quote.pricePerNight && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.bodyText }}>
                  ${quote.pricePerNight}/night x {quote.nights ?? nights} nights
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.deepDusk }}>
                  ${quote.totalAmount}
                </span>
              </div>
            )}
            {!quote.pricePerNight && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.bodyText }}>
                  Total ({nights} nights)
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.deepDusk }}>
                  ${quote.totalAmount}
                </span>
              </div>
            )}
            {quote.cancellationPolicy && (
              <p
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 12,
                  color: colors.confirmGreen,
                  margin: '4px 0 0',
                }}
              >
                {quote.cancellationPolicy}
              </p>
            )}
            <div
              style={{
                borderTop: `1px solid ${colors.borderTint}30`,
                paddingTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, fontWeight: 700, color: colors.deepDusk }}>
                Total
              </span>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 22, fontWeight: 800, color: colors.terracotta }}>
                ${quote.totalAmount}
              </span>
            </div>
          </div>
        )}

        {/* Guest form */}
        {step === 'form' && quote && (
          <div
            style={{
              background: colors.offWhite,
              border: '1px solid #C9A99A20',
              borderRadius: 16,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={labelStyle}>Guest Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="John Doe"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="john@example.com"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Book button */}
        {step === 'form' && quote && (
          <button
            onClick={handleBook}
            disabled={!guestName.trim() || !guestEmail.trim()}
            style={{
              height: 56,
              borderRadius: 16,
              background: (!guestName.trim() || !guestEmail.trim()) ? colors.borderTint : colors.deepDusk,
              color: colors.paleHorizon,
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 17,
              fontWeight: 700,
              border: 'none',
              cursor: (!guestName.trim() || !guestEmail.trim()) ? 'not-allowed' : 'pointer',
              marginTop: 'auto',
            }}
          >
            Book Hotel &mdash; ${quote.totalAmount}
          </button>
        )}

        {/* Paying state */}
        {step === 'paying' && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 15,
              color: colors.mutedText,
            }}
          >
            Processing your booking...
          </div>
        )}
      </div>
    </div>
  );
}
