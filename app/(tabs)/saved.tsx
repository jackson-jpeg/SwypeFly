import { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavedStore } from '../../stores/savedStore';
import SavedCard from '../../components/saved/SavedCard';
import { colors, fonts, spacing } from '../../theme/tokens';
import type { BoardDeal } from '../../types/deal';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedDeals, toggle } = useSavedStore();

  const handlePress = useCallback((deal: BoardDeal) => {
    if (deal.affiliateUrl) {
      if (Platform.OS === 'web') {
        window.open(deal.affiliateUrl, '_blank', 'noopener');
      } else {
        Linking.openURL(deal.affiliateUrl);
      }
    }
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: BoardDeal; index: number }) => (
      <SavedCard
        deal={item}
        index={index}
        onPress={() => handlePress(item)}
        onRemove={() => toggle(item)}
      />
    ),
    [handlePress, toggle],
  );

  const keyExtractor = useCallback((item: BoardDeal) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>SAVED</Text>
        <Text style={styles.subtitle}>
          {savedDeals.length} {savedDeals.length === 1 ? 'flight' : 'flights'}
        </Text>
      </View>

      {savedDeals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✈</Text>
          <Text style={styles.emptyTitle}>No saved flights yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart on any deal to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedDeals}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  grid: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.3 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.muted,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
