const TRAVELPAYOUTS_MARKER = (
  process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER || ''
).trim();

/**
 * Generate an Aviasales affiliate search link for a flight route.
 * Uses EXPO_PUBLIC_TRAVELPAYOUTS_MARKER for client-side access.
 */
export function generateAviasalesLink(
  origin: string,
  destination: string,
  departureDate?: string,
  returnDate?: string,
): string {
  const formatDDMM = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}${mm}`;
  };

  const depPart = departureDate ? formatDDMM(departureDate) : '';
  const retPart = returnDate ? formatDDMM(returnDate) : '';
  const route = `${origin}${depPart}${destination}${retPart}1`;
  const marker = TRAVELPAYOUTS_MARKER || 'sogojet';

  return `https://www.aviasales.com/search/${route}?marker=${marker}`;
}
