import { View, Text, StyleSheet, Dimensions } from 'react-native';
import SplitFlapRow from '../board/SplitFlapRow';
import { colors, fonts } from '../../theme/tokens';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Split-flap loading state — shows "SEARCHING" cycling in
 * like a departure board refreshing.
 */
export default function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.loadingContainer}>
        <SplitFlapRow
          text="SEARCHING"
          maxLength={12}
          size="lg"
          color={colors.yellow}
          align="left"
          startDelay={0}
          staggerMs={80}
          animate={true}
        />
        <Text style={styles.loadingSubtext}>Finding the best deals...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  loadingSubtext: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 16,
    letterSpacing: 0.5,
  },
});
