import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useUIStore } from '@/stores/uiStore';
import type { TravelStyle, PreferredSeason } from '@/stores/uiStore';

const TRIP_OPTIONS = [
  { id: 'adventure', label: 'Adventure', subtitle: 'Hiking, diving, thrills', gradient: 'linear-gradient(135deg, #37654E 0%, #5BAF73 100%)' },
  { id: 'culture', label: 'Culture', subtitle: 'Museums, history, food', gradient: 'linear-gradient(135deg, #7A3A2E 0%, #C8724F 100%)' },
  { id: 'romance', label: 'Romance', subtitle: 'Sunsets, wine, beaches', gradient: 'linear-gradient(135deg, #4A3AA0 0%, #8A6BBF 100%)' },
  { id: 'relaxation', label: 'Relaxation', subtitle: 'Spa, pool, slow days', gradient: 'linear-gradient(135deg, #2E4A6E 0%, #5A83AD 100%)' },
];

const STYLE_OPTIONS: { id: TravelStyle; label: string; subtitle: string; gradient: string }[] = [
  { id: 'budget', label: 'Budget', subtitle: 'Best deals, hostels, local food', gradient: 'linear-gradient(135deg, #2D6A4F 0%, #52B788 100%)' },
  { id: 'comfort', label: 'Comfort', subtitle: 'Good hotels, nice restaurants', gradient: 'linear-gradient(135deg, #3A5A8C 0%, #6B9BD2 100%)' },
  { id: 'luxury', label: 'Luxury', subtitle: 'Five-star, fine dining, VIP', gradient: 'linear-gradient(135deg, #6B3FA0 0%, #A87BD4 100%)' },
];

const SEASON_OPTIONS: { id: PreferredSeason; label: string; subtitle: string; gradient: string }[] = [
  { id: 'spring', label: 'Spring', subtitle: 'March - May', gradient: 'linear-gradient(135deg, #4A8C3A 0%, #8CD26B 100%)' },
  { id: 'summer', label: 'Summer', subtitle: 'June - August', gradient: 'linear-gradient(135deg, #C87A2E 0%, #F0B060 100%)' },
  { id: 'fall', label: 'Fall', subtitle: 'September - November', gradient: 'linear-gradient(135deg, #8C4A2E 0%, #C87A50 100%)' },
  { id: 'winter', label: 'Winter', subtitle: 'December - February', gradient: 'linear-gradient(135deg, #2E4A6E 0%, #6B9BD2 100%)' },
];

const TOTAL_STEPS = 3;

export default function QuizScreen() {
  const navigate = useNavigate();
  const setVibePrefs = useUIStore((s) => s.setVibePrefs);
  const setTravelStyle = useUIStore((s) => s.setTravelStyle);
  const setPreferredSeason = useUIStore((s) => s.setPreferredSeason);
  const setBudgetLevel = useUIStore((s) => s.setBudgetLevel);

  const [step, setStep] = useState(0);
  const [selectedVibes, setSelectedVibes] = useState<Set<string>>(new Set(['adventure']));
  const [selectedStyle, setSelectedStyle] = useState<TravelStyle | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<PreferredSeason | null>(null);

  const toggleVibe = (id: string) => {
    setSelectedVibes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      return;
    }
    // Final step — save all prefs and navigate
    setVibePrefs(Array.from(selectedVibes));
    setTravelStyle(selectedStyle);
    setPreferredSeason(selectedSeason);
    // Derive budget level from travel style
    if (selectedStyle === 'budget') setBudgetLevel('low');
    else if (selectedStyle === 'luxury') setBudgetLevel('high');
    else if (selectedStyle === 'comfort') setBudgetLevel('medium');
    else setBudgetLevel(null);
    navigate('/');
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigate(-1);
    }
  };

  const stepTitle = [
    'What kind of trip excites you most?',
    'What\'s your travel style?',
    'When do you like to travel?',
  ][step];

  const canContinue = step === 0
    ? selectedVibes.size > 0
    : step === 1
      ? selectedStyle !== null
      : true; // Season is optional

  const progressWidth = `${((step + 1) / TOTAL_STEPS) * 100}%`;

  const renderOptionCard = (
    opt: { id: string; label: string; subtitle: string; gradient: string },
    isSelected: boolean,
    onPress: () => void,
    halfWidth = true,
  ) => (
    <button
      key={opt.id}
      onClick={onPress}
      style={{
        backgroundImage: opt.gradient,
        backgroundOrigin: 'border-box',
        border: isSelected ? `2px solid ${colors.sageDrift}` : '1px solid #C9A99A40',
        borderRadius: 16,
        cursor: 'pointer',
        flexShrink: 0,
        height: halfWidth ? 180 : 100,
        width: halfWidth ? 'calc(50% - 6px)' : '100%',
        overflow: 'clip',
        position: 'relative',
        padding: 0,
        textAlign: 'left',
      }}
    >
      {/* Bottom gradient overlay */}
      <div
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: halfWidth ? 80 : 60,
        }}
      />

      {/* Checkmark */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.sageDrift,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Label */}
      <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, lineHeight: '20px', color: '#FFFFFF' }}>
          {opt.label}
        </span>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, lineHeight: '14px', color: '#FFFFFFB3' }}>
          {opt.subtitle}
        </span>
      </div>
    </button>
  );

  return (
    <div
      className="screen-fixed"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'clip',
      }}
    >
      {/* Top bar: close + step count */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 24, paddingRight: 24, paddingTop: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handleBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round">
              {step > 0 ? (
                <polyline points="15 18 9 12 15 6" />
              ) : (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              )}
            </svg>
          </button>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: '#6B7280' }}>
            {step + 1} of {TOTAL_STEPS}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, borderRadius: 2, backgroundColor: '#E5E7EB', position: 'relative' }}>
          <div style={{ height: '100%', borderRadius: 2, backgroundColor: colors.sageDrift, width: progressWidth, transition: 'width 0.3s ease' }} />
        </div>

        {/* Question title */}
        <h2
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 24,
            lineHeight: '28px',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: colors.deepDusk,
            margin: 0,
            paddingTop: 8,
          }}
        >
          {stepTitle}
        </h2>
      </div>

      {/* Options grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '20px 24px', flex: 1 }}>
        {step === 0 && TRIP_OPTIONS.map((opt) =>
          renderOptionCard(opt, selectedVibes.has(opt.id), () => toggleVibe(opt.id), true),
        )}
        {step === 1 && STYLE_OPTIONS.map((opt) =>
          renderOptionCard(opt, selectedStyle === opt.id, () => setSelectedStyle(opt.id), false),
        )}
        {step === 2 && SEASON_OPTIONS.map((opt) =>
          renderOptionCard(
            opt,
            selectedSeason === opt.id,
            () => setSelectedSeason(selectedSeason === opt.id ? null : opt.id),
            true,
          ),
        )}
      </div>

      {/* Continue button */}
      <div style={{ padding: '16px 24px' }}>
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            borderRadius: 14,
            backgroundColor: canContinue ? colors.deepDusk : '#9CA3AF',
            border: 'none',
            cursor: canContinue ? 'pointer' : 'default',
            width: '100%',
            opacity: canContinue ? 1 : 0.6,
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
            {step < TOTAL_STEPS - 1 ? 'Continue' : (selectedSeason ? 'Finish' : 'Skip & Finish')}
          </span>
        </button>
      </div>
    </div>
  );
}
