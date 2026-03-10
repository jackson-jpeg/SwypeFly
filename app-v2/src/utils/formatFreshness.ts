/**
 * Formats a price timestamp into a human-readable freshness label.
 * Returns null if the date is invalid or older than 7 days.
 */
export function formatFreshness(isoDate: string): string | null {
  const then = new Date(isoDate);
  if (isNaN(then.getTime())) return null;

  const now = Date.now();
  const diffMs = now - then.getTime();
  if (diffMs < 0) return null;

  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 6) return `${diffDays}d ago`;

  return null; // 7d+ — don't show
}
