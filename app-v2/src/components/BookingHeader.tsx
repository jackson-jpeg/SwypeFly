import { colors, fonts } from '@/tokens';

export default function BookingHeader({
  step,
  totalSteps = 6,
  stepLabel,
  bgImage,
  onBack,
  onClose,
}: {
  step: number;
  totalSteps?: number;
  stepLabel: string;
  bgImage?: string;
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundColor: bgImage ? undefined : colors.warmDusk,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
