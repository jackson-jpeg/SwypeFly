import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import { useDestination } from '@/hooks/useDestination';
import { useCreatePaymentIntent, useCreateOrder } from '@/hooks/useBooking';
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  backgroundColor: colors.offWhite,
  border: '1px solid #C9A99A60',
  borderRadius: 10,
  paddingInline: 14,
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 15,
  color: colors.deepDusk,
  outline: 'none',
};

const fieldLabel: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: colors.borderTint,
};

/* ───── screen ───── */
export default function ReviewPaymentScreen() {
  const navigate = useNavigate();
  const booking = useBookingStore();
  const { departureCode } = useUIStore();
  const { data: dest } = useDestination(booking.destinationId ?? undefined);
  const total = booking.getTotal();
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState(booking.promoCode ?? '');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'google'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const createPaymentIntent = useCreatePaymentIntent();
  const createOrder = useCreateOrder();

  // Derive dynamic baggage label and price
  const bagLabel = booking.selectedBaggage === 'bag-2x23kg' ? '2 checked bags (23 kg each)' : '1 checked bag (23 kg)';
  const bagSvc = booking.selectedOffer?.availableServices.find((s) => s.id === booking.selectedBaggage);
  const bagPrice = bagSvc?.amount ?? (booking.selectedBaggage === 'bag-2x23kg' ? 60 : 35);

  // Derive dynamic meal label and price
  const mealName = booking.selectedMeal?.replace('meal-', '') ?? '';
  const mealLabel = `In-flight meal (${mealName.charAt(0).toUpperCase() + mealName.slice(1)})`;
  const mealSvc = booking.selectedOffer?.availableServices.find((s) => s.id === booking.selectedMeal);
  const mealPrice = mealSvc?.amount ?? ({ 'meal-pasta': 12, 'meal-salad': 10, 'meal-asian': 14 }[booking.selectedMeal ?? ''] ?? 12);

  const lineItems = [
    { label: `Flight (${booking.selectedOffer?.cabinClass ?? 'Economy'}, ${booking.passengerCount} ${booking.passengerCount > 1 ? 'adults' : 'adult'})`, price: `$${(booking.selectedOffer?.totalAmount ?? 387) * booking.passengerCount}`, color: colors.bodyText },
    { label: `Seat ${booking.selectedSeat ?? 'None'}`, price: booking.selectedSeat ? 'Free' : '—', color: booking.selectedSeat ? colors.confirmGreen : colors.bodyText },
    ...(booking.selectedBaggage ? [{ label: bagLabel, price: `$${bagPrice}`, color: colors.bodyText }] : []),
    ...(booking.hasInsurance ? [{ label: 'Trip Protection', price: '$29', color: colors.bodyText }] : []),
    ...(booking.selectedMeal ? [{ label: mealLabel, price: `$${mealPrice}`, color: colors.bodyText }] : []),
  ];

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

        {/* promo code */}
        {promoSuccess ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#A8C4B820', border: '1px solid #A8C4B860', borderRadius: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.confirmGreen }}>
              {promoSuccess} — {Math.round(booking.promoDiscount * 100)}% off applied
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="Promo code"
              value={promoInput}
              onChange={(e) => { setPromoInput(e.target.value); setPromoError(''); }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={() => {
                if (!promoInput.trim()) return;
                const ok = booking.applyPromo(promoInput);
                if (ok) {
                  setPromoSuccess(promoInput.trim().toUpperCase());
                  setPromoError('');
                } else {
                  setPromoError('Invalid promo code');
                  setTimeout(() => setPromoError(''), 3000);
                }
              }}
              style={{
                height: 44,
                paddingInline: 20,
                borderRadius: 10,
                backgroundColor: '#C9A99A20',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 500, color: colors.mutedText }}>
                Apply
              </span>
            </button>
          </div>
        )}
        {promoError && (
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.terracotta }}>
            {promoError}
          </span>
        )}

        {/* payment method */}
        <span style={sectionLabel}>Payment Method</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { key: 'card' as const, label: 'Card', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={paymentMethod === 'card' ? colors.sageDrift : colors.mutedText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            )},
            { key: 'apple' as const, label: 'Apple Pay', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill={paymentMethod === 'apple' ? colors.deepDusk : colors.mutedText}>
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
            )},
            { key: 'google' as const, label: 'Google', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )},
          ].map((method) => {
            const isSelected = paymentMethod === method.key;
            return (
              <button
                key={method.key}
                onClick={() => setPaymentMethod(method.key)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isSelected ? '#A8C4B830' : colors.offWhite,
                  border: isSelected ? `2px solid ${colors.sageDrift}` : '1px solid #C9A99A40',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {method.icon}
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? colors.deepDusk : colors.mutedText }}>
                  {method.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* card form — only shown for card payment */}
        {paymentMethod === 'card' && <div
          style={{
            backgroundColor: colors.offWhite,
            border: '1px solid #C9A99A20',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabel}>Card Number</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Card number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                style={inputStyle}
              />
              {/* Mastercard icon */}
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                <svg width="28" height="18" viewBox="0 0 28 18">
                  <circle cx="10" cy="9" r="8" fill="#EB001B" opacity="0.8" />
                  <circle cx="18" cy="9" r="8" fill="#F79E1B" opacity="0.8" />
                </svg>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>Expiry</span>
              <input
                type="text"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>CVC</span>
              <input
                type="text"
                placeholder="•••"
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>}

        {/* Apple/Google Pay confirmation */}
        {paymentMethod !== 'card' && (
          <div
            style={{
              backgroundColor: colors.offWhite,
              border: '1px solid #C9A99A20',
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.bodyText }}>
              {paymentMethod === 'apple' ? 'Apple Pay' : 'Google Pay'} ready — tap Pay to continue
            </span>
          </div>
        )}

        {/* security note */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBlock: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.confirmGreen }}>
            Secured with 256-bit SSL encryption
          </span>
        </div>
      </div>

      {/* CTA */}
      <div style={{ paddingInline: 20, paddingBottom: 32, paddingTop: 8 }}>
        {payError && (
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta, textAlign: 'center' }}>
            {payError}
          </span>
        )}
        <button
          disabled={paying}
          onClick={async () => {
            setPayError('');
            // Basic card validation (only for card payment)
            if (paymentMethod === 'card' && (!cardNumber.trim() || !expiry.trim() || !cvc.trim())) {
              setPayError('Please fill in all card details');
              return;
            }
            setPaying(true);
            try {
              // Step 1: Create payment intent
              const offerId = booking.selectedOffer?.id ?? 'unknown';
              const pi = await createPaymentIntent.mutateAsync({
                offerId,
                amount: total * 100, // cents
                currency: 'USD',
              });
              // Step 2: Create order with payment
              const orderRes = await createOrder.mutateAsync({
                offerId,
                passengers: booking.passengers.map((p) => ({
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
                  ...(booking.selectedBaggage ? [{ id: booking.selectedBaggage, quantity: 1 }] : []),
                  ...(booking.selectedMeal ? [{ id: booking.selectedMeal, quantity: 1 }] : []),
                ],
                paymentIntentId: pi.paymentIntentId,
              });
              // Step 3: Store response and navigate
              booking.setOrderResponse(orderRes);
              navigate('/booking/confirmation');
            } catch (err) {
              setPaying(false);
              setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
            }
          }}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            backgroundColor: paying ? colors.sageDrift : colors.deepDusk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
    </div>
  );
}
