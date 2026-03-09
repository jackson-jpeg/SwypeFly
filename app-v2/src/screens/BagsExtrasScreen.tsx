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

/* ───── icons ───── */
const bagIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="7" width="12" height="14" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M10 21h4" />
  </svg>
);
const noBagIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round">
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

const mealIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11h18" />
    <path d="M5 11c0 4.4 3.6 8 7 8s7-3.6 7-8" />
    <path d="M9 21h6" />
    <path d="M12 19v2" />
    <path d="M7 3v4" />
    <path d="M12 3v4" />
    <path d="M17 3v4" />
  </svg>
);

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

  // Only use real Duffel services — no hardcoded fallbacks
  const liveBagServices = useMemo(() => {
    const services = offerDetail?.offer?.availableServices ?? selectedOffer?.availableServices ?? [];
    return services.filter((s) => s.type === 'baggage' || s.type === 'check_bag');
  }, [offerDetail, selectedOffer]);

  const liveMealServices = useMemo(() => {
    const services = offerDetail?.offer?.availableServices ?? selectedOffer?.availableServices ?? [];
    return services.filter((s) => s.type === 'meal');
  }, [offerDetail, selectedOffer]);

  // Build bag options from live data only
  const bagOptions = useMemo(() => {
    const opts: { key: string; label: string; sub: string; price: string; amount: number; serviceId: string; icon: ReactNode }[] = [];
    for (const svc of liveBagServices) {
      const weight = svc.metadata?.weight_kg ? `${svc.metadata.weight_kg} kg` : 'Checked';
      opts.push({
        key: svc.id,
        label: svc.name || `Checked Bag`,
        sub: weight,
        price: `+$${svc.amount}`,
        amount: svc.amount,
        serviceId: svc.id,
        icon: bagIcon,
      });
    }
    return opts;
  }, [liveBagServices]);

  // Build meal options from live data only
  const mealOptions = useMemo(() => {
    return liveMealServices.map((svc) => ({
      key: svc.id,
      label: svc.name || 'Meal',
      price: `+$${svc.amount}`,
      amount: svc.amount,
      serviceId: svc.id,
      icon: mealIcon,
    }));
  }, [liveMealServices]);

  const [selectedBagId, setSelectedBagId] = useState<string | null>(null);
  const [insurance, setInsurance] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);

  const flightPrice = selectedOffer?.totalAmount ?? 0;
  const bagPrice = bagOptions.find((b) => b.key === selectedBagId)?.amount ?? 0;
  const insurancePrice = insurance ? 29 : 0;
  const mealPrice = mealOptions.find((m) => m.key === selectedMealId)?.amount ?? 0;
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
          {bagOptions.length > 0 ? (
            <div style={{ display: 'flex', gap: 10 }}>
              {/* "None" option */}
              <button
                onClick={() => setSelectedBagId(null)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  paddingBlock: 16,
                  paddingInline: 8,
                  borderRadius: 14,
                  backgroundColor: selectedBagId === null ? '#A8C4B830' : colors.offWhite,
                  border: selectedBagId === null ? `2px solid ${colors.sageDrift}` : '1px solid #C9A99A40',
                  cursor: 'pointer',
                }}
              >
                {noBagIcon}
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.deepDusk }}>None</span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.mutedText }}>Carry-on only</span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.mutedText }}>Free</span>
              </button>
              {bagOptions.map((opt) => {
                const isSelected = selectedBagId === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedBagId(opt.key)}
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
                    <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.deepDusk }}>
                      {opt.price}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{
              backgroundColor: colors.offWhite,
              border: '1px solid #C9A99A20',
              borderRadius: 14,
              padding: 16,
              textAlign: 'center',
            }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.mutedText }}>
                Carry-on baggage is included with your fare. Checked bags are not available for purchase on this flight.
              </span>
            </div>
          )}
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

        {/* in-flight meals — only shown when meal services are available */}
        {mealOptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={sectionLabel}>In-Flight Meals</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {mealOptions.map((opt) => {
              const isSelected = selectedMealId === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSelectedMealId(selectedMealId === opt.key ? null : opt.key)}
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
        )}

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
          {bagPrice > 0 && <LineItem label={bagOptions.find((b) => b.key === selectedBagId)?.label ?? 'Checked bag'} price={`$${bagPrice}`} />}
          {insurancePrice > 0 && <LineItem label="Insurance" price={`$${insurancePrice}`} />}
          {selectedMealId && mealPrice > 0 && <LineItem label={mealOptions.find((m) => m.key === selectedMealId)?.label ?? 'Meal'} price={`$${mealPrice}`} />}
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
            setBaggage(selectedBagId);
            storeSetInsurance(insurance);
            storeSetMeal(selectedMealId);
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
