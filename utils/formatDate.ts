const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format departure/return dates as "May 15 – May 22"
 * Omits year. If same month, collapses to "May 15 – 22".
 */
export function formatTripDates(departure: string, returnDate: string): string {
  const dep = new Date(departure);
  const ret = new Date(returnDate);

  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return '';

  const depMonth = MONTH_SHORT[dep.getMonth()];
  const retMonth = MONTH_SHORT[ret.getMonth()];
  const depDay = dep.getDate();
  const retDay = ret.getDate();

  if (depMonth === retMonth) {
    return `${depMonth} ${depDay} – ${retDay}`;
  }
  return `${depMonth} ${depDay} – ${retMonth} ${retDay}`;
}

/**
 * Format a date as relative time from now: "In 3 weeks", "In 5 days", "Tomorrow"
 */
export function formatDaysFromNow(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 14) return 'In 1 week';

  const weeks = Math.round(diffDays / 7);
  if (diffDays < 60) return `In ${weeks} weeks`;

  const months = Math.round(diffDays / 30);
  return months === 1 ? 'In 1 month' : `In ${months} months`;
}
