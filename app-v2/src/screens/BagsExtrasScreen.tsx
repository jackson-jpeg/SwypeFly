import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';

/* ───── shared booking header ───── */
function BookingHeader({
  step,
  stepName,
  onBack,
  onClose,
}: {
  step: number;
  stepName: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 20,
          paddingTop: 56,
          paddingBottom: 8,
        }}
      >
        <button onClick={onBack} style={{ padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
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
        <button onClick={onClose} style={{ padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div style={{ position: 'relative', height: 60 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/images/santorini.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15,
          }}
        />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, paddingInline: 20, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, fontWeight: 600, color: colors.sageDrift }}>
              Step {step} of 6
            </span>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.borderTint }}>
              {stepName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? colors.sageDrift : colors.warmDusk }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [selectedBag, setSelectedBag] = useState<BagOption>('one');
  const [insurance, setInsurance] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealOption>('pasta');

  const flightPrice = 387;
  const bagPrice = bagOptions.find((b) => b.key === selectedBag)?.amount ?? 0;
  const insurancePrice = insurance ? 29 : 0;
  const mealPrice = mealOptions.find((m) => m.key === selectedMeal)?.amount ?? 0;
  const total = flightPrice + bagPrice + insurancePrice + mealPrice;

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BookingHeader
        step={4}
        stepName="Bags & Extras"
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
            {bagOptions.map((opt) => {
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
            {mealOptions.map((opt) => {
              const isSelected = selectedMeal === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSelectedMeal(opt.key)}
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
          <LineItem label="Flight" price="$387" />
          {bagPrice > 0 && <LineItem label="1 checked bag" price={`$${bagPrice}`} />}
          {insurancePrice > 0 && <LineItem label="Insurance" price={`$${insurancePrice}`} />}
          <LineItem label={`Meal (${selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)})`} price={`$${mealPrice}`} />
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
          onClick={() => navigate('/booking/review')}
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
