import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useAuthContext } from '@/hooks/AuthContext';
import { useUIStore } from '@/stores/uiStore';
import BottomNav from '@/components/BottomNav';

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      style={{
        backgroundColor: on ? colors.sageDrift : '#C9A99A40',
        borderRadius: 13,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        height: 26,
        width: 44,
        position: 'relative',
        padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        style={{
          backgroundColor: on ? '#FFFFFF' : colors.borderTint,
          borderRadius: 11,
          height: 22,
          width: 22,
          position: 'absolute',
          top: 2,
          transition: 'left 0.15s ease, right 0.15s ease',
          ...(on ? { right: 2, left: 'auto' } : { left: 2, right: 'auto' }),
        }}
      />
    </button>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.12em',
  lineHeight: '12px',
  textTransform: 'uppercase',
  color: colors.sageDrift,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: colors.offWhite,
  paddingBlock: 14,
  paddingInline: 16,
};

const rowTitleStyle: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 15,
  fontWeight: 500,
  lineHeight: '18px',
  color: colors.deepDusk,
};

const rowValueStyle: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 14,
  lineHeight: '18px',
  color: colors.sageDrift,
};

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { signOut, user, isGuest } = useAuthContext();
  const displayName = user?.name || (isGuest ? 'Guest' : 'User');
  const displayEmail = user?.email || (isGuest ? 'Browsing as guest' : '');
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'G';
  const { hapticsEnabled, toggleHaptics, departureCity, departureCode, currency, setCurrency, tempUnit, setTempUnit, notifications, toggleNotifications, priceAlerts, togglePriceAlerts } = useUIStore();
  const [notifBlocked, setNotifBlocked] = useState(typeof Notification !== 'undefined' && Notification.permission === 'denied');

  const handleToggleNotifications = async () => {
    if (!notifications && typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      if (perm === 'denied') {
        setNotifBlocked(true);
        return;
      }
      setNotifBlocked(false);
    }
    toggleNotifications();
  };

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingLeft: 24, paddingRight: 24, paddingTop: 60 }}>
        <h1
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 34,
            lineHeight: '40px',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: colors.deepDusk,
            margin: 0,
          }}
        >
          Settings
        </h1>

        {/* Profile card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            backgroundColor: '#F2CEBC',
            border: '1px solid #C9A99A40',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundImage: `linear-gradient(135deg, ${colors.warmDusk} 0%, ${colors.seafoamMist} 100%)`,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 20,
                fontWeight: 600,
                lineHeight: '24px',
                color: '#FFFFFF',
              }}
            >
              {initials}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, fontWeight: 500, lineHeight: '20px', color: colors.deepDusk }}>
              {displayName}
            </span>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, lineHeight: '16px', color: colors.borderTint }}>
              {displayEmail}
            </span>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        {/* Travel Preferences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={sectionLabelStyle}>Travel Preferences</span>
          <div style={{ borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'clip' }}>
            {/* Departure City */}
            <button onClick={() => navigate('/onboarding')} style={{ ...rowStyle, cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
                </svg>
                <span style={rowTitleStyle}>Departure City</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={rowValueStyle}>{departureCity} ({departureCode})</span>
                <ChevronRight />
              </div>
            </button>
            {/* Currency */}
            <button onClick={() => setCurrency(currency === 'USD' ? 'EUR' : currency === 'EUR' ? 'GBP' : 'USD')} style={{ ...rowStyle, cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span style={rowTitleStyle}>Currency</span>
              </div>
              <span style={rowValueStyle}>{currency}</span>
            </button>
            {/* Temperature */}
            <button onClick={() => setTempUnit(tempUnit === '°F' ? '°C' : '°F')} style={{ ...rowStyle, cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                </svg>
                <span style={rowTitleStyle}>Temperature</span>
              </div>
              <span style={rowValueStyle}>{tempUnit}</span>
            </button>
          </div>
        </div>

        {/* Experience */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={sectionLabelStyle}>Experience</span>
          <div style={{ borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'clip' }}>
            <div style={rowStyle}>
              <span style={rowTitleStyle}>Haptic Feedback</span>
              <Toggle on={hapticsEnabled} onToggle={toggleHaptics} />
            </div>
            <div style={rowStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={rowTitleStyle}>Push Notifications</span>
                {notifBlocked && (
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.terracotta }}>
                    Blocked in browser settings
                  </span>
                )}
              </div>
              <Toggle on={notifications} onToggle={handleToggleNotifications} disabled={notifBlocked} />
            </div>
            <div style={rowStyle}>
              <span style={rowTitleStyle}>Price Alerts</span>
              <Toggle on={priceAlerts} onToggle={togglePriceAlerts} />
            </div>
          </div>
        </div>

        {/* About */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={sectionLabelStyle}>About</span>
          <div style={{ borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'clip' }}>
            <button onClick={() => navigate('/legal/privacy')} style={{ ...rowStyle, cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' }}>
              <span style={rowTitleStyle}>Privacy Policy</span>
              <ChevronRight />
            </button>
            <button onClick={() => navigate('/legal/terms')} style={{ ...rowStyle, cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' }}>
              <span style={rowTitleStyle}>Terms of Service</span>
              <ChevronRight />
            </button>
            <a href="mailto:support@sogojet.com" style={{ ...rowStyle, cursor: 'pointer', textDecoration: 'none' }}>
              <span style={rowTitleStyle}>Contact Support</span>
              <ChevronRight />
            </a>
          </div>
        </div>

        {/* Log Out */}
        <button
          onClick={() => { signOut(); navigate('/login'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
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
              fontSize: 16,
              fontWeight: 600,
              lineHeight: '20px',
              color: colors.sageDrift,
            }}
          >
            Log Out
          </span>
        </button>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              lineHeight: '16px',
              color: colors.borderTint,
            }}
          >
            SoGoJet v2.0 · Made with love
          </span>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
