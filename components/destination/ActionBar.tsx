// ─── Action Bar ──────────────────────────────────────────────────────────────
// Primary CTA (Check Flights), secondary (Hotels), icon row (Activities, Save, Share).

import { View, Text, Pressable, Platform, Linking } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii, shadows } from '../../constants/theme';
import { flightLink, hotelLink, activitiesLink } from '../../utils/affiliateLinks';

interface ActionBarProps {
  departureCode: string;
  iataCode: string;
  city: string;
  country: string;
  marker: string;
  saved: boolean;
  shareCopied: boolean;
  onToggleSave: () => void;
  onShare: () => void;
}

export function ActionBar({ departureCode, iataCode, city, country, marker, saved, shareCopied, onToggleSave, onShare }: ActionBarProps) {
  const openUrl = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <style>{`
          .sg-cta-btn { transition: filter 0.15s, transform 0.15s; }
          .sg-cta-btn:hover { filter: brightness(1.05); transform: scale(1.02); }
          .sg-cta-btn:active { transform: scale(0.98); }
        `}</style>
        <button
          className="sg-cta-btn"
          onClick={() => openUrl(flightLink(departureCode, iataCode, marker))}
          style={{
            background: colors.primary, color: '#fff', border: 'none', borderRadius: radii['2xl'],
            padding: `${spacing['4']}px ${spacing['6']}px`, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'],
            boxShadow: shadows.web.primary,
          }}
        >
          &#9992;&#65039; Check Flights
        </button>
        <button
          className="sg-cta-btn"
          onClick={() => openUrl(hotelLink(city, country, marker))}
          style={{
            background: colors.primaryDarker, color: '#fff', border: 'none', borderRadius: radii['2xl'],
            padding: `${spacing['4']}px ${spacing['6']}px`, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'],
            boxShadow: shadows.web.primaryDark,
          }}
        >
          &#127976; Find Hotels
        </button>
        {/* Secondary row */}
        <div style={{ display: 'flex', gap: spacing['3'] }}>
          <button
            className="sg-cta-btn"
            onClick={() => openUrl(activitiesLink(city, country, marker))}
            style={{
              flex: 1, background: colors.surface, color: colors.text.primary,
              border: `1px solid ${colors.border}`, borderRadius: radii['2xl'],
              padding: `${spacing['3']}px`, fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1'],
            }}
          >
            &#127759; Activities
          </button>
          <button
            className="sg-cta-btn"
            onClick={onToggleSave}
            style={{
              flex: 1,
              background: saved ? colors.primaryTint : colors.surface,
              color: saved ? colors.primaryDarker : colors.text.primary,
              border: `1px solid ${saved ? colors.primaryBorderStrong : colors.border}`,
              borderRadius: radii['2xl'], padding: `${spacing['3']}px`,
              fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1'],
            }}
          >
            {saved ? '\u2764\uFE0F Saved' : '\u{1F90D} Save'}
          </button>
          <button
            className="sg-cta-btn"
            onClick={onShare}
            style={{
              flex: 1, background: colors.surface, color: colors.text.primary,
              border: `1px solid ${colors.border}`, borderRadius: radii['2xl'],
              padding: `${spacing['3']}px`, fontSize: fontSize.lg, fontWeight: fontWeight.bold, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1'],
            }}
          >
            {shareCopied ? 'Copied!' : '\u{1F4E4} Share'}
          </button>
        </div>
      </div>
    );
  }

  // Native
  return (
    <View style={{ gap: spacing['3'] }}>
      <Pressable
        onPress={() => openUrl(flightLink(departureCode, iataCode, marker))}
        style={{ backgroundColor: colors.primary, borderRadius: radii['2xl'], padding: spacing['4'], alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
          {'\u2708\uFE0F'} Check Flights
        </Text>
      </Pressable>
      <Pressable
        onPress={() => openUrl(hotelLink(city, country, marker))}
        style={{ backgroundColor: colors.primaryDarker, borderRadius: radii['2xl'], padding: spacing['4'], alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
          {'\uD83C\uDFE8'} Find Hotels
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing['3'] }}>
        <Pressable
          onPress={() => openUrl(activitiesLink(city, country, marker))}
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing['3'], borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
        >
          <Text style={{ color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>{'\uD83C\uDF0F'} Activities</Text>
        </Pressable>
        <Pressable
          onPress={onToggleSave}
          style={{
            flex: 1, backgroundColor: saved ? colors.primaryTint : colors.surface,
            borderRadius: radii['2xl'], padding: spacing['3'],
            borderWidth: 1, borderColor: saved ? colors.primaryBorderStrong : colors.border, alignItems: 'center',
          }}
        >
          <Text style={{ color: saved ? colors.primaryDarker : colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
            {saved ? '\u2764\uFE0F Saved' : '\uD83E\uDD0D Save'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing['3'], borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
        >
          <Text style={{ color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>{'\uD83D\uDCE4'} Share</Text>
        </Pressable>
      </View>
    </View>
  );
}
