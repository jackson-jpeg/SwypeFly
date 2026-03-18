/**
 * Parse ISO 8601 duration (e.g., PT7H10M, P1DT8H20M) into human-readable string.
 * Returns "" for invalid input.
 */
export function parseDuration(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return '';

  const days = match[1] ? parseInt(match[1], 10) : 0;
  const hours = match[2] ? parseInt(match[2], 10) : 0;
  const minutes = match[3] ? parseInt(match[3], 10) : 0;

  if (days === 0 && hours === 0 && minutes === 0) return '';

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h ${minutes}m`);
  return parts.join(' ');
}
