import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import SplitFlapRow from '../board/SplitFlapRow';
import { colors, fonts } from '../../theme/tokens';

const ICON_WHITE = '#F2F2F2';

interface LaunchMarkProps {
  visible: boolean;
  onFinish: () => void;
}

export default function LaunchMark({ visible, onFinish }: LaunchMarkProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    opacity.setValue(1);
    scale.setValue(1);

    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.965,
          duration: 360,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onFinish();
        }
      });
    }, 1350);

    return () => clearTimeout(exitTimer);
  }, [onFinish, opacity, scale, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View pointerEvents="auto" style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.markWrap, { transform: [{ scale }] }]}>
        <View style={styles.halo} />
        <Text style={styles.kicker}>DEPARTURES</Text>
        <SplitFlapRow
          text="GO"
          maxLength={2}
          size="xl"
          color={ICON_WHITE}
          align="left"
          staggerMs={140}
          startDelay={80}
          duration={760}
          animate
        />
        <Text style={styles.caption}>finding your next escape</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  halo: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#FFFFFF10',
  },
  kicker: {
    color: colors.muted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 4,
  },
  caption: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: 0.4,
  },
});
