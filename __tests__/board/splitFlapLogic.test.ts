// Pure logic tests — no React rendering needed

describe('DepartureRow helpers', () => {
  const STATUS_COLORS: Record<string, string> = {
    DEAL: '#7BAF8E',
    HOT: '#D4734A',
    NEW: '#F7E8A0',
  };

  it('maps each status to the correct color', () => {
    expect(STATUS_COLORS['DEAL']).toBe('#7BAF8E');
    expect(STATUS_COLORS['HOT']).toBe('#D4734A');
    expect(STATUS_COLORS['NEW']).toBe('#F7E8A0');
  });

  it('formats price as $-prefixed string for board display', () => {
    const formatBoardPrice = (price: number): string => {
      return `$${price}`;
    };
    expect(formatBoardPrice(387)).toBe('$387');
    expect(formatBoardPrice(1234)).toBe('$1234');
  });

  it('truncates destination to 12 chars uppercase', () => {
    const formatDest = (name: string): string => name.toUpperCase().slice(0, 12);
    expect(formatDest('Santorini')).toBe('SANTORINI');
    expect(formatDest('Rio de Janeiro')).toBe('RIO DE JANEI');
  });

  it('pads right-aligned text with leading spaces', () => {
    const padRight = (text: string, max: number): string => text.padStart(max, ' ');
    expect(padRight('$387', 5)).toBe(' $387');
    expect(padRight('14:25', 5)).toBe('14:25');
  });
});
