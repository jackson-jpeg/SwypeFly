import { Pressable, Text, Platform } from 'react-native';
import { colors, radii, fontSize, fontWeight } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; color: string; border?: string; borderColor?: string }> = {
  primary: { bg: colors.primary, color: '#fff' },
  secondary: { bg: colors.surfaceElevated, color: colors.text.primary },
  outline: { bg: colors.surface, color: colors.text.primary, border: `1px solid ${colors.border}`, borderColor: colors.border },
  ghost: { bg: 'transparent', color: colors.primary, border: `1px solid ${colors.primaryBorderStrong}`, borderColor: colors.primaryBorderStrong },
};

const sizeStyles: Record<ButtonSize, { padding: string; paddingV: number; paddingH: number; fontSize: number; radius: number }> = {
  sm: { padding: '8px 16px', paddingV: 8, paddingH: 16, fontSize: fontSize.base, radius: radii.md },
  md: { padding: '14px 24px', paddingV: 14, paddingH: 24, fontSize: fontSize['2xl'], radius: radii.xl },
  lg: { padding: '16px 24px', paddingV: 16, paddingH: 24, fontSize: fontSize['2xl'], radius: radii['2xl'] },
};

export function Button({ label, onPress, variant = 'primary', size = 'md', disabled = false }: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  if (Platform.OS === 'web') {
    return (
      <button
        onClick={onPress}
        disabled={disabled}
        style={{
          backgroundColor: v.bg, color: v.color, border: v.border || 'none',
          borderRadius: s.radius, padding: s.padding, fontSize: s.fontSize, fontWeight: fontWeight.bold,
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
        backgroundColor: v.bg, borderRadius: s.radius,
        paddingHorizontal: s.paddingH, paddingVertical: s.paddingV,
        alignItems: 'center', opacity: disabled ? 0.5 : 1,
        ...(v.borderColor ? { borderWidth: 1, borderColor: v.borderColor } : {}),
      }}
    >
      <Text style={{ color: v.color, fontSize: s.fontSize, fontWeight: fontWeight.bold }}>{label}</Text>
    </Pressable>
  );
}
