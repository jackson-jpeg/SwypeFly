import { Pressable, Platform } from 'react-native';
import { useState } from 'react';

interface CardActionsProps {
  isSaved: boolean;
  onToggleSave: () => void;
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
      fill="#38BDF8"
      stroke="#38BDF8"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function CardActions({ isSaved, onToggleSave }: CardActionsProps) {
  const [pressed, setPressed] = useState(false);

  const handlePress = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    setPressed(true);
    onToggleSave();
    setTimeout(() => setPressed(false), 250);
  };

  const scale = pressed ? 0.78 : 1;

  if (Platform.OS === 'web') {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          handlePress();
        }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: isSaved ? 'rgba(56,189,248,0.18)' : 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
          transform: `scale(${scale})`,
          border: `1px solid ${isSaved ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        {isSaved ? HEART_FILLED : HEART_OUTLINE}
      </div>
    );
  }

  return (
    <Pressable
      onPress={() => handlePress()}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isSaved ? 'rgba(56,189,248,0.18)' : 'rgba(0,0,0,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: isSaved ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.08)',
        transform: [{ scale }],
      }}
      hitSlop={12}
    >
      {isSaved ? HEART_FILLED : HEART_OUTLINE}
    </Pressable>
  );
}
