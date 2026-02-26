import { Platform, View, Text } from 'react-native';
import type { Destination } from '../../types/destination';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  'Indonesia': 'Asia', 'Greece': 'Europe', 'Japan': 'Asia', 'Peru': 'Americas',
  'Morocco': 'Africa', 'Iceland': 'Europe', 'Italy': 'Europe', 'South Africa': 'Africa',
  'Croatia': 'Europe', 'Maldives': 'Asia', 'Spain': 'Europe', 'Canada': 'Americas',
  'Portugal': 'Europe', 'New Zealand': 'Oceania', 'UAE': 'Asia', 'Argentina': 'Americas',
  'Thailand': 'Asia', 'Switzerland': 'Europe', 'Cuba': 'Americas', 'Australia': 'Oceania',
  'Mexico': 'Americas', 'France': 'Europe', 'Colombia': 'Americas', 'India': 'Asia',
  'Egypt': 'Africa', 'Brazil': 'Americas', 'USA': 'Americas', 'United States': 'Americas',
  'Vietnam': 'Asia', 'Turkey': 'Europe', 'Kenya': 'Africa', 'Chile': 'Americas',
  'Costa Rica': 'Americas', 'Philippines': 'Asia', 'Tanzania': 'Africa',
  'Cambodia': 'Asia', 'Sri Lanka': 'Asia', 'Nepal': 'Asia', 'Fiji': 'Oceania',
  'Norway': 'Europe', 'Ecuador': 'Americas', 'Sweden': 'Europe',
  'Scotland': 'Europe', 'United Kingdom': 'Europe', 'Ireland': 'Europe',
  'Germany': 'Europe', 'Netherlands': 'Europe', 'Czech Republic': 'Europe',
  'Austria': 'Europe', 'Hungary': 'Europe', 'Poland': 'Europe',
  'Romania': 'Europe', 'Bulgaria': 'Europe', 'Serbia': 'Europe',
  'Montenegro': 'Europe', 'Albania': 'Europe', 'Slovenia': 'Europe',
  'Finland': 'Europe', 'Denmark': 'Europe', 'Belgium': 'Europe',
  'Malta': 'Europe', 'Cyprus': 'Europe', 'Georgia': 'Europe',
  'Jordan': 'Asia', 'Israel': 'Asia', 'Lebanon': 'Asia',
  'Oman': 'Asia', 'Qatar': 'Asia', 'Saudi Arabia': 'Asia',
  'South Korea': 'Asia', 'Taiwan': 'Asia', 'Singapore': 'Asia',
  'Malaysia': 'Asia', 'China': 'Asia', 'Mongolia': 'Asia',
  'Jamaica': 'Americas', 'Dominican Republic': 'Americas',
  'Bahamas': 'Americas', 'Belize': 'Americas', 'Guatemala': 'Americas',
  'Panama': 'Americas', 'Rwanda': 'Africa', 'Uganda': 'Africa',
  'Ethiopia': 'Africa', 'Ghana': 'Africa', 'Nigeria': 'Africa',
  'Madagascar': 'Africa', 'Botswana': 'Africa', 'Namibia': 'Africa',
  'Zambia': 'Africa', 'Zimbabwe': 'Africa', 'Mozambique': 'Africa',
};

export function getContinent(country: string): string {
  return COUNTRY_TO_CONTINENT[country] ?? 'Other';
}

interface SavedStatsBarProps {
  destinations: Destination[];
}

export function SavedStatsBar({ destinations }: SavedStatsBarProps) {
  if (destinations.length === 0) return null;

  const continents = new Set(destinations.map((d) => getContinent(d.country)));
  const avgPrice = Math.round(
    destinations.reduce((sum, d) => sum + (d.livePrice ?? d.flightPrice), 0) / destinations.length,
  );

  const stats = [
    { emoji: '📍', value: `${destinations.length} destination${destinations.length !== 1 ? 's' : ''}` },
    { emoji: '🌎', value: `${continents.size} continent${continents.size !== 1 ? 's' : ''}` },
    { emoji: '💰', value: `avg $${avgPrice}/trip` },
  ];

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: spacing['5'], paddingBottom: spacing['3'], flexWrap: 'wrap' }}>
        {stats.map((s, i) => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 6, paddingHorizontal: 12,
            borderRadius: 9999,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ fontSize: 13 }}>{s.emoji}</Text>
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text.secondary }}>{s.value}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: 12, padding: `0 ${spacing['5']}px ${spacing['3']}px`,
      flexWrap: 'wrap',
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px',
          borderRadius: radii.full,
          backgroundColor: colors.surfaceElevated,
          border: `1px solid ${colors.border}`,
        }}>
          <span style={{ fontSize: 13 }}>{s.emoji}</span>
          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text.secondary }}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}
