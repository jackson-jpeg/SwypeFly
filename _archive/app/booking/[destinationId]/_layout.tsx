import { Stack, useLocalSearchParams } from 'expo-router';
import { View, Platform } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../../constants/theme';
import { useBookingStore } from '../../../stores/bookingStore';

const STEPS = ['Flights', 'Passengers', 'Seats', 'Extras', 'Review', 'Confirmation'];

function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 24,
        paddingVertical: 8,
      }}
    >
      {STEPS.slice(0, 5).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i <= currentStep ? colors.sageDrift : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function BlurredHeader() {
  const image = useBookingStore((s) => s.destinationImage);

  if (!image) return null;

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          height: 80,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(245,236,215,0.6)',
          }}
        />
      </div>
    );
  }

  return (
    <View style={{ height: 80, overflow: 'hidden' }}>
      <Image
        source={{ uri: image }}
        style={{ width: '100%', height: '100%' }}
        blurRadius={20}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(245,236,215,0.6)',
        }}
      />
    </View>
  );
}

export default function BookingLayout() {
  const _params = useLocalSearchParams();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BlurredHeader />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="flights" />
        <Stack.Screen name="passengers" />
        <Stack.Screen name="seats" />
        <Stack.Screen name="extras" />
        <Stack.Screen name="review" />
        <Stack.Screen name="confirmation" />
      </Stack>
    </View>
  );
}

export { StepBar };
