import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';

export default function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'clip',
      }}
    >
      {/* Faint background decorative dots at 8% opacity */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none' }}>
        <div style={{ backgroundColor: colors.borderTint, borderRadius: '50%', height: 2, width: 2, position: 'absolute', left: 45, top: 80 }} />
        <div style={{ backgroundColor: '#F4A96A', borderRadius: '50%', height: 3, width: 3, position: 'absolute', left: 280, top: 120 }} />
        <div style={{ backgroundColor: colors.borderTint, borderRadius: '50%', height: 2, width: 2, position: 'absolute', left: 160, top: 200 }} />
        <div style={{ backgroundColor: colors.sageDrift, borderRadius: '50%', height: 2, width: 2, position: 'absolute', left: 60, top: 180 }} />
        <div style={{ backgroundColor: colors.borderTint, borderRadius: '50%', height: 2, width: 2, position: 'absolute', left: 320, top: 250 }} />
        <div style={{ backgroundColor: '#F4A96A', borderRadius: '50%', height: 3, width: 3, position: 'absolute', left: 210, top: 150 }} />
        <div style={{ backgroundColor: colors.borderTint, borderRadius: '50%', height: 2, width: 2, position: 'absolute', left: 90, top: '75%' }} />
        <div style={{ backgroundColor: colors.sageDrift, borderRadius: '50%', height: 2, width: 2, position: 'absolute', left: 300, top: '80%' }} />
        <div style={{ backgroundColor: '#F4A96A', borderRadius: '50%', height: 3, width: 3, position: 'absolute', left: 180, top: '87%' }} />
      </div>

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          padding: 40,
          maxWidth: 375,
          width: '100%',
        }}
      >
        {/* Logo */}
        <p
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: colors.deepDusk,
            margin: 0,
          }}
        >
          SoGoJet
        </p>

        {/* 4O4 with globe icon */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 80,
              lineHeight: '80px',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              color: colors.deepDusk,
            }}
          >
            4
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 54,
              height: 54,
              borderRadius: '50%',
              backgroundColor: colors.seafoamMist,
              flexShrink: 0,
              alignSelf: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.darkerGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 80,
              lineHeight: '80px',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              color: colors.deepDusk,
            }}
          >
            4
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 20,
            lineHeight: '28px',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            textAlign: 'center',
            color: colors.deepDusk,
            margin: 0,
          }}
        >
          This flight got cancelled
        </p>

        {/* Description */}
        <p
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 14,
            lineHeight: '22px',
            color: colors.borderTint,
            textAlign: 'center',
            margin: 0,
          }}
        >
          The page you're looking for doesn't exist or has been moved to a new destination.
        </p>

        {/* Primary button */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            border: 'none',
            cursor: 'pointer',
            width: 260,
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
            Back to Exploring
          </span>
        </button>

        {/* Secondary button */}
        <button
          onClick={() => console.log('Contact support')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            borderRadius: 14,
            backgroundColor: '#A8C4B830',
            border: 'none',
            cursor: 'pointer',
            width: 260,
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: '20px',
              color: colors.sageDrift,
            }}
          >
            Contact Support
          </span>
        </button>
      </div>
    </div>
  );
}
