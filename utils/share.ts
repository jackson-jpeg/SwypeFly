import { Share, Platform } from 'react-native';

const APP_URL = 'https://sogojet.com';

export async function shareDestination(
  city: string,
  country: string,
  tagline: string,
  destinationId?: string,
  price?: number,
  _currency?: string,
): Promise<boolean> {
  const priceStr = price ? ` from $${Math.round(price)} roundtrip` : '';
  const url = destinationId ? `${APP_URL}/destination/${destinationId}` : APP_URL;
  const text = `${city}, ${country}${priceStr} — ${tagline}`;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${city} on SoGoJet`, text, url });
        return true;
      } catch {
        return false;
      }
    }
    // Fallback: copy text + URL to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return true;
    }
    return false;
  }

  try {
    await Share.share({ message: `${text}\n${url}` });
    return true;
  } catch {
    return false;
  }
}
