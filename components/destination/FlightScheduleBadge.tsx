import { Platform, View, Text } from 'react-native';

interface FlightScheduleBadgeProps {
  days: string[] | undefined;
}

export default function FlightScheduleBadge({ days }: FlightScheduleBadgeProps) {
  if (!days || days.length === 0) return null;

  const label = days.join(', ');

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#F1F5F9',
          borderRadius: 20,
          padding: '6px 14px',
        }}
      >
        <span style={{ fontSize: 16, color: '#38BDF8' }} role="img" aria-label="airplane">
          &#9992;&#65039;
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#1E293B',
            letterSpacing: 0.2,
          }}
        >
          {label}
        </span>
      </div>
    );
  }

  // Native
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 16, color: '#38BDF8' }}>{'\u2708\uFE0F'}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: '#1E293B',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
