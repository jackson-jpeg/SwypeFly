// ─── 04c: Seat Selection ────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, spacing, radii, textPresets } from '../../../constants/theme';
import { springs } from '../../../constants/animations';
import { useBookingStore } from '../../../stores/bookingStore';
import { StepBar } from './_layout';

const SEAT_SIZE = 36;
const SEAT_GAP = 4;

type SeatStatus = 'available' | 'selected' | 'occupied' | 'extra_legroom';

interface SeatElement {
  type: 'seat' | 'empty';
  designator?: string;
  status?: SeatStatus;
  serviceId?: string;
  price?: string;
}

function SeatButton({
  seat,
  isSelected,
  onPress,
}: {
  seat: SeatElement;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (seat.status === 'occupied') return;
    scale.value = withSpring(1.15, springs.seatSelection);
    setTimeout(() => {
      scale.value = withSpring(1, springs.seatSelection);
    }, 150);
    onPress();
  };

  const bgColor =
    seat.status === 'occupied'
      ? 'rgba(44,31,26,0.15)'
      : isSelected
        ? colors.sageDrift
        : seat.status === 'extra_legroom'
          ? colors.seafoamMist
          : colors.warmDusk;

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        disabled={seat.status === 'occupied'}
        style={{
          width: SEAT_SIZE,
          height: SEAT_SIZE,
          borderRadius: 6,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: seat.status === 'extra_legroom' && !isSelected ? 1 : 0,
          borderColor: colors.seafoamMist,
        }}
      >
        {isSelected ? (
          <Text style={{ fontSize: 14, color: '#FFFFFF' }}>✓</Text>
        ) : (
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 9,
              color: seat.status === 'occupied' ? colors.text.muted : colors.deepDusk,
            }}
          >
            {seat.designator}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function SeatSelection() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const router = useRouter();
  const { selectedOffer, selectedSeats, selectSeat, passengers } = useBookingStore();
  const [seatMap, setSeatMap] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedOffer) return;
    const offerId = (selectedOffer as Record<string, unknown>).id as string;

    fetch(`/api/booking?action=offer&offerId=${offerId}`)
      .then((res) => res.json())
      .then((data) => {
        setSeatMap(data.seatMap || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedOffer]);

  const currentPassengerId = passengers[0]?.id;
  const currentSeat = selectedSeats.find((s) => s.passengerId === currentPassengerId);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing['6'] }}>
      <StepBar currentStep={2} />

      <Text
        style={{
          ...textPresets.display.title,
          fontFamily: 'Syne_800ExtraBold',
          marginTop: spacing['4'],
          marginBottom: spacing['2'],
        }}
      >
        Choose Your Seat
      </Text>

      {/* Seat legend */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing['4'],
          marginBottom: spacing['6'],
          flexWrap: 'wrap',
        }}
      >
        {[
          { color: colors.warmDusk, label: 'Available' },
          { color: colors.sageDrift, label: 'Selected' },
          { color: 'rgba(44,31,26,0.15)', label: 'Occupied' },
          { color: colors.seafoamMist, label: 'Extra Legroom' },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                backgroundColor: item.color,
              }}
            />
            <Text style={{ ...textPresets.body.caption }}>{item.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.sageDrift} style={{ marginTop: spacing['10'] }} />
      ) : (
        /* Fuselage container */
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 40,
            borderTopLeftRadius: 80,
            borderTopRightRadius: 80,
            padding: spacing['4'],
            paddingTop: spacing['8'],
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Column headers */}
          <View style={{ flexDirection: 'row', gap: SEAT_GAP, marginBottom: spacing['2'] }}>
            {['A', 'B', 'C', '', 'D', 'E', 'F'].map((col, i) => (
              <View
                key={i}
                style={{
                  width: col ? SEAT_SIZE : 20,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.text.muted }}>
                  {col}
                </Text>
              </View>
            ))}
          </View>

          {/* Seat rows — mock layout when no real seat map */}
          {Array.from({ length: 20 }, (_, row) => (
            <View
              key={row}
              style={{
                flexDirection: 'row',
                gap: SEAT_GAP,
                marginBottom: SEAT_GAP,
                alignItems: 'center',
              }}
            >
              {['A', 'B', 'C'].map((col) => {
                const designator = `${row + 1}${col}`;
                const isOccupied = Math.random() > 0.7;
                const isExitRow = row === 10 || row === 11;
                return (
                  <SeatButton
                    key={designator}
                    seat={{
                      type: 'seat',
                      designator,
                      status: isOccupied
                        ? 'occupied'
                        : isExitRow
                          ? 'extra_legroom'
                          : 'available',
                    }}
                    isSelected={currentSeat?.designation === designator}
                    onPress={() =>
                      currentPassengerId && selectSeat(currentPassengerId, designator, designator)
                    }
                  />
                );
              })}
              {/* Aisle + row number */}
              <View style={{ width: 20, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.text.muted }}>
                  {row + 1}
                </Text>
              </View>
              {['D', 'E', 'F'].map((col) => {
                const designator = `${row + 1}${col}`;
                const isOccupied = Math.random() > 0.7;
                const isExitRow = row === 10 || row === 11;
                return (
                  <SeatButton
                    key={designator}
                    seat={{
                      type: 'seat',
                      designator,
                      status: isOccupied
                        ? 'occupied'
                        : isExitRow
                          ? 'extra_legroom'
                          : 'available',
                    }}
                    isSelected={currentSeat?.designation === designator}
                    onPress={() =>
                      currentPassengerId && selectSeat(currentPassengerId, designator, designator)
                    }
                  />
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* Selection summary */}
      {currentSeat && (
        <View
          style={{
            backgroundColor: colors.sageDrift,
            borderRadius: radii.lg,
            padding: spacing['4'],
            marginTop: spacing['4'],
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>
            Seat {currentSeat.designation}
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: '#FFFFFF' }}>
            Window
          </Text>
        </View>
      )}

      {/* Navigation buttons */}
      <View style={{ flexDirection: 'row', gap: spacing['3'], marginTop: spacing['6'] }}>
        <Pressable
          onPress={() => router.push(`/booking/${destinationId}/extras`)}
          style={{ flex: 1 }}
        >
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.lg,
              paddingVertical: spacing['4'],
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.text.secondary }}>
              Skip seat selection
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/booking/${destinationId}/extras`)}
          style={{ flex: 2 }}
        >
          <View
            style={{
              backgroundColor: colors.deepDusk,
              borderRadius: radii.lg,
              paddingVertical: spacing['4'],
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>
              Continue
            </Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}
