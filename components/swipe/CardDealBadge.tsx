import { View, Text, Platform } from 'react-native';
import { formatFlightPrice } from '../../utils/formatPrice';
import { formatTripDates } from '../../utils/formatDate';
import { getAirlineName } from '../../utils/airlines';
import { colors, radii, spacing, fontSize, fontWeight } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface CardDealBadgeProps {
  destination: Destination;
}

export function CardDealBadge({ destination }: CardDealBadgeProps) {
  const { flightPrice, currency, priceSource, airline, departureDate, returnDate, tripDurationDays, priceDirection, previousPrice } = destination;

  const priceText = formatFlightPrice(flightPrice, currency, priceSource);
  const isLive = priceSource === 'travelpayouts' || priceSource === 'amadeus';

  const airlineName = getAirlineName(airline || '');

  const dateStr = departureDate && returnDate ? formatTripDates(departureDate, returnDate) : '';
  const nightsStr = tripDurationDays ? `(${tripDurationDays} night${tripDurationDays !== 1 ? 's' : ''})` : '';

  const hasDateInfo = dateStr || nightsStr;
  const dateParts = hasDateInfo
    ? [airlineName, dateStr, nightsStr].filter(Boolean).join(' · ')
    : '';

  const priceDrop = priceDirection === 'down' && previousPrice != null
    ? Math.round(previousPrice - flightPrice)
    : 0;

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          display: 'inline-block',
          backgroundColor: colors.overlay.cardStrong,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: radii.xl,
          padding: `${spacing['3']}px ${spacing['4']}px`,
          border: `1px solid ${colors.overlay.whiteMedium}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: fontSize.sm, color: colors.card.textMuted }}>✈</span>
          <span style={{ fontSize: 17, fontWeight: fontWeight.bold, color: colors.card.priceTint, letterSpacing: -0.3 }}>
            {priceText}
          </span>
          {isLive && (
            <span style={{ fontSize: fontSize.sm, color: colors.card.textMuted, fontWeight: fontWeight.medium }}>roundtrip</span>
          )}
        </div>

        {dateParts && (
          <div style={{ marginTop: 5 }}>
            <span style={{ fontSize: fontSize.md, color: 'rgba(255,255,255,0.55)', fontWeight: fontWeight.normal }}>
              {dateParts}
            </span>
          </div>
        )}

        {priceDrop > 0 && (
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <span style={{ fontSize: fontSize.md, color: colors.success, fontWeight: fontWeight.semibold }}>
              ↓ Price dropped ${priceDrop}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.overlay.cardStrong,
        borderRadius: radii.xl,
        padding: spacing['3'],
        paddingHorizontal: spacing['4'],
        borderWidth: 1,
        borderColor: colors.overlay.whiteMedium,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Text style={{ fontSize: fontSize.sm, color: colors.card.textMuted }}>✈</Text>
        <Text style={{ fontSize: 17, fontWeight: fontWeight.bold, color: colors.card.priceTint, letterSpacing: -0.3 }}>
          {priceText}
        </Text>
        {isLive && (
          <Text style={{ fontSize: fontSize.sm, color: colors.card.textMuted, fontWeight: fontWeight.medium }}>roundtrip</Text>
        )}
      </View>

      {dateParts ? (
        <View style={{ marginTop: 5 }}>
          <Text style={{ fontSize: fontSize.md, color: 'rgba(255,255,255,0.55)', fontWeight: fontWeight.normal }}>
            {dateParts}
          </Text>
        </View>
      ) : null}

      {priceDrop > 0 && (
        <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: spacing['1'] }}>
          <Text style={{ fontSize: fontSize.md, color: colors.success, fontWeight: fontWeight.semibold }}>
            ↓ Price dropped ${priceDrop}
          </Text>
        </View>
      )}
    </View>
  );
}
