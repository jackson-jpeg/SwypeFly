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
            rgba(15,23,42,0.08) 42%,
            rgba(15,23,42,0.30) 52%,
            rgba(15,23,42,0.55) 62%,
            rgba(15,23,42,0.78) 72%,
            rgba(15,23,42,0.90) 82%,
            rgba(15,23,42,0.96) 92%,
            rgba(15,23,42,0.98) 100%
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
        'rgba(15,23,42,0.08)',
        'rgba(15,23,42,0.30)',
        'rgba(15,23,42,0.55)',
        'rgba(15,23,42,0.78)',
        'rgba(15,23,42,0.90)',
        'rgba(15,23,42,0.96)',
        'rgba(15,23,42,0.98)',
      ]}
      locations={[0, 0.30, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92, 1]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
