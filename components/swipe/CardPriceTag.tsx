import { View, Text } from 'react-native';
import { formatFlightPrice, formatHotelPrice } from '../../utils/formatPrice';
import { colors } from '../../constants/theme';

interface CardPriceTagProps {
  flightPrice: number;
  hotelPricePerNight: number;
  currency: string;
  priceSource?: string;
}

export function CardPriceTag({ flightPrice, hotelPricePerNight, currency, priceSource }: CardPriceTagProps) {
  const isLive = priceSource && priceSource !== 'estimate';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(56,189,248,0.15)',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: 'rgba(56,189,248,0.25)',
        }}
      >
        <Text style={{ fontSize: 13 }}>{'\u2708\uFE0F'}</Text>
        <Text style={{ color: colors.primaryLight, fontSize: 13, fontWeight: '700', marginLeft: 6 }}>
          {formatFlightPrice(flightPrice, currency)}
        </Text>
        {isLive && (
          <View style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: colors.success, marginLeft: 6,
          }} />
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(33,150,243,0.15)',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: 'rgba(33,150,243,0.25)',
        }}
      >
        <Text style={{ fontSize: 13 }}>{'\u{1F3E8}'}</Text>
        <Text style={{ color: '#64B5F6', fontSize: 13, fontWeight: '700', marginLeft: 6 }}>
          {formatHotelPrice(hotelPricePerNight, currency)}
        </Text>
      </View>
    </View>
  );
}
