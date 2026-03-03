import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useAuthContext } from '@/hooks/AuthContext';

/* ───── screen ───── */
export default function ConfirmationScreen() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const confirmEmail = user?.email || 'your email';

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* background photo at 8% opacity */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/images/santorini.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.08,
          pointerEvents: 'none',
        }}
      />

      {/* header — minimal for confirmation */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 56,
          paddingBottom: 8,
          gap: 8,
        }}
      >
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
        {/* full progress bar — all filled */}
        <div style={{ display: 'flex', gap: 3, width: '100%', paddingInline: 20 }}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.sageDrift }} />
          ))}
        </div>
      </div>

      {/* scrollable content */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          paddingInline: 24,
          paddingTop: 32,
          paddingBottom: 32,
        }}
      >
        {/* green checkmark circle */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: `${colors.confirmGreen}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <h1
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 28,
              lineHeight: '34px',
              textTransform: 'uppercase',
              color: colors.deepDusk,
              textAlign: 'center',
              margin: 0,
            }}
          >
            You're Going to Santorini!
          </h1>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              color: colors.borderTint,
            }}
          >
            Confirmation sent to {confirmEmail}
          </span>
        </div>

        {/* boarding pass card */}
        <div
          style={{
            width: '100%',
            backgroundColor: colors.offWhite,
            borderRadius: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* top section */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: colors.deepDusk,
                  letterSpacing: '0.04em',
                }}
              >
                SoGoJet
              </span>
              <span
                style={{
                  fontFamily: `"${fonts.mono}", system-ui, sans-serif`,
                  fontSize: 22,
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: colors.borderTint,
                }}
              >
                Boarding Pass
              </span>
            </div>

            {/* route */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', color: colors.borderTint, letterSpacing: '0.05em' }}>
                  From
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                    fontSize: 36,
                    fontWeight: 800,
                    color: colors.deepDusk,
                    lineHeight: '40px',
                  }}
                >
                  JFK
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.borderTint }}>
                  New York
                </span>
              </div>

              {/* airplane + stops */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
                </svg>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, color: colors.mutedText }}>
                  1 stop
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', color: colors.borderTint, letterSpacing: '0.05em' }}>
                  To
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                    fontSize: 36,
                    fontWeight: 800,
                    color: colors.deepDusk,
                    lineHeight: '40px',
                  }}
                >
                  JTR
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.borderTint }}>
                  Santorini
                </span>
              </div>
            </div>

            {/* details grid */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[
                { label: 'Date', value: 'Jun 16,\n2026' },
                { label: 'Gate', value: 'B42' },
                { label: 'Seat', value: '14C' },
                { label: 'Board', value: '08:15' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: colors.borderTint,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 15,
                      fontWeight: 600,
                      color: colors.deepDusk,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* dashed divider */}
          <div
            style={{
              borderTop: `2px dashed ${colors.borderTint}`,
              marginInline: 16,
            }}
          />

          {/* QR code section */}
          <div
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              position: 'relative',
            }}
          >
            {/* faint background image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'url(/images/santorini.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.06,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                pointerEvents: 'none',
              }}
            />
            {/* QR placeholder */}
            <div
              style={{
                position: 'relative',
                width: 100,
                height: 100,
                backgroundColor: '#3B2F2A',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* simple QR pattern placeholder */}
              <svg width="60" height="60" viewBox="0 0 60 60">
                <rect x="0" y="0" width="20" height="20" rx="3" fill="#FFFFFF" opacity="0.3" />
                <rect x="24" y="0" width="12" height="12" rx="2" fill="#FFFFFF" opacity="0.2" />
                <rect x="40" y="0" width="20" height="20" rx="3" fill="#FFFFFF" opacity="0.3" />
                <rect x="0" y="24" width="12" height="12" rx="2" fill="#FFFFFF" opacity="0.2" />
                <rect x="16" y="24" width="8" height="8" rx="1" fill="#FFFFFF" opacity="0.15" />
                <rect x="28" y="20" width="12" height="12" rx="2" fill="#FFFFFF" opacity="0.2" />
                <rect x="44" y="24" width="8" height="8" rx="1" fill="#FFFFFF" opacity="0.15" />
                <rect x="0" y="40" width="20" height="20" rx="3" fill="#FFFFFF" opacity="0.3" />
                <rect x="24" y="40" width="8" height="8" rx="1" fill="#FFFFFF" opacity="0.15" />
                <rect x="36" y="44" width="12" height="12" rx="2" fill="#FFFFFF" opacity="0.2" />
                <rect x="52" y="44" width="8" height="8" rx="1" fill="#FFFFFF" opacity="0.15" />
              </svg>
            </div>
            <span
              style={{
                position: 'relative',
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11,
                color: colors.mutedText,
                letterSpacing: '0.02em',
              }}
            >
              SGJET-2026-0616
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ position: 'relative', paddingInline: 20, paddingBottom: 32, paddingTop: 8 }}>
        <button
          onClick={() => navigate('/')}
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
            Back to Explore
          </span>
        </button>
      </div>
    </div>
  );
}
