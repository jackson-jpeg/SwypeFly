import { Platform } from 'react-native';
import { router } from 'expo-router';

export function Footer() {
  if (Platform.OS !== 'web') return null;

  return (
    <footer style={{
      padding: '32px 20px', textAlign: 'center',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      marginTop: 40,
    }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
          SoGo<span style={{ color: '#38BDF8' }}>Jet</span>
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Privacy', path: '/legal/privacy' },
          { label: 'Terms', path: '/legal/terms' },
        ].map(({ label, path }) => (
          <span
            key={path}
            onClick={() => router.push(path as any)}
            style={{
              color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer',
              textDecoration: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >{label}</span>
        ))}
      </div>
      <p style={{
        color: 'rgba(255,255,255,0.2)', fontSize: 12, margin: 0, lineHeight: 1.5,
      }}>
        © {new Date().getFullYear()} SoGoJet. Prices are approximate.<br />
        We may earn commissions from bookings.
      </p>
    </footer>
  );
}
