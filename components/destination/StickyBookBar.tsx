// ─── Sticky Bottom CTA Bar ───────────────────────────────────────────────────
// "Check Flights $XXX" button fixed at bottom after scrolling past hero.

import { View, Text, Pressable, Platform, Linking } from 'react-native';
import { formatFlightPrice } from '../../utils/formatPrice';
import { flightLink } from '../../utils/affiliateLinks';
import { colors, spacing, fontSize, fontWeight, radii, shadows, layout } from '../../constants/theme';

interface StickyBookBarProps {
  flightPrice: number;
  currency: string;
  priceSource?: 'travelpayouts' | 'amadeus' | 'estimate';
  departureCode: string;
  iataCode: string;
  marker: string;
}

export function StickyBookBar({ flightPrice, currency, priceSource, departureCode, iataCode, marker }: StickyBookBarProps) {
  const priceText = formatFlightPrice(flightPrice, currency, priceSource);
  const url = flightLink(departureCode, iataCode, marker);

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 50,
          backgroundColor: 'rgba(15,23,42,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: `1px solid ${colors.dark.border}`,
          padding: `${spacing['3']}px ${spacing['5']}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: layout.maxContentWidth, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: colors.dark.text.muted, fontSize: fontSize.md }}>Flights from</div>
            <div style={{ color: colors.dark.text.primary, fontSize: fontSize['4xl'], fontWeight: fontWeight.extrabold }}>{priceText}</div>
          </div>
          <button
            onClick={() => window.open(url, '_blank')}
            style={{
              background: colors.primary, color: '#fff', border: 'none',
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
        backgroundColor: 'rgba(15,23,42,0.85)',
        borderTopWidth: 1,
        borderTopColor: colors.dark.border,
        paddingHorizontal: spacing['5'],
        paddingVertical: spacing['3'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shadows.native.lg,
      }}
    >
      <View>
        <Text style={{ color: colors.dark.text.muted, fontSize: fontSize.md }}>Flights from</Text>
        <Text style={{ color: colors.dark.text.primary, fontSize: fontSize['4xl'], fontWeight: fontWeight.extrabold }}>{priceText}</Text>
      </View>
      <Pressable
        onPress={() => Linking.openURL(url)}
        style={{
          backgroundColor: colors.primary, borderRadius: radii.lg,
          paddingHorizontal: spacing['6'], paddingVertical: spacing['3'],
        }}
      >
        <Text style={{ color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>Check Flights {'\u2197'}</Text>
      </Pressable>
    </View>
  );
}
