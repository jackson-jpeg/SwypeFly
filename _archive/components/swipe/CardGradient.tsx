import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { gradientStops } from '../../constants/theme';

export function CardGradient() {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 2,
          background: `linear-gradient(
            to bottom,
            ${gradientStops.colors.join(', ')}
          )`,
          pointerEvents: 'none',
        }}
      />
    );
  }

  return (
    <LinearGradient
      colors={[...gradientStops.colors] as [string, string, ...string[]]}
      locations={[...gradientStops.locations] as [number, number, ...number[]]}
      style={[StyleSheet.absoluteFill, { zIndex: 2 }]}
      pointerEvents="none"
    />
  );
}
