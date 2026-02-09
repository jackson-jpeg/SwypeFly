import { Pressable, Text, Platform } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; color: string; border?: string }> = {
  primary: { bg: '#38BDF8', color: '#fff' },
  secondary: { bg: '#F1F5F9', color: '#1E293B' },
  ghost: { bg: 'transparent', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' },
};

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const s = variantStyles[variant];

  if (Platform.OS === 'web') {
    return (
      <button
        onClick={onPress}
        disabled={disabled}
        style={{
          backgroundColor: s.bg, color: s.color, border: s.border || 'none',
          borderRadius: 14, padding: '14px 24px', fontSize: 16, fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          width: '100%',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: s.bg, borderRadius: 14,
        paddingHorizontal: 24, paddingVertical: 14,
        alignItems: 'center', opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: s.color, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
