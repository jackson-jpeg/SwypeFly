import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../theme/tokens';
import { useUserStatsStore, type LeaderboardEntry } from '../../stores/userStatsStore';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <View style={[styles.rankBadge, { backgroundColor: MEDAL_COLORS[rank - 1] }]}>
        <Text style={styles.rankBadgeText}>{rank}</Text>
      </View>
    );
  }
  return (
    <View style={styles.rankPlain}>
      <Text style={styles.rankPlainText}>{rank}</Text>
    </View>
  );
}

function LeaderboardRow({ item }: { item: LeaderboardEntry }) {
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={`Rank ${item.rank}, ${item.username}, ${item.total_saves} saves, ${item.avg_savings_percent}% avg savings`}>
      <RankBadge rank={item.rank} />
      <View style={styles.rowInfo}>
        <Text style={styles.username} numberOfLines={1}>
          {item.username}
        </Text>
        {item.top_destination && (
          <Text style={styles.topDest} numberOfLines={1}>
            Top: {item.top_destination}
          </Text>
        )}
      </View>
      <View style={styles.rowStats}>
        <Text style={styles.savingsPercent}>{item.avg_savings_percent}%</Text>
        <Text style={styles.savingsLabel}>avg saved</Text>
        <Text style={styles.savesCount}>
          {item.total_saves} {item.total_saves === 1 ? 'deal' : 'deals'}
        </Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { leaderboard, isLoading, error, fetchLeaderboard } = useUserStatsStore();

  const loadData = useCallback(() => {
    fetchLeaderboard(API_BASE);
  }, [fetchLeaderboard]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.yellow} />
        </Pressable>
        <Text style={styles.title}>LEADERBOARD</Text>
        <Pressable
          onPress={loadData}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Refresh leaderboard"
        >
          <Ionicons name="refresh" size={20} color={colors.muted} />
        </Pressable>
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>Top deal hunters ranked by savings</Text>

      {/* Content */}
      {isLoading && leaderboard.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.yellow} />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : error && leaderboard.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Couldn't load leaderboard</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <Pressable
            onPress={loadData}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySubtitle}>
            Save deals to start climbing the leaderboard!
          </Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 50).springify()}>
              <LeaderboardRow item={item} />
            </Animated.View>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          showsVerticalScrollIndicator={false}
          refreshing={isLoading}
          onRefresh={loadData}
        />
      )}
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
    paddingVertical: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.yellow,
    textAlign: 'center',
    letterSpacing: 3,
  },
  refreshBtn: {
    padding: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.md,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.yellow,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.bg,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.bg,
  },
  rankPlain: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankPlainText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.muted,
  },
  rowInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  username: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  topDest: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rowStats: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  savingsPercent: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.dealAmazing,
    letterSpacing: 1,
  },
  savingsLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
    marginTop: -2,
  },
  savesCount: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.whiteDim,
    marginTop: 2,
  },
});
