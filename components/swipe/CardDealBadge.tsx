import { View, Text, Platform } from 'react-native';
import { formatFlightPrice } from '../../utils/formatPrice';
import { formatTripDates } from '../../utils/formatDate';
import type { Destination } from '../../types/destination';

interface CardDealBadgeProps {
  destination: Destination;
}

export function CardDealBadge({ destination }: CardDealBadgeProps) {
  const { flightPrice, currency, priceSource, airline, departureDate, returnDate, tripDurationDays, priceDirection, previousPrice } = destination;

  const priceText = formatFlightPrice(flightPrice, currency, priceSource);
  const isLive = priceSource === 'travelpayouts' || priceSource === 'amadeus';

  // Date line: "Delta · May 15–22 (7 nights)"
  const dateStr = departureDate && returnDate ? formatTripDates(departureDate, returnDate) : '';
  const nightsStr = tripDurationDays ? `(${tripDurationDays} night${tripDurationDays !== 1 ? 's' : ''})` : '';
  const airlineStr = airline || '';
  const dateParts = [airlineStr, dateStr, nightsStr].filter(Boolean).join(' · ');

  // Price drop
  const priceDrop = priceDirection === 'down' && previousPrice != null
    ? Math.round(previousPrice - flightPrice)
    : 0;

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          padding: '14px 18px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Row 1: Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>✈</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#7DD3FC', letterSpacing: -0.3 }}>
            {priceText}
          </span>
          {isLive && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>roundtrip</span>
          )}
        </div>

        {/* Row 2: Airline + Dates */}
        {dateParts && (
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
              {dateParts}
            </span>
          </div>
        )}

        {/* Row 3: Price drop */}
        {priceDrop > 0 && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
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
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 16,
        padding: 14,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Row 1: Price */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>✈</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#7DD3FC', letterSpacing: -0.3 }}>
          {priceText}
        </Text>
        {isLive && (
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '500' }}>roundtrip</Text>
        )}
      </View>

      {/* Row 2: Airline + Dates */}
      {dateParts ? (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '400' }}>
            {dateParts}
          </Text>
        </View>
      ) : null}

      {/* Row 3: Price drop */}
      {priceDrop > 0 && (
        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, color: '#4ADE80', fontWeight: '600' }}>
            ↓ Price dropped ${priceDrop}
          </Text>
        </View>
      )}
    </View>
  );
}
