import { generateAviasalesLink } from '../../utils/affiliateLinks';

describe('generateAviasalesLink', () => {
  it('generates a basic link with origin and destination only', () => {
    const link = generateAviasalesLink('JFK', 'BCN');
    expect(link).toBe('https://www.aviasales.com/search/JFKBCN1?marker=sogojet');
  });

  it('includes formatted departure date', () => {
    const link = generateAviasalesLink('JFK', 'BCN', '2026-07-15');
    expect(link).toBe('https://www.aviasales.com/search/JFK1507BCN1?marker=sogojet');
  });

  it('includes both departure and return dates', () => {
    const link = generateAviasalesLink('JFK', 'BCN', '2026-07-15', '2026-07-22');
    expect(link).toBe('https://www.aviasales.com/search/JFK1507BCN22071?marker=sogojet');
  });

  it('handles departure date with no return date', () => {
    const link = generateAviasalesLink('TPA', 'LHR', '2026-12-25');
    expect(link).toBe('https://www.aviasales.com/search/TPA2512LHR1?marker=sogojet');
  });

  it('handles invalid departure date gracefully', () => {
    const link = generateAviasalesLink('JFK', 'BCN', 'not-a-date');
    // Invalid date → formatDDMM returns '', so no date part
    expect(link).toBe('https://www.aviasales.com/search/JFKBCN1?marker=sogojet');
  });

  it('handles invalid return date gracefully', () => {
    const link = generateAviasalesLink('JFK', 'BCN', '2026-07-15', 'bad-date');
    expect(link).toBe('https://www.aviasales.com/search/JFK1507BCN1?marker=sogojet');
  });

  it('uses sogojet as default marker when env var is empty', () => {
    const link = generateAviasalesLink('LAX', 'NRT');
    expect(link).toContain('marker=sogojet');
  });

  it('formats single-digit days and months with leading zeros', () => {
    const link = generateAviasalesLink('JFK', 'CDG', '2026-01-05');
    expect(link).toBe('https://www.aviasales.com/search/JFK0501CDG1?marker=sogojet');
  });

  it('handles empty string dates same as undefined', () => {
    const link = generateAviasalesLink('JFK', 'CDG', '', '');
    expect(link).toBe('https://www.aviasales.com/search/JFKCDG1?marker=sogojet');
  });
});
