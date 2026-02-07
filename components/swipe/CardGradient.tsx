import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

export function CardGradient() {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: `linear-gradient(
            to bottom,
            transparent 0%,
            transparent 30%,
            rgba(0,0,0,0.02) 40%,
            rgba(0,0,0,0.15) 55%,
            rgba(0,0,0,0.55) 75%,
            rgba(0,0,0,0.82) 92%,
            rgba(0,0,0,0.88) 100%
          )`,
          pointerEvents: 'none',
        }}
      />
    );
  }

  return (
    <LinearGradient
      colors={[
        'transparent',
        'transparent',
        'rgba(0,0,0,0.02)',
        'rgba(0,0,0,0.15)',
        'rgba(0,0,0,0.55)',
        'rgba(0,0,0,0.82)',
        'rgba(0,0,0,0.88)',
      ]}
      locations={[0, 0.3, 0.4, 0.55, 0.75, 0.92, 1]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
