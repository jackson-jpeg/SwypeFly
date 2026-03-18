import { Platform } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii, textPresets } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface TravelTipsProps {
  destination: Destination;
}

const COST_LABELS = ['', '$', '$$', '$$$', '$$$$'];

export function TravelTips({ destination }: TravelTipsProps) {
  const tips = destination.travelTips;
  if (!tips || Platform.OS !== 'web') return null;

  const quickFacts = [
    { icon: '🛂', label: 'Visa', value: tips.visa },
    { icon: '💱', label: 'Currency', value: tips.currency },
    { icon: '🗣️', label: 'Language', value: tips.language },
    { icon: '🛡️', label: 'Safety', value: tips.safety },
  ];

  const proTips = [
    `Cost level: ${COST_LABELS[tips.costLevel] || '$$'} — plan your budget accordingly`,
    tips.visa.toLowerCase().includes('free') || tips.visa.toLowerCase().includes('no') ?
      `Easy visa situation: ${tips.visa}` : `Check visa requirements: ${tips.visa}`,
    `Local currency is ${tips.currency} — exchange before you go or use ATMs on arrival`,
    tips.language !== 'English' ? `Learn basic phrases in ${tips.language} — locals appreciate the effort!` : null,
    tips.safety.toLowerCase().includes('safe') ? `Generally safe destination — still keep valuables secure` : `Stay aware: ${tips.safety}`,
  ].filter(Boolean) as string[];

  return (
    <div style={{ marginTop: spacing['2'] }}>
      {/* Quick facts strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: spacing['5'] }}>
        {quickFacts.map(({ icon, label, value }) => (
          <div key={label} style={{
            flex: '1 1 calc(50% - 4px)', minWidth: 150,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: `${spacing['3']}px ${spacing['4']}px`,
            backgroundColor: colors.paleHorizon,
            borderRadius: radii.lg,
            border: `1px solid ${colors.divider}`,
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <div>
              <div style={{ color: colors.text.muted, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{label}</div>
              <div style={{ color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pro Tips section */}
      <div style={{ ...textPresets.display.sectionHeading, fontSize: fontSize['2xl'], marginBottom: spacing['3'] }}>
        Pro Tips
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proTips.map((tip, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
            <span style={{ color: colors.text.body, fontSize: fontSize.lg, lineHeight: 1.5 }}>{tip}</span>
          </div>
        ))}
      </div>

      {/* Best for tags */}
      {tips.bestFor && tips.bestFor.length > 0 && (
        <div style={{ marginTop: spacing['3'], display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: colors.text.muted, fontSize: fontSize.sm, marginRight: 4 }}>Best for:</span>
          {tips.bestFor.map(tag => (
            <span key={tag} style={{
              padding: '3px 10px', borderRadius: 9999,
              backgroundColor: 'rgba(168,196,184,0.15)', border: '1px solid rgba(168,196,184,0.25)',
              color: colors.sageDrift, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
              textTransform: 'capitalize',
            }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
