import { View, Text, Pressable, Platform } from 'react-native';

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
        stroke="rgba(255,255,255,0.25)"
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
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="rgba(255,255,255,0.25)" />
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
        flex: 1, padding: '60px 32px', minHeight: 400,
      }}>
        {getIcon(icon)}
        <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', margin: '20px 0 0 0' }}>
          {title}
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', margin: '8px 0 0 0', lineHeight: 1.5, maxWidth: 280 }}>
          {description}
        </p>
        {ctaLabel && onCta && (
          <button
            onClick={onCta}
            style={{
              marginTop: 24, background: '#FF6B35', color: '#fff', border: 'none',
              borderRadius: 14, padding: '14px 32px', fontSize: 16, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      {getIcon(icon)}
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 20 }}>{title}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>{description}</Text>
      {ctaLabel && onCta && (
        <Pressable onPress={onCta} style={{ marginTop: 24, backgroundColor: '#FF6B35', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
