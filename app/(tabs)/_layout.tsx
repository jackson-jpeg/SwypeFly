import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { useSavedStore } from '../../stores/savedStore';

function TabBarBackground() {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          borderTop: '1px solid #E2E8F0',
        }}
      />
    );
  }
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      borderTopWidth: 1,
      borderTopColor: '#E2E8F0',
    }} />
  );
}

function SavedTabIcon({ focused }: { focused: boolean }) {
  const savedCount = useSavedStore((s) => s.savedIds.size);

  const heartSvg = focused ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#38BDF8" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#94A3B8" strokeWidth="1.8" />
    </svg>
  );

  if (Platform.OS === 'web') {
    return (
      <div style={{ position: 'relative' }}>
        {heartSvg}
        {savedCount > 0 && (
          <div style={{
            position: 'absolute', top: -5, right: -10,
            backgroundColor: '#38BDF8', borderRadius: 8,
            minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
          }}>
            <span style={{ color: '#fff', fontSize: 9, fontWeight: 800, lineHeight: 1 }}>
              {savedCount > 99 ? '99+' : savedCount}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <View style={{ position: 'relative' }}>
      {heartSvg}
      {savedCount > 0 && (
        <View style={{
          position: 'absolute', top: -5, right: -10,
          backgroundColor: '#38BDF8', borderRadius: 8,
          minWidth: 16, height: 16,
          justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 4,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {savedCount > 99 ? '99+' : savedCount}
          </Text>
        </View>
      )}
    </View>
  );
}

function TabIconSvg({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? '#38BDF8' : '#94A3B8';

  let icon = null;
  if (name === 'explore') {
    icon = (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
        <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill={color} />
      </svg>
    );
  } else if (name === 'settings') {
    icon = (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }

  if (!icon) return null;

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {icon}
        {focused && (
          <div style={{
            width: 4, height: 4, borderRadius: 2,
            backgroundColor: '#38BDF8',
          }} />
        )}
      </div>
    );
  }

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      {icon}
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#38BDF8' }} />
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'web' ? 12 : 28,
          height: Platform.OS === 'web' ? 64 : 84,
          position: Platform.OS === 'web' ? ('fixed' as unknown as undefined) : undefined,
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          elevation: 0,
        },
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => <TabIconSvg name="explore" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ focused }) => <SavedTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIconSvg name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
