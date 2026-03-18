import { parseDuration } from '../utils/duration';

describe('parseDuration', () => {
  it('parses hours and minutes', () => {
    expect(parseDuration('PT7H10M')).toBe('7h 10m');
  });

  it('parses days, hours, minutes', () => {
    expect(parseDuration('P1DT8H20M')).toBe('1d 8h 20m');
  });

  it('parses hours only', () => {
    expect(parseDuration('PT14H')).toBe('14h 0m');
  });

  it('parses minutes only', () => {
    expect(parseDuration('PT45M')).toBe('0h 45m');
  });

  it('returns empty string for invalid input', () => {
    expect(parseDuration('')).toBe('');
    expect(parseDuration('invalid')).toBe('');
  });

  it('handles null/undefined', () => {
    expect(parseDuration(null as any)).toBe('');
    expect(parseDuration(undefined as any)).toBe('');
  });
});
