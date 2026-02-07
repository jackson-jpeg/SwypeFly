import { View, Text } from 'react-native';
import { formatFlightPrice, formatHotelPrice } from '../../utils/formatPrice';

interface CardPriceTagProps {
  flightPrice: number;
  hotelPricePerNight: number;
  currency: string;
}

export function CardPriceTag({ flightPrice, hotelPricePerNight, currency }: CardPriceTagProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,107,53,0.2)',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: 'rgba(255,107,53,0.3)',
        }}
      >
        <Text style={{ fontSize: 13 }}>{'\u2708\uFE0F'}</Text>
        <Text style={{ color: '#FF8F65', fontSize: 13, fontWeight: '700', marginLeft: 6 }}>
          {formatFlightPrice(flightPrice, currency)}
        </Text>
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
        <Text style={{ fontSize: 13 }}>{'\U0001F3E8'}</Text>
        <Text style={{ color: '#64B5F6', fontSize: 13, fontWeight: '700', marginLeft: 6 }}>
          {formatHotelPrice(hotelPricePerNight, currency)}
        </Text>
      </View>
    </View>
  );
}
