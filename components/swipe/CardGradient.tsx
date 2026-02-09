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
            transparent 45%,
            rgba(15,23,42,0.05) 55%,
            rgba(15,23,42,0.25) 65%,
            rgba(15,23,42,0.60) 80%,
            rgba(15,23,42,0.85) 95%,
            rgba(15,23,42,0.92) 100%
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
        'rgba(15,23,42,0.05)',
        'rgba(15,23,42,0.25)',
        'rgba(15,23,42,0.60)',
        'rgba(15,23,42,0.85)',
        'rgba(15,23,42,0.92)',
      ]}
      locations={[0, 0.45, 0.55, 0.65, 0.80, 0.95, 1]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
