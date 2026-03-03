import { useNavigate, useLocation } from 'react-router-dom';
import { colors, fonts } from '@/tokens';

type Tab = 'explore' | 'saved' | 'settings';

const tabs: { key: Tab; label: string; path: string }[] = [
  { key: 'explore', label: 'Explore', path: '/' },
  { key: 'saved', label: 'Saved', path: '/wishlist' },
  { key: 'settings', label: 'Settings', path: '/settings' },
];

function tabIcon(tab: Tab, active: boolean) {
  const stroke = active ? colors.sageDrift : '#6B7280';
  const fill = active ? colors.sageDrift : 'none';

  switch (tab) {
    case 'explore':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'saved':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={fill} stroke={stroke}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case 'settings':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab: Tab =
    location.pathname === '/wishlist' || location.pathname === '/saved'
      ? 'saved'
      : location.pathname === '/settings'
        ? 'settings'
        : 'explore';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        background: `linear-gradient(to top, ${colors.duskSand} 60%, transparent 100%)`,
        paddingBottom: 32,
        paddingTop: 12,
        paddingLeft: 40,
        paddingRight: 40,
        position: 'sticky',
        bottom: 0,
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {tabIcon(tab.key, active)}
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                lineHeight: '12px',
                color: active ? colors.sageDrift : colors.borderTint,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
