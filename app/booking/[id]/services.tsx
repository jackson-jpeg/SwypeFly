import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import SplitFlapRow from '../../../components/board/SplitFlapRow';
import TripBanner from '../../../components/booking/TripBanner';
import BookingProgress from '../../../components/booking/BookingProgress';
import { useBookingFlowStore, type SelectedService } from '../../../stores/bookingFlowStore';
import { colors, fonts, spacing } from '../../../theme/tokens';
import { lightHaptic, successHaptic } from '../../../utils/haptics';

// ─── Options ─────────────────────────────────────────────────────────

const CHECKED_BAG_OPTIONS = [
  { id: 'bag_none', label: 'No checked bag', weight: null, price: 0 },
  { id: 'bag_23', label: '1 bag — 23 kg', weight: '23kg', price: 35 },
  { id: 'bag_32', label: '1 bag — 32 kg', weight: '32kg', price: 55 },
] as const;

const EXTRAS = [
  {
    id: 'extra_priority',
    name: 'Priority Boarding',
    description: 'Board first and settle in before everyone else',
    icon: 'flash-outline' as const,
    price: 15,
  },
  {
    id: 'extra_insurance',
    name: 'Travel Insurance',
    description: 'Trip cancellation and medical coverage',
    icon: 'shield-checkmark-outline' as const,
    price: 29,
  },
  {
    id: 'extra_flexible',
    name: 'Flexible Rebooking',
    description: 'Change your dates for free, up to 24h before departure',
    icon: 'calendar-outline' as const,
    price: 19,
  },
] as const;

// ─── Screen ──────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setServices = useBookingFlowStore((s) => s.setServices);

  const [selectedBag, setSelectedBag] = useState('bag_none');
  const [cabinBagExtra, setCabinBagExtra] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  const cabinBagPrice = 25;

  const toggleExtra = useCallback((extraId: string) => {
    lightHaptic();
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(extraId)) next.delete(extraId);
      else next.add(extraId);
      return next;
    });
  }, []);

  const totalAddOns = useMemo(() => {
    let total = 0;
    if (cabinBagExtra) total += cabinBagPrice;
    const bag = CHECKED_BAG_OPTIONS.find((b) => b.id === selectedBag);
    if (bag) total += bag.price;
    for (const extra of EXTRAS) {
      if (selectedExtras.has(extra.id)) total += extra.price;
    }
    return total;
  }, [cabinBagExtra, selectedBag, selectedExtras]);

  const handleContinue = useCallback(() => {
    const services: SelectedService[] = [];

    if (cabinBagExtra) {
      services.push({
        id: 'cabin_bag_extra',
        type: 'baggage',
        name: 'Extra Cabin Bag',
        amount: cabinBagPrice,
        currency: 'USD',
      });
    }

    const bag = CHECKED_BAG_OPTIONS.find((b) => b.id === selectedBag);
    if (bag && bag.price > 0) {
      services.push({
        id: bag.id,
        type: 'baggage',
        name: bag.label,
        amount: bag.price,
        currency: 'USD',
      });
    }

    for (const extra of EXTRAS) {
      if (selectedExtras.has(extra.id)) {
        services.push({
          id: extra.id,
          type: 'extra',
          name: extra.name,
          amount: extra.price,
          currency: 'USD',
        });
      }
    }

    setServices(services);
    successHaptic();
    router.push(`/booking/${id}/review` as never);
  }, [cabinBagExtra, selectedBag, selectedExtras, id, router, setServices]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.yellow} />
        </Pressable>
        <View style={styles.headerTitle}>
          <SplitFlapRow
            text="SERVICES"
            maxLength={12}
            size="md"
            color={colors.yellow}
            align="left"
            animate={true}
          />
        </View>
        <Text style={styles.subtitle}>Optional add-ons for your trip</Text>
      </View>
      <BookingProgress />
      <TripBanner />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Cabin Baggage ──────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CABIN BAGGAGE</Text>

          <View style={styles.includedRow}>
            <Ionicons name="bag-outline" size={20} color={colors.green} />
            <View style={styles.includedInfo}>
              <Text style={styles.includedText}>Personal item</Text>
              <Text style={styles.includedSub}>Fits under the seat in front of you</Text>
            </View>
            <View style={styles.includedBadge}>
              <Text style={styles.includedBadgeText}>Included</Text>
            </View>
          </View>

          <Pressable
            style={[styles.toggleRow, cabinBagExtra && styles.toggleRowActive]}
            onPress={() => { lightHaptic(); setCabinBagExtra(!cabinBagExtra); }}
            accessibilityRole="switch"
            accessibilityState={{ checked: cabinBagExtra }}
            accessibilityLabel={`Extra cabin bag, $${cabinBagPrice}`}
          >
            <View style={[styles.checkbox, cabinBagExtra && styles.checkboxActive]}>
              {cabinBagExtra && <Ionicons name="checkmark" size={14} color={colors.bg} />}
            </View>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleText, cabinBagExtra && styles.toggleTextActive]}>
                Extra cabin bag
              </Text>
              <Text style={styles.toggleSub}>Overhead bin — max 10 kg</Text>
            </View>
            <Text style={[styles.togglePrice, cabinBagExtra && styles.togglePriceActive]}>
              +${cabinBagPrice}
            </Text>
          </Pressable>
        </View>

        {/* ─── Checked Baggage ─────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CHECKED BAGGAGE</Text>
          {CHECKED_BAG_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              style={[styles.radioRow, selectedBag === opt.id && styles.radioRowActive]}
              onPress={() => { lightHaptic(); setSelectedBag(opt.id); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedBag === opt.id }}
              accessibilityLabel={`${opt.label}, ${opt.price === 0 ? 'free' : `$${opt.price}`}`}
            >
              <View style={[styles.radio, selectedBag === opt.id && styles.radioActive]}>
                {selectedBag === opt.id && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.radioText, selectedBag === opt.id && styles.radioTextActive]}>
                {opt.label}
              </Text>
              <Text style={[styles.radioPrice, selectedBag === opt.id && styles.radioPriceActive]}>
                {opt.price === 0 ? 'Free' : `+$${opt.price}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Travel Extras ──────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRAVEL EXTRAS</Text>
          {EXTRAS.map((extra) => {
            const selected = selectedExtras.has(extra.id);
            return (
              <Pressable
                key={extra.id}
                style={[styles.toggleRow, selected && styles.toggleRowActive]}
                onPress={() => toggleExtra(extra.id)}
                accessibilityRole="switch"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${extra.name}, $${extra.price}`}
              >
                <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                  {selected && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <View style={styles.toggleInfo}>
                  <View style={styles.toggleHeader}>
                    <Ionicons
                      name={extra.icon}
                      size={16}
                      color={selected ? colors.green : colors.muted}
                    />
                    <Text style={[styles.toggleText, selected && styles.toggleTextActive]}>
                      {extra.name}
                    </Text>
                  </View>
                  <Text style={styles.toggleSub}>{extra.description}</Text>
                </View>
                <Text style={[styles.togglePrice, selected && styles.togglePriceActive]}>
                  +${extra.price}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* ─── Bottom Bar ───────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {totalAddOns > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Add-ons total</Text>
            <Text style={styles.totalAmount}>+${totalAddOns}</Text>
          </View>
        )}
        <Pressable
          style={styles.continueBtn}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue to review"
        >
          <Text style={styles.continueBtnText}>
            {totalAddOns > 0 ? 'Continue with extras' : 'Skip extras'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  headerTitle: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
  },
  includedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.green + '40',
    borderRadius: 8,
    padding: 14,
    marginBottom: spacing.sm,
  },
  includedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  includedText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  includedSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  includedBadge: {
    backgroundColor: colors.green + '20',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  includedBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.green,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: spacing.sm,
  },
  toggleRowActive: {
    borderColor: colors.green,
    backgroundColor: colors.green + '08',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  toggleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.muted,
  },
  toggleTextActive: {
    color: colors.white,
  },
  toggleSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  togglePrice: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.muted,
    marginLeft: spacing.sm,
  },
  togglePriceActive: {
    color: colors.green,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: spacing.sm,
  },
  radioRowActive: {
    borderColor: colors.green,
    backgroundColor: colors.green + '08',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: colors.green,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  radioText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.muted,
    marginLeft: 12,
  },
  radioTextActive: {
    color: colors.white,
  },
  radioPrice: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.muted,
    marginLeft: spacing.sm,
  },
  radioPriceActive: {
    color: colors.green,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  totalAmount: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.green,
    letterSpacing: 1,
  },
  continueBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  continueBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },
});
