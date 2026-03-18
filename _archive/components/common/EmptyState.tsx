import { View, Text, Pressable, Platform } from 'react-native';
import { colors, radii, spacing, fontSize, fontWeight } from '../../constants/theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}

function HeartOutlineSvg() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={colors.text.muted + '4D'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompassSvg() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke={colors.text.muted + '4D'} strokeWidth="1.5" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill={colors.text.muted + '4D'} />
    </svg>
  );
}

function getIcon(icon: string) {
  if (Platform.OS !== 'web') {
    return <Text style={{ fontSize: 56 }}>{icon}</Text>;
  }
  if (icon === '❤️') return <HeartOutlineSvg />;
  if (icon === '📭' || icon === '🧭') return <CompassSvg />;
  return <span style={{ fontSize: 56 }}>{icon}</span>;
}

export function EmptyState({ icon = '📭', title, description, ctaLabel, onCta }: EmptyStateProps) {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flex: 1, padding: `${spacing['15']}px ${spacing['8']}px`, minHeight: 400,
      }}>
        {getIcon(icon)}
        <h3 style={{ color: colors.text.primary, fontSize: fontSize['4xl'], fontWeight: fontWeight.bold, textAlign: 'center', margin: `${spacing['5']}px 0 0 0` }}>
          {title}
        </h3>
        <p style={{ color: colors.text.secondary, fontSize: fontSize.xl, textAlign: 'center', margin: `${spacing['2']}px 0 0 0`, lineHeight: 1.5, maxWidth: 280 }}>
          {description}
        </p>
        {ctaLabel && onCta && (
          <button
            onClick={onCta}
            style={{
              marginTop: spacing['6'], background: colors.primary, color: colors.text.primary, border: 'none',
              borderRadius: radii.xl, padding: `${spacing['4']}px ${spacing['8']}px`,
              fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['8'] }}>
      {getIcon(icon)}
      <Text style={{ color: colors.text.primary, fontSize: fontSize['4xl'], fontWeight: fontWeight.bold, textAlign: 'center', marginTop: spacing['5'] }}>{title}</Text>
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.xl, textAlign: 'center', marginTop: spacing['2'], lineHeight: 22 }}>{description}</Text>
      {ctaLabel && onCta && (
        <Pressable onPress={onCta} style={{ marginTop: spacing['6'], backgroundColor: colors.primary, borderRadius: radii.xl, paddingHorizontal: spacing['8'], paddingVertical: spacing['4'] }}>
          <Text style={{ color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
