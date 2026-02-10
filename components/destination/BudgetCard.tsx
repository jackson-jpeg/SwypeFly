// ─── Budget Card ─────────────────────────────────────────────────────────────
// Flight + hotel prices, verify deal button.

import { View, Text, Pressable, Platform, Linking } from 'react-native';
import { formatFlightPrice, formatHotelPrice } from '../../utils/formatPrice';
import { Badge } from '../common/Badge';
import { ContentCard } from '../common/ContentCard';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';
import type { Destination } from '../../types/destination';
import type { UseQueryResult } from '@tanstack/react-query';

interface BudgetCardProps {
  destination: Destination;
  priceCheck: UseQueryResult<{ price: number; source: string; url: string }>;
}

export function BudgetCard({ destination, priceCheck }: BudgetCardProps) {
  const isLiveFlight = destination.priceSource === 'travelpayouts' || destination.priceSource === 'amadeus';
  const isLiveHotel = destination.hotelPriceSource === 'liteapi';

  const renderVerifyPrice = () => {
    if (priceCheck.data && priceCheck.data.price > 0) {
      if (Platform.OS === 'web') {
        return (
          <div style={{
            marginTop: spacing['3'], backgroundColor: colors.primaryBackground,
            borderRadius: radii.lg, padding: `${spacing['3']}px ${spacing['4']}px`,
            border: `1px solid rgba(56,189,248,0.15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <Badge variant="aiVerified" />
              <div style={{ color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginTop: spacing['1'] }}>
                ${priceCheck.data.price}
              </div>
              <div style={{ color: colors.text.secondary, fontSize: fontSize.md }}>via {priceCheck.data.source}</div>
            </div>
            <a
              href={priceCheck.data.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: colors.primary, color: '#fff',
                borderRadius: radii.lg, padding: `${spacing['2']}px ${spacing['4']}px`,
                fontSize: fontSize.base, fontWeight: fontWeight.semibold, textDecoration: 'none',
              }}
            >
              Book Now &#8599;
            </a>
          </div>
        );
      }

      return (
        <View style={{
          marginTop: spacing['3'], backgroundColor: colors.primaryBackground,
          borderRadius: radii.lg, padding: spacing['3'],
          borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View>
            <Badge variant="aiVerified" />
            <Text style={{ color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginTop: spacing['1'] }}>
              ${priceCheck.data.price}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: fontSize.md }}>via {priceCheck.data.source}</Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(priceCheck.data!.url)}
            style={{
              backgroundColor: colors.primary, borderRadius: radii.lg,
              paddingHorizontal: spacing['4'], paddingVertical: spacing['2'],
            }}
          >
            <Text style={{ color: '#fff', fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>Book Now {'\u2197'}</Text>
          </Pressable>
        </View>
      );
    }

    if (Platform.OS === 'web') {
      return (
        <button
          onClick={() => priceCheck.refetch()}
          disabled={priceCheck.isFetching}
          style={{
            marginTop: spacing['3'], width: '100%',
            background: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(129,140,248,0.08) 100%)',
            border: `1px dashed ${colors.primaryBorderStrong}`,
            borderRadius: radii.lg, padding: `${spacing['3']}px ${spacing['4']}px`,
            color: colors.primaryDarker, fontSize: fontSize.base, fontWeight: fontWeight.semibold,
            cursor: priceCheck.isFetching ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1.5'],
            opacity: priceCheck.isFetching ? 0.6 : 1,
          }}
        >
          {priceCheck.isFetching ? 'Checking prices...' : '\u2728 Verify Deal with AI'}
        </button>
      );
    }

    return (
      <Pressable
        onPress={() => priceCheck.refetch()}
        disabled={priceCheck.isFetching}
        style={{
          marginTop: spacing['3'],
          backgroundColor: colors.primaryBackground,
          borderWidth: 1, borderColor: colors.primaryBorderStrong,
          borderRadius: radii.lg, padding: spacing['3'],
          alignItems: 'center', justifyContent: 'center',
          opacity: priceCheck.isFetching ? 0.6 : 1,
        }}
      >
        <Text style={{ color: colors.primaryDarker, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
          {priceCheck.isFetching ? 'Checking prices...' : '\u2728 Verify Deal with AI'}
        </Text>
      </Pressable>
    );
  };

  const updatedAgo = destination.priceFetchedAt ? (() => {
    const hrs = Math.round((Date.now() - new Date(destination.priceFetchedAt).getTime()) / 3600000);
    return hrs < 1 ? 'just now' : `${hrs}h ago`;
  })() : null;

  if (Platform.OS === 'web') {
    return (
      <ContentCard gap={spacing['3']}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>Flights</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{ color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.semibold }}>
              {formatFlightPrice(destination.flightPrice, destination.currency, destination.priceSource)}
            </span>
            {isLiveFlight && <Badge variant="live" />}
          </div>
        </div>
        {updatedAgo && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>Updated {updatedAgo}</span>
          </div>
        )}
        <div style={{ height: 1, backgroundColor: colors.divider }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>Hotels</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{ color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.semibold }}>
              {formatHotelPrice(destination.hotelPricePerNight, destination.currency, destination.hotelPriceSource)}
            </span>
            {isLiveHotel && <Badge variant="live" />}
          </div>
        </div>
        <div style={{ height: 1, backgroundColor: colors.divider }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>Flight time</span>
          <span style={{ color: colors.text.body, fontSize: fontSize.lg }}>{destination.flightDuration}</span>
        </div>
        {renderVerifyPrice()}
      </ContentCard>
    );
  }

  return (
    <ContentCard gap={spacing['3']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>Flights</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['2'] }}>
          <Text style={{ color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.semibold }}>
            {formatFlightPrice(destination.flightPrice, destination.currency, destination.priceSource)}
          </Text>
          {isLiveFlight && <Badge variant="live" />}
        </View>
      </View>
      {updatedAgo && (
        <Text style={{ color: colors.text.muted, fontSize: fontSize.sm, textAlign: 'right' }}>Updated {updatedAgo}</Text>
      )}
      <View style={{ height: 1, backgroundColor: colors.divider }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>Hotels</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['2'] }}>
          <Text style={{ color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.semibold }}>
            {formatHotelPrice(destination.hotelPricePerNight, destination.currency, destination.hotelPriceSource)}
          </Text>
          {isLiveHotel && <Badge variant="live" />}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.divider }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>Flight time</Text>
        <Text style={{ color: colors.text.body, fontSize: fontSize.lg }}>{destination.flightDuration}</Text>
      </View>
      {renderVerifyPrice()}
    </ContentCard>
  );
}
