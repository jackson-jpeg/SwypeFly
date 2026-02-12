import { Pressable, Platform, View, Text } from 'react-native';
import { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { colors, layout } from '../../constants/theme';

interface CardActionsProps {
  isSaved: boolean;
  onToggleSave: () => void;
  onInfo?: () => void;
  onShare?: () => void;
}

const HEART_OUTLINE = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      stroke="rgba(255,255,255,0.85)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HEART_FILLED = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill={colors.primary}
      stroke={colors.primary}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const INFO_ICON = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" />
    <path d="M12 16v-4M12 8h.01" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SHARE_ICON = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BTN_SIZE = layout.actionBtnSize;
const BTN_RADIUS = BTN_SIZE / 2;
const BTN_GAP = layout.actionBtnGap;

const LABEL_STYLE = {
  color: 'rgba(255,255,255,0.7)',
  fontSize: 10,
  fontWeight: '600' as const,
  marginTop: 4,
  textAlign: 'center' as const,
};

function ActionButton({
  children,
  onPress,
  isActive,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  isActive?: boolean;
  label: string;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.75, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    onPress();
  };

  const activeBg = colors.primaryActiveBorder;
  const activeBorder = colors.primaryBorderStrong;
  const inactiveBg = colors.overlay.glass;
  const inactiveBorder = colors.overlay.white;

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            handlePress();
          }}
          style={{
            width: BTN_SIZE,
            height: BTN_SIZE,
            borderRadius: BTN_RADIUS,
            backgroundColor: isActive ? activeBg : inactiveBg,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
            border: `1px solid ${isActive ? activeBorder : inactiveBorder}`,
          }}
        >
          {children}
        </div>
        <span style={LABEL_STYLE}>{label}</span>
      </div>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={animStyle}>
        <Pressable
          onPress={handlePress}
          style={{
            width: BTN_SIZE,
            height: BTN_SIZE,
            borderRadius: BTN_RADIUS,
            backgroundColor: isActive ? activeBg : inactiveBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isActive ? activeBorder : inactiveBorder,
          }}
          hitSlop={12}
        >
          {children}
        </Pressable>
      </Animated.View>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function HeartButton({
  isSaved,
  onToggleSave,
}: {
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const scale = useSharedValue(1);
  const prevSaved = useRef(isSaved);

  useEffect(() => {
    if (isSaved && !prevSaved.current) {
      // Pop animation on save
      scale.value = withSequence(
        withSpring(1.3, { damping: 10, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 300 }),
      );
    }
    prevSaved.current = isSaved;
  }, [isSaved, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.75, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    onToggleSave();
  };

  const activeBg = colors.primaryActiveBorder;
  const activeBorder = colors.primaryBorderStrong;
  const inactiveBg = colors.overlay.glass;
  const inactiveBorder = colors.overlay.white;

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            handlePress();
          }}
          style={{
            width: BTN_SIZE,
            height: BTN_SIZE,
            borderRadius: BTN_RADIUS,
            backgroundColor: isSaved ? activeBg : inactiveBg,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
            transform: isSaved ? 'scale(1)' : 'scale(1)',
            border: `1px solid ${isSaved ? activeBorder : inactiveBorder}`,
          }}
        >
          {isSaved ? HEART_FILLED : HEART_OUTLINE}
        </div>
        <span style={LABEL_STYLE}>Save</span>
      </div>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={animStyle}>
        <Pressable
          onPress={handlePress}
          style={{
            width: BTN_SIZE,
            height: BTN_SIZE,
            borderRadius: BTN_RADIUS,
            backgroundColor: isSaved ? activeBg : inactiveBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isSaved ? activeBorder : inactiveBorder,
          }}
          hitSlop={12}
        >
          {isSaved ? HEART_FILLED : HEART_OUTLINE}
        </Pressable>
      </Animated.View>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', marginTop: 4 }}>Save</Text>
    </View>
  );
}

export function CardActions({ isSaved, onToggleSave, onInfo, onShare }: CardActionsProps) {
  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: BTN_GAP }}>
        <HeartButton isSaved={isSaved} onToggleSave={onToggleSave} />
        {onInfo && (
          <ActionButton onPress={onInfo} label="Details">
            {INFO_ICON}
          </ActionButton>
        )}
        {onShare && (
          <ActionButton onPress={onShare} label="Share">
            {SHARE_ICON}
          </ActionButton>
        )}
      </div>
    );
  }

  return (
    <View style={{ alignItems: 'center', gap: BTN_GAP }}>
      <HeartButton isSaved={isSaved} onToggleSave={onToggleSave} />
      {onInfo && (
        <ActionButton onPress={onInfo} label="Details">
          {INFO_ICON}
        </ActionButton>
      )}
      {onShare && (
        <ActionButton onPress={onShare} label="Share">
          {SHARE_ICON}
        </ActionButton>
      )}
    </View>
  );
}
