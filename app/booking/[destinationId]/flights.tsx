// ─── 04a: Flight Selection ──────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, spacing, radii, textPresets } from '../../../constants/theme';
import { useBookingStore } from '../../../stores/bookingStore';
import { StepBar } from './_layout';

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

const CABIN_OPTIONS: { label: string; value: CabinClass }[] = [
  { label: 'Economy', value: 'economy' },
  { label: 'Business', value: 'business' },
  { label: 'First', value: 'first' },
];

export default function FlightSelection() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const router = useRouter();
  const { selectedOffer, cabinClass, setCabinClass, setOffer, destinationName } = useBookingStore();

  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Record<string, unknown>[]>([]);
  const [passengerCount, setPassengerCount] = useState(1);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      // TODO: Wire up to real departure date selection + user's origin
      const passengers = Array.from({ length: passengerCount }, () => ({ type: 'adult' as const }));
      const res = await fetch('/api/booking?action=search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'JFK', // TODO: Use user's departure city from uiStore
          destination: destinationId,
          departureDate: '2026-04-15', // TODO: Date picker
          passengers,
          cabinClass,
        }),
      });
      const data = await res.json();
      setOffers(data.offers || []);
      setSearched(true);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOffer = (offer: Record<string, unknown>) => {
    setOffer(offer);
    router.push(`/booking/${destinationId}/passengers`);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing['6'] }}>
      <StepBar currentStep={0} />

      {/* Destination header */}
      <Text
        style={{
          ...textPresets.display.title,
          fontFamily: 'Syne_800ExtraBold',
          marginTop: spacing['4'],
          marginBottom: spacing['2'],
        }}
      >
        {destinationName || 'Select Flights'}
      </Text>

      {/* Cabin class pills */}
      <View style={{ flexDirection: 'row', gap: spacing['2'], marginBottom: spacing['4'] }}>
        {CABIN_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setCabinClass(opt.value)}
            style={{
              paddingHorizontal: spacing['4'],
              paddingVertical: spacing['2'],
              borderRadius: radii.full,
              backgroundColor: cabinClass === opt.value ? colors.deepDusk : 'transparent',
              borderWidth: cabinClass === opt.value ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: cabinClass === opt.value ? '#FFFFFF' : colors.text.primary,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Passenger counter */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing['3'],
          marginBottom: spacing['6'],
        }}
      >
        <Text style={{ ...textPresets.body.label, flex: 1 }}>Passengers</Text>
        <Pressable
          onPress={() => setPassengerCount(Math.max(1, passengerCount - 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, color: colors.text.primary }}>−</Text>
        </Pressable>
        <Text style={{ ...textPresets.display.price, fontSize: 20, minWidth: 24, textAlign: 'center' }}>
          {passengerCount}
        </Text>
        <Pressable
          onPress={() => setPassengerCount(Math.min(9, passengerCount + 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, color: colors.text.primary }}>+</Text>
        </Pressable>
      </View>

      {/* Search button */}
      {!searched && (
        <Pressable
          onPress={handleSearch}
          disabled={loading}
          style={{
            backgroundColor: colors.deepDusk,
            borderRadius: radii.lg,
            paddingVertical: spacing['4'],
            alignItems: 'center',
            marginBottom: spacing['6'],
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>
              Search Flights
            </Text>
          )}
        </Pressable>
      )}

      {/* Offers list */}
      {offers.map((offer, i) => {
        const isSelected = selectedOffer && (selectedOffer as Record<string, unknown>).id === (offer as Record<string, unknown>).id;
        return (
          <Pressable
            key={i}
            onPress={() => handleSelectOffer(offer)}
            style={{
              backgroundColor: isSelected ? colors.seafoamMist : colors.paleHorizon,
              borderRadius: radii.lg,
              padding: spacing['4'],
              marginBottom: spacing['3'],
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? colors.sageDrift : colors.border,
            }}
          >
            <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 20, color: colors.deepDusk }}>
              ${(offer as Record<string, unknown>).total_amount as string}
            </Text>
            <Text style={{ ...textPresets.body.caption, marginTop: 4 }}>
              {((offer as Record<string, unknown>).total_currency as string) || 'USD'}
            </Text>
          </Pressable>
        );
      })}

      {searched && offers.length === 0 && (
        <Text style={{ ...textPresets.body.default, textAlign: 'center', marginTop: spacing['10'] }}>
          No flights found for these dates. Try different dates or cabin class.
        </Text>
      )}

      {/* Lock This Deal CTA — shown when an offer is selected */}
      {selectedOffer && (
        <Pressable
          onPress={() => router.push(`/booking/${destinationId}/passengers`)}
          style={{
            backgroundColor: colors.deepDusk,
            borderRadius: radii.lg,
            paddingVertical: spacing['4'],
            alignItems: 'center',
            marginTop: spacing['4'],
          }}
        >
          <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>
            Lock This Deal
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
