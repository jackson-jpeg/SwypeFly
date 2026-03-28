// Floating "Get the App" banner shown to mobile web visitors.
// Auto-dismisses if closed, persists dismissal in localStorage.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { colors, fonts } from '../../theme/tokens';

const DISMISS_KEY = 'sg_app_banner_dismissed';

export default function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Only show on mobile web
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (isMobile && !dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(180deg, transparent, #0A0806 8px)',
        padding: '12px 16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* App icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: '#1A1510',
          border: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        &#9992;
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 16,
            color: colors.yellow,
            letterSpacing: 1,
            lineHeight: '18px',
          }}
        >
          SOGOJET
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, lineHeight: '16px' }}>
          Swipe. Save. Fly. Get the full experience.
        </div>
      </div>

      {/* CTA */}
      <a
        href="https://apps.apple.com/app/sogojet/id6746076960"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: colors.yellow,
          color: '#0A0806',
          fontFamily: fonts.bodyBold,
          fontSize: 13,
          fontWeight: 700,
          padding: '8px 16px',
          borderRadius: 8,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        GET
      </a>

      {/* Close */}
      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          color: colors.muted,
          fontSize: 18,
          cursor: 'pointer',
          padding: '4px 8px',
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="Dismiss app download banner"
      >
        &times;
      </button>
    </div>
  );
}
