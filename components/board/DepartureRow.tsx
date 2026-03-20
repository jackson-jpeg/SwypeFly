import { memo, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import SplitFlapRow from './SplitFlapRow';
import { colors } from '../../theme/tokens';
import type { BoardDeal } from '../../types/deal';

const STATUS_COLORS: Record<BoardDeal['status'], string> = {
  DEAL: colors.green,
  HOT: colors.orange,
  NEW: colors.yellow,
};

const DEAL_TIER_COLORS: Record<string, string> = {
  amazing: colors.dealAmazing,
  great: colors.dealGreat,
  good: colors.dealGood,
  fair: colors.muted,
};

function getStatusText(deal: BoardDeal): string {
  if (deal.savingsPercent && deal.savingsPercent > 0) {
    return `-${deal.savingsPercent}%`;
  }
  return deal.status;
}

function getStatusColor(deal: BoardDeal): string {
  if (deal.dealTier && deal.dealTier !== 'fair') {
    return DEAL_TIER_COLORS[deal.dealTier] || colors.muted;
  }
  return STATUS_COLORS[deal.status];
}

interface DepartureRowProps {
  deal: BoardDeal;
  isActive: boolean;
  animate: boolean;
  onAnimationComplete?: () => void;
}

function DepartureRow({ deal, isActive, animate, onAnimationComplete }: DepartureRowProps) {
  const completedCols = useRef(0);

  const handleColumnComplete = useCallback(() => {
    completedCols.current += 1;
    if (completedCols.current >= 5) {
      completedCols.current = 0;
      onAnimationComplete?.();
    }
  }, [onAnimationComplete]);

  // Reset counter when animation starts (in useEffect, not render phase)
  useEffect(() => {
    if (animate) completedCols.current = 0;
  }, [animate]);

  return (
    <View style={[styles.row, isActive ? styles.active : styles.inactive]}>
      {/* Time — e.g. "14:25" */}
      <SplitFlapRow
        text={deal.departureTime}
        maxLength={5}
        size="sm"
        color={colors.yellow}
        align="right"
        startDelay={0}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Destination — e.g. "SANTORINI" */}
      <SplitFlapRow
        text={deal.destination}
        maxLength={12}
        size="md"
        color={colors.yellow}
        align="left"
        startDelay={80}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Flight — e.g. "DL847" */}
      <SplitFlapRow
        text={deal.flightCode}
        maxLength={6}
        size="sm"
        color={colors.whiteDim}
        align="left"
        startDelay={160}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Price — e.g. "$387" or "—" */}
      <SplitFlapRow
        text={deal.price != null ? deal.priceFormatted : '—'}
        maxLength={5}
        size="md"
        color={deal.price != null ? colors.green : colors.faint}
        align="right"
        startDelay={240}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Status — deal tier savings or legacy status */}
      <SplitFlapRow
        text={getStatusText(deal)}
        maxLength={5}
        size="sm"
        color={getStatusColor(deal)}
        align="left"
        startDelay={320}
        animate={animate}
        onComplete={handleColumnComplete}
      />
    </View>
  );
}

export default memo(DepartureRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1510',
    gap: 10,
    borderLeftWidth: 3,
  },
  active: {
    borderLeftColor: colors.yellow,
    opacity: 1,
  },
  inactive: {
    borderLeftColor: 'transparent',
    opacity: 0.45,
  },
});
