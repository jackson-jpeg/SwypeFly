// ─── Sticky Bottom CTA Bar ───────────────────────────────────────────────────
// "Check Flights $XXX" button fixed at bottom after scrolling past hero.

import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { formatFlightPrice } from '../../utils/formatPrice';
import { colors, spacing, fontSize, fontWeight, radii, shadows, layout } from '../../constants/theme';

interface StickyBookBarProps {
  flightPrice: number;
  currency: string;
  priceSource?: 'travelpayouts' | 'amadeus' | 'duffel' | 'estimate';
  departureCode: string;
  destinationId: string;
}

export function StickyBookBar({ flightPrice, currency, priceSource, destinationId }: StickyBookBarProps) {
  const router = useRouter();
  const priceText = formatFlightPrice(flightPrice, currency, priceSource);

  const handlePress = () => {
    router.push(`/booking/${destinationId}/flights`);
  };

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 50,
          backgroundColor: 'rgba(245,236,215,0.9)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: `1px solid ${colors.divider}`,
          padding: `${spacing['3']}px ${spacing['5']}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: layout.maxContentWidth, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: colors.text.muted, fontSize: fontSize.md }}>Flights from</div>
            <div style={{ color: colors.deepDusk, fontSize: fontSize['4xl'], fontWeight: fontWeight.extrabold }}>{priceText}</div>
          </div>
          <button
            onClick={handlePress}
            style={{
              background: colors.deepDusk, color: colors.paleHorizon, border: 'none',
              borderRadius: radii.lg, padding: `${spacing['3']}px ${spacing['6']}px`,
              fontSize: fontSize.xl, fontWeight: fontWeight.bold, cursor: 'pointer',
              boxShadow: shadows.web.primary,
            }}
          >
            Check Flights &#8599;
          </button>
        </div>
      </div>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(245,236,215,0.9)',
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        paddingHorizontal: spacing['5'],
        paddingVertical: spacing['3'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shadows.native.lg,
      }}
    >
      <View>
        <Text style={{ color: colors.text.muted, fontSize: fontSize.md }}>Flights from</Text>
        <Text style={{ color: colors.deepDusk, fontSize: fontSize['4xl'], fontWeight: fontWeight.extrabold }}>{priceText}</Text>
      </View>
      <Pressable
        onPress={handlePress}
        style={{
          backgroundColor: colors.deepDusk, borderRadius: radii.lg,
          paddingHorizontal: spacing['6'], paddingVertical: spacing['3'],
        }}
      >
        <Text style={{ color: colors.paleHorizon, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>Check Flights {'\u2197'}</Text>
      </Pressable>
    </View>
  );
}
