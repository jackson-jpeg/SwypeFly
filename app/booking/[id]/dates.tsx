import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDealStore } from '../../../stores/dealStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import DatePickerSheet from '../../../components/booking/DatePickerSheet';
import { colors } from '../../../theme/tokens';

export default function DatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';

  // Read any previously selected dates from the booking flow store
  const storedDep = useBookingFlowStore((s) => s.departureDate);
  const storedRet = useBookingFlowStore((s) => s.returnDate);

  const handleConfirm = (departureDate: string, returnDate: string) => {
    const store = useBookingFlowStore.getState();
    store.setDates(departureDate, returnDate);
    store.setTripContext(
      departureCode,
      deal?.iataCode || '',
      deal?.destinationFull || deal?.destination || '',
      deal?.price ?? null,
    );
    router.push(`/booking/${id}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <DatePickerSheet
        origin={departureCode}
        destination={deal?.iataCode || ''}
        initialDepartureDate={storedDep || deal?.departureDate || null}
        initialReturnDate={storedRet || deal?.returnDate || null}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
