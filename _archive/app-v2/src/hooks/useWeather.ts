import { useQuery } from '@tanstack/react-query';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  description: string;
  icon: string;
}

// WMO weather code to description + emoji mapping
function weatherFromCode(code: number): { description: string; icon: string } {
  if (code === 0) return { description: 'Clear sky', icon: '\u2600\uFE0F' };
  if (code <= 3) return { description: 'Partly cloudy', icon: '\u26C5' };
  if (code <= 48) return { description: 'Foggy', icon: '\uD83C\uDF2B\uFE0F' };
  if (code <= 57) return { description: 'Drizzle', icon: '\uD83C\uDF26\uFE0F' };
  if (code <= 67) return { description: 'Rain', icon: '\uD83C\uDF27\uFE0F' };
  if (code <= 77) return { description: 'Snow', icon: '\u2744\uFE0F' };
  if (code <= 82) return { description: 'Rain showers', icon: '\uD83C\uDF27\uFE0F' };
  if (code <= 86) return { description: 'Snow showers', icon: '\uD83C\uDF28\uFE0F' };
  if (code <= 99) return { description: 'Thunderstorm', icon: '\u26C8\uFE0F' };
  return { description: 'Unknown', icon: '\uD83C\uDF24\uFE0F' };
}

export function useWeather(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['weather', lat, lng],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit`,
      );
      if (!res.ok) throw new Error('Weather fetch failed');
      const data = await res.json();
      const current = data.current;
      const { description, icon } = weatherFromCode(current.weather_code);
      return {
        temperature: Math.round(current.temperature_2m),
        weatherCode: current.weather_code,
        windSpeed: Math.round(current.wind_speed_10m),
        humidity: current.relative_humidity_2m,
        description,
        icon,
      } as WeatherData;
    },
    enabled: lat != null && lng != null,
    staleTime: 30 * 60 * 1000, // 30 min cache
  });
}
