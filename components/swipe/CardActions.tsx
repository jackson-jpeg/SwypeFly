import { Pressable, Platform, View } from 'react-native';
import { useState } from 'react';
import { colors, layout } from '../../constants/theme';

interface CardActionsProps {
  isSaved: boolean;
  onToggleSave: () => void;
  onInfo?: () => void;
  onShare?: () => void;
}

const HEART_OUTLINE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" />
    <path d="M12 16v-4M12 8h.01" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SHARE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BTN_SIZE = layout.actionBtnSize;
const BTN_RADIUS = BTN_SIZE / 2;
const BTN_GAP = layout.actionBtnGap;

function ActionButton({
  children,
  onPress,
  isActive,
}: {
  children: React.ReactNode;
  onPress: () => void;
  isActive?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = pressed ? 0.78 : 1;

  const handlePress = () => {
    setPressed(true);
    onPress();
    setTimeout(() => setPressed(false), 250);
  };

  const activeBg = colors.primaryActiveBorder;
  const activeBorder = colors.primaryBorderStrong;
  const inactiveBg = colors.overlay.glass;
  const inactiveBorder = colors.overlay.white;

  if (Platform.OS === 'web') {
    return (
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
          transform: `scale(${scale})`,
          border: `1px solid ${isActive ? activeBorder : inactiveBorder}`,
        }}
      >
        {children}
      </div>
    );
  }

  return (
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
        transform: [{ scale }],
      }}
      hitSlop={12}
    >
      {children}
    </Pressable>
  );
}

export function CardActions({ isSaved, onToggleSave, onInfo, onShare }: CardActionsProps) {
  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: BTN_GAP }}>
        <ActionButton onPress={onToggleSave} isActive={isSaved}>
          {isSaved ? HEART_FILLED : HEART_OUTLINE}
        </ActionButton>
        {onInfo && (
          <ActionButton onPress={onInfo}>
            {INFO_ICON}
          </ActionButton>
        )}
        {onShare && (
          <ActionButton onPress={onShare}>
            {SHARE_ICON}
          </ActionButton>
        )}
      </div>
    );
  }

  return (
    <View style={{ alignItems: 'center', gap: BTN_GAP }}>
      <ActionButton onPress={onToggleSave} isActive={isSaved}>
        {isSaved ? HEART_FILLED : HEART_OUTLINE}
      </ActionButton>
      {onInfo && (
        <ActionButton onPress={onInfo}>
          {INFO_ICON}
        </ActionButton>
      )}
      {onShare && (
        <ActionButton onPress={onShare}>
          {SHARE_ICON}
        </ActionButton>
      )}
    </View>
  );
}
