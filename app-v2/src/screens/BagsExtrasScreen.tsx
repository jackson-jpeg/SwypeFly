import type { ReactNode } from 'react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useBookingStore } from '@/stores/bookingStore';
import { useDestination } from '@/hooks/useDestination';
import { useOfferDetail } from '@/hooks/useBooking';
import { useUIStore } from '@/stores/uiStore';
import BookingHeader from '@/components/BookingHeader';

/* ───── toggle ───── */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        backgroundColor: on ? colors.sageDrift : '#C9A99A40',
        borderRadius: 13,
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        height: 26,
        width: 44,
        position: 'relative',
        padding: 0,
      }}
    >
      <div
        style={{
          backgroundColor: on ? '#FFFFFF' : colors.borderTint,
          borderRadius: 11,
          height: 22,
          width: 22,
          position: 'absolute',
          top: 2,
          transition: 'left 0.15s ease, right 0.15s ease',
          ...(on ? { right: 2, left: 'auto' } : { left: 2, right: 'auto' }),
        }}
      />
    </button>
  );
}

/* ───── section label ───── */
const sectionLabel: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: colors.sageDrift,
};

/* ───── baggage option data ───── */
type BagOption = 'one' | 'two' | 'none';
const bagOptions: { key: BagOption; label: string; sub: string; price: string; amount: number; icon: ReactNode }[] = [
  {
    key: 'one',
    label: '1 Bag',
    sub: '23 kg',
    price: '+$35',
    amount: 35,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="7" width="12" height="14" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <path d="M10 21h4" />
      </svg>
    ),
  },
  {
    key: 'two',
    label: '2 Bags',
    sub: '23 kg each',
    price: '+$60',
    amount: 60,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="10" height="12" rx="2" />
        <rect x="10" y="6" width="10" height="12" rx="2" />
        <path d="M7 8V6a2 2 0 0 1 2-2h0" />
        <path d="M13 6V4a2 2 0 0 1 2-2h0" />
      </svg>
    ),
  },
  {
    key: 'none',
    label: 'None',
    sub: 'Carry-on only',
    price: 'Free',
    amount: 0,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round">
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </svg>
    ),
  },
];

/* ───── meal data ───── */
type MealOption = 'pasta' | 'salad' | 'asian';
const mealOptions: { key: MealOption; label: string; price: string; amount: number; icon: ReactNode }[] = [
  {
    key: 'pasta',
    label: 'Pasta',
    price: '+$12',
    amount: 12,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11h18" />
        <path d="M5 11c0 4.4 3.6 8 7 8s7-3.6 7-8" />
        <path d="M9 21h6" />
        <path d="M12 19v2" />
        <path d="M7 3v4" />
        <path d="M12 3v4" />
        <path d="M17 3v4" />
      </svg>
    ),
  },
  {
    key: 'salad',
    label: 'Salad',
    price: '+$10',
    amount: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z" />
        <path d="M7 8c0-2.2 1.8-4 4-4" />
        <path d="M17 8a4 4 0 0 0-4-4" />
      </svg>
    ),
  },
  {
    key: 'asian',
    label: 'Asian',
    price: '+$14',
    amount: 14,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

/* ───── screen ───── */
export default function BagsExtrasScreen() {
  const navigate = useNavigate();
  const { selectedOffer, destinationId, setBaggage, setInsurance: storeSetInsurance, setMeal: storeSetMeal } = useBookingStore();
  const { data: dest } = useDestination(destinationId ?? undefined);
  const { departureCode } = useUIStore();
  const { data: offerDetail } = useOfferDetail(
    selectedOffer?.id ?? null,
    destinationId ?? undefined,
    departureCode,
  );

  // Derive bag/meal prices from offer's availableServices when present, else use defaults
  const liveBagServices = useMemo(() => {
    const services = offerDetail?.offer?.availableServices ?? selectedOffer?.availableServices ?? [];
    return services.filter((s) => s.type === 'baggage');
  }, [offerDetail, selectedOffer]);

  const liveMealServices = useMemo(() => {
    const services = offerDetail?.offer?.availableServices ?? selectedOffer?.availableServices ?? [];
    return services.filter((s) => s.type === 'meal');
  }, [offerDetail, selectedOffer]);

  // Override default prices if live services exist
  const resolvedBagOptions = useMemo(() => {
    if (liveBagServices.length > 0) {
      return bagOptions.map((opt) => {
        if (opt.key === 'none') return opt;
        const svc = opt.key === 'one' ? liveBagServices[0] : liveBagServices[1] ?? liveBagServices[0];
        if (!svc) return opt;
        return { ...opt, amount: svc.amount, price: `+$${svc.amount}`, serviceId: svc.id };
      });
    }
    return bagOptions;
  }, [liveBagServices]);

  const resolvedMealOptions = useMemo(() => {
    if (liveMealServices.length > 0) {
      return mealOptions.map((opt, i) => {
        const svc = liveMealServices[i];
        if (!svc) return opt;
        return { ...opt, amount: svc.amount, price: `+$${svc.amount}`, label: svc.name || opt.label, serviceId: svc.id };
      });
    }
    return mealOptions;
  }, [liveMealServices]);

  const [selectedBag, setSelectedBag] = useState<BagOption>('one');
  const [insurance, setInsurance] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealOption | null>(null);

  const flightPrice = selectedOffer?.totalAmount ?? 387;
  const bagPrice = resolvedBagOptions.find((b) => b.key === selectedBag)?.amount ?? 0;
  const insurancePrice = insurance ? 29 : 0;
  const mealPrice = resolvedMealOptions.find((m) => m.key === selectedMeal)?.amount ?? 0;
  const total = flightPrice + bagPrice + insurancePrice + mealPrice;

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
        step={4}
        stepLabel="Bags & Extras"
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
          gap: 20,
          paddingInline: 20,
          paddingTop: 16,
          paddingBottom: 24,
        }}
      >
        {/* checked baggage */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={sectionLabel}>Checked Baggage</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {resolvedBagOptions.map((opt) => {
              const isSelected = selectedBag === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSelectedBag(opt.key)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    paddingBlock: 16,
                    paddingInline: 8,
                    borderRadius: 14,
                    backgroundColor: isSelected ? '#A8C4B830' : colors.offWhite,
                    border: isSelected ? `2px solid ${colors.sageDrift}` : '1px solid #C9A99A40',
                    cursor: 'pointer',
                  }}
                >
                  {opt.icon}
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.deepDusk }}>
                    {opt.label}
                  </span>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.mutedText }}>
                    {opt.sub}
                  </span>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: opt.amount > 0 ? colors.deepDusk : colors.mutedText }}>
                    {opt.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* travel insurance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={sectionLabel}>Travel Insurance</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.offWhite,
              border: '1px solid #C9A99A20',
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.deepDusk }}>
                  Trip Protection
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, fontWeight: 700, color: colors.deepDusk }}>
                  +$29
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.mutedText, maxWidth: 220 }}>
                  Cancellation, delays, medical coverage up to $50K
                </span>
                <Toggle on={insurance} onToggle={() => setInsurance(!insurance)} />
              </div>
            </div>
          </div>
        </div>

        {/* in-flight meals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={sectionLabel}>In-Flight Meals</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {resolvedMealOptions.map((opt) => {
              const isSelected = selectedMeal === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSelectedMeal(selectedMeal === opt.key ? null : opt.key)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    paddingBlock: 16,
                    paddingInline: 8,
                    borderRadius: 14,
                    backgroundColor: isSelected ? '#A8C4B830' : colors.offWhite,
                    border: isSelected ? `2px solid ${colors.sageDrift}` : '1px solid #C9A99A40',
                    cursor: 'pointer',
                  }}
                >
                  {opt.icon}
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.deepDusk }}>
                    {opt.label}
                  </span>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.deepDusk }}>
                    {opt.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* running total card */}
        <div
          style={{
            backgroundColor: colors.offWhite,
            border: '1px solid #C9A99A20',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <LineItem label="Flight" price={`$${flightPrice}`} />
          {bagPrice > 0 && <LineItem label={resolvedBagOptions.find((b) => b.key === selectedBag)?.label ?? 'Checked bag'} price={`$${bagPrice}`} />}
          {insurancePrice > 0 && <LineItem label="Insurance" price={`$${insurancePrice}`} />}
          {selectedMeal && mealPrice > 0 && <LineItem label={`Meal (${selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)})`} price={`$${mealPrice}`} />}
          <div style={{ height: 1, backgroundColor: '#C9A99A40' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, fontWeight: 700, color: colors.deepDusk }}>
              Total
            </span>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 20, fontWeight: 800, color: colors.deepDusk }}>
              ${total}
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ paddingInline: 20, paddingBottom: 32, paddingTop: 8 }}>
        <button
          onClick={() => {
            const bagOpt = resolvedBagOptions.find((b) => b.key === selectedBag);
            const bagId = bagOpt && bagOpt.amount > 0 ? ((bagOpt as { serviceId?: string }).serviceId ?? `bag-${selectedBag}`) : null;
            setBaggage(bagId);
            storeSetInsurance(insurance);
            const mealOpt = selectedMeal ? resolvedMealOptions.find((m) => m.key === selectedMeal) : null;
            const mealId = mealOpt ? ((mealOpt as { serviceId?: string }).serviceId ?? `meal-${selectedMeal}`) : null;
            storeSetMeal(mealId);
            navigate('/booking/review');
          }}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
            Continue to Review
          </span>
        </button>
      </div>
    </div>
  );
}

function LineItem({ label, price }: { label: string; price: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.borderTint }}>
        {label}
      </span>
      <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.borderTint }}>
        {price}
      </span>
    </div>
  );
}
