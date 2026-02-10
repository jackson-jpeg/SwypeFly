import { Share, Platform } from 'react-native';

export async function shareDestination(
  city: string,
  country: string,
  tagline: string,
): Promise<boolean> {
  const text = `Check out ${city}, ${country} on SoGoJet! ${tagline}`;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: city, text });
        return true;
      } catch {
        return false;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}
