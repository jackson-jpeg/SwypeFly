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
  const dropPercent = priceDrop > 0 && previousPrice
    ? Math.round((priceDrop / previousPrice) * 100)
    : 0;
  const priceUp = priceDirection === 'up';

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Price drop pill */}
        {dropPercent > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(34,197,94,0.2)',
              borderRadius: radii.full,
              padding: '4px 10px',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: fontWeight.bold, color: colors.success }}>
              ↓ {dropPercent}% off
            </span>
          </div>
        )}
        <div
          style={{
            display: 'inline-block',
            backgroundColor: colors.overlay.cardStrong,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: radii.xl,
            padding: `${spacing['3']}px ${spacing['4']}px`,
            border: `1px solid ${dropPercent > 0 ? 'rgba(34,197,94,0.25)' : colors.overlay.whiteMedium}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: fontSize.sm, color: colors.card.textMuted }}>✈</span>
            <span style={{ fontSize: 17, fontWeight: fontWeight.bold, color: dropPercent > 0 ? colors.success : colors.card.priceTint, letterSpacing: -0.3 }}>
              {priceText}
            </span>
            {isLive && (
              <span style={{ fontSize: fontSize.sm, color: colors.card.textMuted, fontWeight: fontWeight.medium }}>roundtrip</span>
            )}
            {dropPercent > 0 && previousPrice != null && (
              <span style={{ fontSize: fontSize.sm, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through', fontWeight: fontWeight.normal }}>
                ${Math.round(previousPrice)}
              </span>
            )}
          </div>

          {dateParts && (
            <div style={{ marginTop: 5 }}>
              <span style={{ fontSize: fontSize.md, color: 'rgba(255,255,255,0.55)', fontWeight: fontWeight.normal }}>
                {dateParts}
              </span>
            </div>
          )}

          {priceUp && (
            <div style={{ marginTop: 5 }}>
              <span style={{ fontSize: fontSize.md, color: colors.warningLight, fontWeight: fontWeight.medium }}>
                ↑ Prices rising — book soon
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      {/* Price drop pill */}
      {dropPercent > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(34,197,94,0.2)',
            borderRadius: radii.full,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: 'rgba(34,197,94,0.3)',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: fontWeight.bold, color: colors.success }}>
            ↓ {dropPercent}% off
          </Text>
        </View>
      )}
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: colors.overlay.cardStrong,
          borderRadius: radii.xl,
          padding: spacing['3'],
          paddingHorizontal: spacing['4'],
          borderWidth: 1,
          borderColor: dropPercent > 0 ? 'rgba(34,197,94,0.25)' : colors.overlay.whiteMedium,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontSize: fontSize.sm, color: colors.card.textMuted }}>✈</Text>
          <Text style={{ fontSize: 17, fontWeight: fontWeight.bold, color: dropPercent > 0 ? colors.success : colors.card.priceTint, letterSpacing: -0.3 }}>
            {priceText}
          </Text>
          {isLive && (
            <Text style={{ fontSize: fontSize.sm, color: colors.card.textMuted, fontWeight: fontWeight.medium }}>roundtrip</Text>
          )}
          {dropPercent > 0 && previousPrice != null && (
            <Text style={{ fontSize: fontSize.sm, color: 'rgba(255,255,255,0.35)', textDecorationLine: 'line-through', fontWeight: fontWeight.normal }}>
              ${Math.round(previousPrice)}
            </Text>
          )}
        </View>

        {dateParts ? (
          <View style={{ marginTop: 5 }}>
            <Text style={{ fontSize: fontSize.md, color: 'rgba(255,255,255,0.55)', fontWeight: fontWeight.normal }}>
              {dateParts}
            </Text>
          </View>
        ) : null}

        {priceUp && (
          <View style={{ marginTop: 5 }}>
            <Text style={{ fontSize: fontSize.md, color: colors.warningLight, fontWeight: fontWeight.medium }}>
              ↑ Prices rising — book soon
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
