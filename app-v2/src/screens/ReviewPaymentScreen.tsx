import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { colors, fonts } from '@/tokens';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import { useDestination } from '@/hooks/useDestination';
import { useCreatePaymentIntent, useCreateOrder } from '@/hooks/useBooking';
import StripeProvider from '@/components/StripeProvider';
import BookingHeader from '@/components/BookingHeader';

/* ───── section label ───── */
const sectionLabel: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: colors.sageDrift,
};


/* ───── stub payment form (no Stripe keys configured) ───── */
function StubPaymentForm({ onSuccess, total }: { onSuccess: () => Promise<void>; total: number }) {
  const [paying, setPaying] = useState(false);
  const [stubError, setStubError] = useState('');

  const handlePay = async () => {
    setPaying(true);
    setStubError('');
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await onSuccess();
    } catch (err) {
      setStubError(err instanceof Error ? err.message : 'Payment failed');
      setPaying(false);
    }
  };

  return (
    <>
      <div
        style={{
          backgroundColor: colors.offWhite,
          border: '1px solid #C9A99A20',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.borderTint }}>Card number</span>
          <div style={{ height: 44, backgroundColor: '#F5ECD7', border: '1px solid #C9A99A60', borderRadius: 10, display: 'flex', alignItems: 'center', paddingInline: 14 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, color: colors.mutedText }}>4242 4242 4242 4242</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.borderTint }}>Expiry</span>
            <div style={{ height: 44, backgroundColor: '#F5ECD7', border: '1px solid #C9A99A60', borderRadius: 10, display: 'flex', alignItems: 'center', paddingInline: 14 }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, color: colors.mutedText }}>12/28</span>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.borderTint }}>CVC</span>
            <div style={{ height: 44, backgroundColor: '#F5ECD7', border: '1px solid #C9A99A60', borderRadius: 10, display: 'flex', alignItems: 'center', paddingInline: 14 }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, color: colors.mutedText }}>123</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', paddingTop: 4 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.terracotta }}>
            Demo mode — no real charge
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBlock: 4 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.confirmGreen }}>
          Demo mode — payment simulation
        </span>
      </div>

      {stubError && (
        <div style={{ padding: '10px 14px', backgroundColor: '#E5736820', borderRadius: 10 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta }}>{stubError}</span>
        </div>
      )}

      <div style={{ paddingTop: 4 }}>
        <button
          disabled={paying}
          onClick={handlePay}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            backgroundColor: paying ? colors.sageDrift : colors.deepDusk,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: paying ? 'wait' : 'pointer',
            opacity: paying ? 0.8 : 1,
            transition: 'background-color 0.3s, opacity 0.3s',
          }}
        >
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, fontWeight: 600, color: colors.paleHorizon }}>
            {paying ? 'Processing...' : `Pay $${total}`}
          </span>
        </button>
      </div>
    </>
  );
}

/* ───── inner payment form (has access to Stripe context) ───── */
function PaymentForm({ onSuccess, total }: { onSuccess: () => Promise<void>; total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPayError('');
    setPaying(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        setPayError(error.message ?? 'Payment failed. Please try again.');
        setPaying(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        await onSuccess();
      } else {
        setPayError('Payment was not completed. Please try again.');
        setPaying(false);
      }
    } catch (err) {
      setPaying(false);
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    }
  };

  return (
    <>
      {/* Stripe Payment Element */}
      <div
        style={{
          backgroundColor: colors.offWhite,
          border: '1px solid #C9A99A20',
          borderRadius: 16,
          padding: 20,
        }}
      >
        <PaymentElement />
      </div>

      {/* security note */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBlock: 4 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.confirmGreen }}>
          Secured with Stripe — your card details never touch our servers
        </span>
      </div>

      {/* CTA */}
      <div style={{ paddingTop: 4 }}>
        {payError && (
          <div style={{ marginBottom: 8, textAlign: 'center' }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta }}>
              {payError}
            </span>
          </div>
        )}
        <button
          disabled={paying || !stripe}
          onClick={handlePay}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            backgroundColor: paying ? colors.sageDrift : colors.deepDusk,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: paying ? 'wait' : 'pointer',
            opacity: paying ? 0.8 : 1,
            transition: 'background-color 0.3s, opacity 0.3s',
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
            {paying ? 'Processing...' : `Pay $${total}`}
          </span>
        </button>
      </div>
    </>
  );
}

/* ───── screen ───── */
export default function ReviewPaymentScreen() {
  const navigate = useNavigate();
  const booking = useBookingStore();
  const { departureCode } = useUIStore();
  const { data: dest } = useDestination(booking.destinationId ?? undefined);
  const total = booking.getTotal();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState('');
  const createPaymentIntent = useCreatePaymentIntent();
  const createOrder = useCreateOrder();

  const offerExpired = booking.selectedOffer?.expiresAt
    ? new Date(booking.selectedOffer.expiresAt) < new Date()
    : false;

  // Derive dynamic baggage label and price from real Duffel service data
  const bagSvc = booking.selectedBaggage
    ? booking.selectedOffer?.availableServices.find((s) => s.id === booking.selectedBaggage)
    : null;
  const bagLabel = bagSvc?.name ?? 'Checked bag';
  const bagPrice = bagSvc?.amount ?? 0;

  // Derive dynamic meal label and price from real Duffel service data
  const mealSvc = booking.selectedMeal
    ? booking.selectedOffer?.availableServices.find((s) => s.id === booking.selectedMeal)
    : null;
  const mealLabel = mealSvc ? `In-flight meal (${mealSvc.name})` : 'In-flight meal';
  const mealPrice = mealSvc?.amount ?? 0;

  const lineItems = [
    { label: `Flight (${booking.selectedOffer?.cabinClass ?? 'Economy'}, ${booking.passengerCount} ${booking.passengerCount > 1 ? 'adults' : 'adult'})`, price: `$${(booking.selectedOffer?.totalAmount ?? 387) * booking.passengerCount}`, color: colors.bodyText },
    { label: booking.selectedSeat ? `Seat ${booking.selectedSeat}` : 'Seat', price: booking.seatPrice > 0 ? `+$${booking.seatPrice}` : booking.selectedSeat ? 'Free' : 'Assigned at check-in', color: booking.seatPrice > 0 ? colors.bodyText : booking.selectedSeat ? colors.confirmGreen : colors.sageDrift },
    ...(booking.selectedBaggage ? [{ label: bagLabel, price: `$${bagPrice}`, color: colors.bodyText }] : []),
    ...(booking.hasInsurance ? [{ label: 'Trip Protection', price: '$29', color: colors.bodyText }] : []),
    ...(booking.selectedMeal ? [{ label: mealLabel, price: `$${mealPrice}`, color: colors.bodyText }] : []),
  ];

  // Create payment intent and get clientSecret for Stripe
  const handleProceedToPayment = async () => {
    setIntentError('');
    setIntentLoading(true);
    try {
      const offerId = booking.selectedOffer?.id ?? 'unknown';
      const pi = await createPaymentIntent.mutateAsync({
        offerId,
        amount: Math.round(total * 100), // cents (round to avoid float issues)
        currency: 'USD',
      });
      setClientSecret(pi.clientSecret);
    } catch (err) {
      setIntentError(err instanceof Error ? err.message : 'Failed to initialize payment');
    } finally {
      setIntentLoading(false);
    }
  };

  // Called after Stripe confirmPayment succeeds — retries order creation with backoff
  const handlePaymentSuccess = async () => {
    const offerId = booking.selectedOffer?.id ?? 'unknown';
    const paymentIntentId = createPaymentIntent.data?.paymentIntentId ?? '';
    // Only send passengers whose IDs match the offer (prevents stale accumulation)
    const offerPaxIds = new Set(
      (booking.selectedOffer?.passengers ?? []).map((p) => p.id),
    );
    const matchedPassengers = offerPaxIds.size > 0
      ? booking.passengers.filter((p) => offerPaxIds.has(p.id))
      : booking.passengers;

    const orderPayload = {
      offerId,
      passengers: matchedPassengers.map((p) => ({
        id: p.id,
        given_name: p.given_name,
        family_name: p.family_name,
        born_on: p.born_on,
        gender: p.gender,
        title: p.title,
        email: p.email,
        phone_number: p.phone_number,
      })),
      selectedServices: [
        // Only include real Duffel service IDs (not fake placeholders)
        ...(booking.seatServiceId ? [{ id: booking.seatServiceId, quantity: 1 }] : []),
        ...(booking.selectedBaggage ? [{ id: booking.selectedBaggage, quantity: 1 }] : []),
        ...(booking.selectedMeal ? [{ id: booking.selectedMeal, quantity: 1 }] : []),
      ].filter((s) => s.id && !s.id.startsWith('seat-') && !s.id.startsWith('bag-') && !s.id.startsWith('meal-')),
      paymentIntentId,
      // Destination metadata for booking history
      destinationCity: dest?.city,
      destinationIata: dest?.iataCode,
      originIata: departureCode,
      departureDate: booking.selectedOffer?.slices?.[0]?.departureTime?.split('T')[0],
      returnDate: booking.selectedOffer?.slices?.[1]?.departureTime?.split('T')[0],
    };

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const orderRes = await createOrder.mutateAsync(orderPayload);
        booking.setOrderResponse(orderRes);
        navigate('/booking/confirmation');
        return;
      } catch {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); // 1s, 2s, 4s
        }
      }
    }

    // All retries failed — payment succeeded but order didn't
    // Store paymentIntentId so a future reconciliation can match it
    try { sessionStorage.setItem('sogojet-orphaned-payment', paymentIntentId); } catch { /* noop */ }
    throw new Error(
      'Your payment was received but we couldn\'t confirm your booking. '
      + 'Don\'t worry — you will not be double-charged. '
      + 'Please contact support@sogojet.com with reference: ' + paymentIntentId.slice(0, 20),
    );
  };

  return (
    <div
      className="screen-fixed"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BookingHeader
        step={5}
        stepLabel="Review & Payment"
        bgImage={dest?.imageUrl}
        onBack={() => navigate(-1)}
        onClose={() => navigate('/')}
      />

      {/* scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingInline: 20,
          paddingTop: 16,
          paddingBottom: 24,
        }}
      >
        {/* order summary */}
        <span style={sectionLabel}>Order Summary</span>
        <div
          style={{
            backgroundColor: colors.offWhite,
            border: '1px solid #C9A99A20',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* route header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontSize: 18,
                fontWeight: 800,
                textTransform: 'uppercase',
                color: colors.deepDusk,
              }}
            >
              {departureCode} → {dest?.city ?? 'Santorini'}
            </span>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.borderTint }}>
              Round trip
            </span>
          </div>

          <div style={{ height: 1, backgroundColor: '#C9A99A40' }} />

          {/* line items */}
          {lineItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.bodyText }}>
                {item.label}
              </span>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 500, color: item.color }}>
                {item.price}
              </span>
            </div>
          ))}

          <div style={{ height: 1, backgroundColor: '#C9A99A40' }} />

          {/* total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, fontWeight: 700, color: colors.deepDusk }}>
              Total
            </span>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 20, fontWeight: 800, color: colors.deepDusk }}>
              ${total}
            </span>
          </div>
        </div>

        {/* promo code — coming soon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            backgroundColor: '#C9A99A10',
            border: '1px solid #C9A99A20',
            borderRadius: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.borderTint }}>
            Promo codes coming soon
          </span>
        </div>

        {/* payment section */}
        <span style={sectionLabel}>Payment</span>

        {clientSecret && clientSecret.startsWith('stub_') ? (
          /* Stub mode — show demo payment form */
          <StubPaymentForm onSuccess={handlePaymentSuccess} total={total} />
        ) : clientSecret ? (
          /* Stripe Elements loaded — show PaymentElement + Pay button */
          <StripeProvider clientSecret={clientSecret}>
            <PaymentForm onSuccess={handlePaymentSuccess} total={total} />
          </StripeProvider>
        ) : (
          /* Pre-payment: show "Proceed to Payment" button */
          <>
            {intentError && (
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta }}>
                  {intentError}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA — only shown before Stripe is loaded */}
      {!clientSecret && (
        <div style={{ paddingInline: 20, paddingBottom: 32, paddingTop: 8 }}>
          {offerExpired && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta }}>
                This offer has expired. Please go back and select a new flight.
              </span>
            </div>
          )}
          <button
            disabled={intentLoading || offerExpired}
            onClick={handleProceedToPayment}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: 'none',
              backgroundColor: intentLoading || offerExpired ? colors.sageDrift : colors.deepDusk,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: intentLoading || offerExpired ? 'not-allowed' : 'pointer',
              opacity: intentLoading || offerExpired ? 0.6 : 1,
              transition: 'background-color 0.3s, opacity 0.3s',
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
              {intentLoading ? 'Initializing...' : offerExpired ? 'Offer Expired' : `Proceed to Pay $${total}`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
