import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import SplitFlapRow from '../../../components/board/SplitFlapRow';
import { useDealStore } from '../../../stores/dealStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import DatePickerSheet from '../../../components/booking/DatePickerSheet';
import { colors, fonts, spacing } from '../../../theme/tokens';

export default function DatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';

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
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.yellow} />
        </Pressable>
        <View style={styles.headerTitle}>
          <SplitFlapRow
            text="SELECT DATES"
            maxLength={14}
            size="md"
            color={colors.yellow}
            align="left"
            animate={true}
          />
        </View>
      </View>
      {deal && (
        <Text style={styles.subtitle}>
          {deal.destinationFull || deal.destination} from {departureCode}
        </Text>
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
});
