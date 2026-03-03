import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useAuthContext } from '@/hooks/AuthContext';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithApple, browseAsGuest } = useAuthContext();

  return (
    <div className="screen" style={{ background: colors.duskSand, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'clip' }}>
      {/* Background destination photo — 15% opacity */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/images/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          opacity: 0.15,
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 60,
          paddingTop: 80,
          paddingBottom: 40,
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        {/* Logo + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <h1
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 32,
              lineHeight: '36px',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              color: colors.deepDusk,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Welcome to SoGoJet
          </h1>
          <p
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              lineHeight: '18px',
              color: colors.borderTint,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Discover incredible flight deals and plan your perfect trip
          </p>
        </div>

        {/* Auth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          {/* Google */}
          <button
            onClick={() => signInWithGoogle()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              height: 56,
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: '18px',
                color: colors.deepDusk,
              }}
            >
              Continue with Google
            </span>
          </button>

          {/* Apple */}
          <button
            onClick={() => signInWithApple()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              height: 56,
              borderRadius: 14,
              backgroundColor: colors.deepDusk,
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: '18px',
                color: colors.paleHorizon,
              }}
            >
              Continue with Apple
            </span>
          </button>

          {/* Email */}
          <button
            onClick={() => console.log('Email auth')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              height: 56,
              borderRadius: 14,
              backgroundColor: colors.offWhite,
              border: '1px solid #C9A99A40',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: '18px',
                color: colors.deepDusk,
              }}
            >
              Continue with Email
            </span>
          </button>
        </div>
      </div>

      {/* Bottom section: Guest + Terms */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 40,
          marginTop: 'auto',
        }}
      >
        <button
          onClick={() => { browseAsGuest(); navigate('/'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            borderRadius: 14,
            backgroundColor: '#A8C4B830',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: '18px',
              color: colors.sageDrift,
            }}
          >
            Continue as Guest
          </span>
        </button>
        <p
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 11,
            lineHeight: '14px',
            color: colors.borderTint,
            textAlign: 'center',
            margin: 0,
          }}
        >
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );
}
