import { colors, fonts } from '@/tokens';

export default function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      {/* Left branding panel — hidden on mobile */}
      <div className="desktop-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '60px 48px' }}>
          <div>
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                color: colors.deepDusk,
              }}
            >
              SoGo
            </span>
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                color: colors.sageDrift,
              }}
            >
              Jet
            </span>
          </div>
          <p
            style={{
              fontFamily: `"${fonts.accent}", system-ui, sans-serif`,
              fontStyle: 'italic',
              fontSize: 22,
              lineHeight: '32px',
              color: colors.bodyText,
              maxWidth: 320,
            }}
          >
            Swipe your way to adventure. Discover cheap flights, dream destinations, and book in seconds.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {[
              { icon: '✈', text: 'Live flight prices from 50+ airlines' },
              { icon: '🤖', text: 'AI-powered trip planning' },
              { icon: '💰', text: 'Price alerts when deals drop' },
            ].map((item) => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{item.icon}</span>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 14,
                    lineHeight: '20px',
                    color: colors.mutedText,
                  }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 40 }}>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 12,
                color: colors.borderTint,
              }}
            >
              sogojet.com
            </span>
          </div>
        </div>
      </div>

      {/* App content — the mobile column */}
      <div className="desktop-app-column">
        {children}
      </div>
    </div>
  );
}
