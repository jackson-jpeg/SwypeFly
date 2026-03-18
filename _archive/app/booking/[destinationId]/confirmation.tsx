// ─── 04f: Confirmation & Boarding Pass ──────────────────────────────────────
import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { colors, spacing, radii, textPresets } from '../../../constants/theme';
import { springs } from '../../../constants/animations';
import { useBookingStore } from '../../../stores/bookingStore';

export default function Confirmation() {
  const router = useRouter();
  const {
    destinationName,
    destinationImage,
    bookingReference,
    selectedSeats,
    passengers,
    bookingStatus,
    resetBooking,
  } = useBookingStore();

  const checkScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(30);

  useEffect(() => {
    checkScale.value = withSpring(1, { ...springs.saveHeart });
    cardOpacity.value = withDelay(400, withSpring(1, { damping: 15, stiffness: 80 }));
    cardTranslateY.value = withDelay(400, withSpring(0, { damping: 15, stiffness: 80 }));
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const handleDone = () => {
    resetBooking();
    router.replace('/(tabs)');
  };

  const firstPassenger = passengers[0];
  const firstSeat = selectedSeats[0];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing['10'] }}>
      {/* Hero image */}
      <View style={{ height: 280, position: 'relative' }}>
        {destinationImage && (
          <Image
            source={{ uri: destinationImage }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        )}
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(232,201,160,0.4)',
          }}
        />

        {/* Animated checkmark */}
        <Animated.View
          style={[
            checkStyle,
            {
              position: 'absolute',
              top: '30%',
              alignSelf: 'center',
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: 'rgba(168,196,184,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={{ fontSize: 32, color: colors.sageDrift }}>✓</Text>
        </Animated.View>

        {/* Title */}
        <View
          style={{
            position: 'absolute',
            bottom: spacing['6'],
            left: spacing['6'],
            right: spacing['6'],
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'Syne_800ExtraBold',
              fontSize: 24,
              color: '#FFFFFF',
              textAlign: 'center',
              ...(Platform.OS === 'web' ? { textShadow: '0 2px 8px rgba(0,0,0,0.3)' } : {}),
            }}
          >
            YOU'RE GOING TO{'\n'}
            {(destinationName || 'YOUR DESTINATION').toUpperCase()}!!
          </Text>
        </View>
      </View>

      {/* Boarding pass card */}
      <Animated.View
        style={[
          cardStyle,
          {
            marginHorizontal: spacing['6'],
            marginTop: -spacing['8'],
          },
        ]}
      >
        <View
          style={{
            backgroundColor: '#FFFDF5',
            borderRadius: radii.lg,
            padding: spacing['6'],
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: 'dashed',
          }}
        >
          {/* SOGOJET wordmark + BOARDING PASS */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['6'] }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ fontFamily: 'Syne_800ExtraBold', fontSize: 16, color: colors.deepDusk }}>
                SOGO
              </Text>
              <Text style={{ fontFamily: 'Syne_800ExtraBold', fontSize: 16, color: colors.seafoamMist }}>
                JET
              </Text>
            </View>
            <Text style={{ ...textPresets.body.sectionLabel, fontSize: 10, letterSpacing: 2 }}>
              BOARDING PASS
            </Text>
          </View>

          {/* Route */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing['6'],
            }}
          >
            <View>
              <Text style={{ ...textPresets.body.caption }}>FROM</Text>
              <Text style={{ fontFamily: 'Syne_800ExtraBold', fontSize: 28, color: colors.deepDusk }}>
                JFK
              </Text>
            </View>
            <Text style={{ fontSize: 24, color: colors.deepDusk }}>✈</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...textPresets.body.caption }}>TO</Text>
              <Text style={{ fontFamily: 'Syne_800ExtraBold', fontSize: 28, color: colors.deepDusk }}>
                {(destinationName || 'DST').substring(0, 3).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Details grid */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing['4'],
              marginBottom: spacing['6'],
            }}
          >
            {[
              { label: 'PASSENGER', value: firstPassenger ? `${firstPassenger.given_name} ${firstPassenger.family_name}` : '—' },
              { label: 'SEAT', value: firstSeat?.designation || '—' },
              { label: 'BOOKING REF', value: bookingReference || '—' },
              { label: 'STATUS', value: bookingStatus === 'confirmed' ? 'Confirmed' : 'Pending' },
            ].map((item) => (
              <View key={item.label} style={{ width: '45%' }}>
                <Text style={{ ...textPresets.body.sectionLabel, fontSize: 9 }}>{item.label}</Text>
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 14,
                    color: colors.deepDusk,
                    marginTop: 2,
                  }}
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          {/* QR code placeholder */}
          <View
            style={{
              backgroundColor: colors.duskSand,
              borderRadius: radii.sm,
              padding: spacing['4'],
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 120,
                height: 120,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.text.muted }}>
                QR Code
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 11,
                color: colors.text.muted,
                marginTop: spacing['2'],
              }}
            >
              {bookingReference || 'XXXXXX'}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Actions */}
      <View style={{ paddingHorizontal: spacing['6'], marginTop: spacing['6'], gap: spacing['3'] }}>
        <Pressable
          style={{
            backgroundColor: colors.deepDusk,
            height: 52,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 17, color: colors.paleHorizon }}>
            Add to Apple Wallet
          </Text>
        </Pressable>

        <Pressable
          onPress={handleDone}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            paddingVertical: spacing['4'],
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text.primary }}>
            Back to Exploring
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
