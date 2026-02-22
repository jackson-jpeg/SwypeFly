import { Platform } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface TravelTipsProps {
  destination: Destination;
}

const COST_LABELS = ['', '$', '$$', '$$$', '$$$$'];

export function TravelTips({ destination }: TravelTipsProps) {
  const tips = destination.travelTips;
  if (!tips || Platform.OS !== 'web') return null;

  const items = [
    { icon: '🛂', label: 'Visa', value: tips.visa },
    { icon: '💱', label: 'Currency', value: tips.currency },
    { icon: '🗣️', label: 'Language', value: tips.language },
    { icon: '🛡️', label: 'Safety', value: tips.safety },
    { icon: '💰', label: 'Cost Level', value: COST_LABELS[tips.costLevel] || '$$' },
  ];

  return (
    <div style={{ marginTop: spacing['2'] }}>
      <div style={{ color: colors.dark.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing['4'] }}>
        Travel Tips
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(({ icon, label, value }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: `${spacing['3']}px ${spacing['4']}px`,
            backgroundColor: colors.dark.surface,
            borderRadius: radii.lg,
            border: `1px solid ${colors.dark.border}`,
          }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{icon}</span>
            <div>
              <div style={{ color: colors.dark.text.muted, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{label}</div>
              <div style={{ color: colors.dark.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Best for tags */}
      {tips.bestFor && tips.bestFor.length > 0 && (
        <div style={{ marginTop: spacing['3'], display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: colors.dark.text.muted, fontSize: fontSize.sm, marginRight: 4 }}>Best for:</span>
          {tips.bestFor.map(tag => (
            <span key={tag} style={{
              padding: '3px 10px', borderRadius: 9999,
              backgroundColor: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.15)',
              color: '#38BDF8', fontSize: fontSize.sm, fontWeight: fontWeight.medium,
              textTransform: 'capitalize',
            }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
