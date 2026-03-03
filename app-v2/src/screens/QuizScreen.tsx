import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useUIStore } from '@/stores/uiStore';

const TRIP_OPTIONS = [
  { id: 'adventure', label: 'Adventure', subtitle: 'Hiking, diving, thrills', gradient: 'linear-gradient(135deg, #37654E 0%, #5BAF73 100%)' },
  { id: 'culture', label: 'Culture', subtitle: 'Museums, history, food', gradient: 'linear-gradient(135deg, #7A3A2E 0%, #C8724F 100%)' },
  { id: 'romance', label: 'Romance', subtitle: 'Sunsets, wine, beaches', gradient: 'linear-gradient(135deg, #4A3AA0 0%, #8A6BBF 100%)' },
  { id: 'relaxation', label: 'Relaxation', subtitle: 'Spa, pool, slow days', gradient: 'linear-gradient(135deg, #2E4A6E 0%, #5A83AD 100%)' },
];

export default function QuizScreen() {
  const navigate = useNavigate();
  const setVibePrefs = useUIStore((s) => s.setVibePrefs);
  const [selected, setSelected] = useState<Set<string>>(new Set(['adventure']));

  const toggleOption = (id: string) => {
    setSelected((prev) => {
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
    setVibePrefs(Array.from(selected));
    navigate('/');
  };

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
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress bar — single step, fully filled */}
        <div style={{ height: 3, borderRadius: 2, backgroundColor: colors.sageDrift }} />

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
          What kind of trip excites you most?
        </h2>
      </div>

      {/* Options grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '20px 24px', flex: 1 }}>
        {TRIP_OPTIONS.map((opt) => {
          const isSelected = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              style={{
                backgroundImage: opt.gradient,
                backgroundOrigin: 'border-box',
                border: isSelected ? `2px solid ${colors.sageDrift}` : '1px solid #C9A99A40',
                borderRadius: 16,
                cursor: 'pointer',
                flexShrink: 0,
                height: 180,
                width: 'calc(50% - 6px)',
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
                  height: 80,
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
        })}
      </div>

      {/* Continue button */}
      <div style={{ padding: '16px 24px' }}>
        <button
          onClick={handleContinue}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            border: 'none',
            cursor: 'pointer',
            width: '100%',
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
            Continue
          </span>
        </button>
      </div>
    </div>
  );
}
