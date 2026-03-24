import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '../../theme/tokens';
import { useSavedStore } from '../../stores/savedStore';

export default function TabLayout() {
  const savedCount = useSavedStore((s) => s.savedDeals.length);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.yellow,
        tabBarInactiveTintColor: '#C9A99A60',
        tabBarLabelStyle: {
          fontFamily: fonts.display,
          fontSize: 10,
          letterSpacing: 1.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'FLIGHTS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'SAVED',
          tabBarBadge: savedCount > 0 ? savedCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#E85D4A',
            fontSize: 10,
            fontFamily: fonts.bodyBold,
            minWidth: 18,
            height: 18,
            lineHeight: 18,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-sharp" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
