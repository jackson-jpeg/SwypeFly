import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';

interface WeatherWidgetProps {
  city: string;
  country: string;
  averageTemp: number;
}

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
}

const WEATHER_ICONS: Record<string, string> = {
  'clear sky': '☀️', 'few clouds': '🌤️', 'scattered clouds': '⛅',
  'broken clouds': '☁️', 'overcast clouds': '☁️',
  'shower rain': '🌧️', 'rain': '🌧️', 'light rain': '🌦️',
  'thunderstorm': '⛈️', 'snow': '🌨️', 'mist': '🌫️',
};

export function WeatherWidget({ city, country, averageTemp }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Use wttr.in free API (no key needed)
    fetch(`https://wttr.in/${encodeURIComponent(city)},${encodeURIComponent(country)}?format=j1`, {
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.json())
      .then(data => {
        const current = data?.current_condition?.[0];
        if (current) {
          setWeather({
            temp: Math.round(Number(current.temp_C)),
            description: current.weatherDesc?.[0]?.value?.toLowerCase() || '',
            icon: '',
          });
        }
      })
      .catch(() => {}); // Silent fail
  }, [city, country]);

  if (Platform.OS !== 'web') return null;

  const displayTemp = weather?.temp ?? averageTemp;
  const desc = weather?.description || 'average conditions';
  const icon = Object.entries(WEATHER_ICONS).find(([k]) => desc.includes(k))?.[1] || '🌡️';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: `${spacing['3']}px ${spacing['4']}px`,
      backgroundColor: colors.paleHorizon,
      borderRadius: radii.lg,
      border: `1px solid ${colors.divider}`,
      marginTop: spacing['3'],
    }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div>
        <div style={{ color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
          {displayTemp}°C / {Math.round(displayTemp * 9/5 + 32)}°F
        </div>
        <div style={{ color: colors.text.muted, fontSize: fontSize.sm, textTransform: 'capitalize' }}>
          {weather ? `Currently: ${desc}` : `Average temperature`}
        </div>
      </div>
    </div>
  );
}
