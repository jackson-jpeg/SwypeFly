import { View, Text, Platform } from 'react-native';
import { formatFlightPrice } from '../../utils/formatPrice';
import { formatTripDates } from '../../utils/formatDate';
import { getAirlineName } from '../../utils/airlines';
import type { Destination } from '../../types/destination';

interface CardDealBadgeProps {
  destination: Destination;
}

export function CardDealBadge({ destination }: CardDealBadgeProps) {
  const { flightPrice, currency, priceSource, airline, departureDate, returnDate, tripDurationDays, priceDirection, previousPrice } = destination;

  const priceText = formatFlightPrice(flightPrice, currency, priceSource);
  const isLive = priceSource === 'travelpayouts' || priceSource === 'amadeus';

  // Resolve airline code to name
  const airlineName = getAirlineName(airline || '');

  // Build date line: "Southwest · May 15–22 (7 nights)"
  const dateStr = departureDate && returnDate ? formatTripDates(departureDate, returnDate) : '';
  const nightsStr = tripDurationDays ? `(${tripDurationDays} night${tripDurationDays !== 1 ? 's' : ''})` : '';

  // Only show date row if we have actual dates (not just a bare airline name)
  const hasDateInfo = dateStr || nightsStr;
  const dateParts = hasDateInfo
    ? [airlineName, dateStr, nightsStr].filter(Boolean).join(' · ')
    : '';

  // Price drop
  const priceDrop = priceDirection === 'down' && previousPrice != null
    ? Math.round(previousPrice - flightPrice)
    : 0;

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          display: 'inline-block',
          backgroundColor: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 14,
          padding: '12px 16px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Row 1: Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>✈</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#7DD3FC', letterSpacing: -0.3 }}>
            {priceText}
          </span>
          {isLive && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>roundtrip</span>
          )}
        </div>

        {/* Row 2: Airline + Dates (only if we have dates) */}
        {dateParts && (
          <div style={{ marginTop: 5 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>
              {dateParts}
            </span>
          </div>
        )}

        {/* Row 3: Price drop */}
        {priceDrop > 0 && (
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#4ADE80', fontWeight: 600 }}>
              ↓ Price dropped ${priceDrop}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Native ──
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 14,
        padding: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }}
    >
      {/* Row 1: Price */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>✈</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#7DD3FC', letterSpacing: -0.3 }}>
          {priceText}
        </Text>
        {isLive && (
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>roundtrip</Text>
        )}
      </View>

      {/* Row 2: Airline + Dates (only if we have dates) */}
      {dateParts ? (
        <View style={{ marginTop: 5 }}>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '400' }}>
            {dateParts}
          </Text>
        </View>
      ) : null}

      {/* Row 3: Price drop */}
      {priceDrop > 0 && (
        <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, color: '#4ADE80', fontWeight: '600' }}>
            ↓ Price dropped ${priceDrop}
          </Text>
        </View>
      )}
    </View>
  );
}
