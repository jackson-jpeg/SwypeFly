import { Platform } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/theme';

const LINKS = [
  { section: 'Company', items: [
    { label: 'About SoGoJet', path: null, href: '#' },
    { label: 'How It Works', path: null, href: '#' },
    { label: 'Privacy', path: '/legal/privacy' },
    { label: 'Terms', path: '/legal/terms' },
  ]},
  { section: 'Explore', items: [
    { label: '🏝️ Bali', path: '/destination/1' },
    { label: '🇬🇷 Santorini', path: '/destination/2' },
    { label: '🇯🇵 Tokyo', path: '/destination/3' },
    { label: '🇵🇪 Machu Picchu', path: '/destination/4' },
    { label: '🇲🇦 Marrakech', path: '/destination/5' },
    { label: '🇮🇸 Iceland', path: '/destination/6' },
  ]},
];

const SOCIALS = [
  { emoji: '𝕏', label: 'Twitter', url: 'https://x.com/sogojet' },
  { emoji: '📸', label: 'Instagram', url: 'https://instagram.com/sogojet' },
  { emoji: '📘', label: 'Facebook', url: 'https://facebook.com/sogojet' },
];

export function Footer() {
  if (Platform.OS !== 'web') return null;

  return (
    <footer style={{
      borderTop: '1px solid rgba(0,0,0,0.06)',
      marginTop: 48,
      padding: '40px 20px 24px',
      background: colors.surfaceElevated,
    }}>
      <div style={{
        maxWidth: 960, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 32, marginBottom: 32,
      }}>
        {/* Brand */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <span style={{
              color: colors.text.primary, fontSize: 22, fontWeight: 800, letterSpacing: -0.5,
            }}>
              SoGo<span style={{ color: colors.primary }}>Jet</span>
            </span>
          </div>
          <p style={{
            color: colors.text.secondary, fontSize: 13, lineHeight: 1.6, margin: 0,
          }}>
            Discover cheap flights to amazing places. Swipe, save, and book your next adventure.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  textDecoration: 'none', fontSize: 14,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.border)}
                onMouseLeave={(e) => (e.currentTarget.style.background = colors.surface)}
              >
                {s.emoji}
              </a>
            ))}
          </div>
        </div>

        {/* Link sections */}
        {LINKS.map((section) => (
          <div key={section.section}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: colors.text.muted,
              textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
            }}>
              {section.section}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.items.map((item) => (
                <span
                  key={item.label}
                  onClick={() => item.path && router.push(item.path as any)}
                  style={{
                    color: colors.text.secondary, fontSize: 13, cursor: 'pointer',
                    textDecoration: 'none', transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = colors.primary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = colors.text.secondary)}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        paddingTop: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <p style={{
          color: colors.text.muted, fontSize: 12, margin: 0, lineHeight: 1.5,
        }}>
          © {new Date().getFullYear()} SoGoJet. Prices are approximate. We may earn commissions from bookings.
        </p>
        <span style={{ fontSize: 12, color: colors.text.muted }}>
          Made with ✈️ + ❤️
        </span>
      </div>
    </footer>
  );
}
