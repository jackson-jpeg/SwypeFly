import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';

interface GuestGateProps {
  /** What the user was trying to do — shown in the prompt */
  action: string;
  /** Optional description for more context */
  description?: string;
}

/**
 * Shown to guest users when they try to access an auth-required feature.
 * Instead of silently redirecting to login, this shows a friendly prompt
 * explaining why they need to sign in, with a clear CTA.
 */
export default function GuestGate({ action, description }: GuestGateProps) {
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
        padding: '40px 24px',
        gap: 20,
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: `${colors.terracotta}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
        }}
      >
        🔐
      </div>

      {/* Title */}
      <h2
        style={{
          fontFamily: `"${fonts.display}", system-ui, sans-serif`,
          fontSize: 22,
          fontWeight: 700,
          color: colors.deepDusk,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
        }}
      >
        Sign in to {action}
      </h2>

      {/* Description */}
      <p
        style={{
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 15,
          lineHeight: '22px',
          color: colors.mutedText,
          margin: 0,
          maxWidth: 320,
        }}
      >
        {description || `Create a free account or sign in to ${action.toLowerCase()}. It only takes a few seconds.`}
      </p>

      {/* Sign in button */}
      <button
        onClick={() => navigate('/login')}
        style={{
          marginTop: 8,
          width: '100%',
          maxWidth: 300,
          height: 52,
          borderRadius: 14,
          border: 'none',
          backgroundColor: colors.deepDusk,
          color: '#fff',
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Sign In or Create Account
      </button>

      {/* Go back link */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 14,
          color: colors.terracotta,
          cursor: 'pointer',
          padding: '8px 16px',
        }}
      >
        Go Back
      </button>
    </div>
  );
}
