const TRAVELPAYOUTS_MARKER = (process.env.TRAVELPAYOUTS_MARKER || '').trim();

/**
 * Generate an Aviasales affiliate search link for a flight route.
 * Format: https://www.aviasales.com/search/{origin}{DDMM}{destination}{DDMM}1?marker={MARKER}
 * Returns null if no marker is configured.
 */
export function generateAviasalesLink(
  origin: string,
  destination: string,
  departureDate?: string,
  returnDate?: string,
): string | null {
  if (!TRAVELPAYOUTS_MARKER) return null;

  const formatDDMM = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}${mm}`;
  };

  const depPart = departureDate ? formatDDMM(departureDate) : '';
  const retPart = returnDate ? formatDDMM(returnDate) : '';

  // Build search route: {origin}{DDMM}{destination}{DDMM}{passengers}
  const route = `${origin}${depPart}${destination}${retPart}1`;

  return `https://www.aviasales.com/search/${route}?marker=${TRAVELPAYOUTS_MARKER}`;
}
