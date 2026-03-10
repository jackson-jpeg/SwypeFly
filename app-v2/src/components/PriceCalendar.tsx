import { useEffect, useState } from 'react';
import { colors, fonts } from '@/tokens';
import { API_BASE } from '@/api/client';

interface CalendarEntry {
  date: string;
  price: number;
  airline: string;
  transferCount: number;
}

interface CalendarData {
  calendar: CalendarEntry[];
  cheapestDate: string | null;
  cheapestPrice: number | null;
}

interface Props {
  origin: string;
  destination: string;
  onSelectDate?: (date: string, price: number) => void;
}

export default function PriceCalendar({ origin, destination, onSelectDate }: Props) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getMonthStr = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const monthStr = getMonthStr(monthOffset);
  const monthLabel = new Date(monthStr + '-01T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(
      `${API_BASE}/api/destination?action=calendar&origin=${origin}&destination=${destination}&month=${monthStr}`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json as CalendarData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [origin, destination, monthStr]);

  const handleDateClick = (entry: CalendarEntry) => {
    setSelectedDate(entry.date);
    onSelectDate?.(entry.date, entry.price);
  };

  // Price color coding
  const getPriceColor = (price: number, entries: CalendarEntry[]) => {
    if (entries.length < 2) return colors.sageDrift;
    const sorted = [...entries].map((e) => e.price).sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.2)];
    const q3 = sorted[Math.floor(sorted.length * 0.8)];
    if (price <= q1) return colors.darkerGreen;
    if (price >= q3) return colors.terracotta;
    return colors.sageDrift;
  };

  // Build calendar grid
  const buildGrid = () => {
    if (!data?.calendar?.length) return null;

    const priceMap = new Map(data.calendar.map((e) => [e.date, e]));
    const firstDate = new Date(monthStr + '-01T00:00:00');
    const startDay = firstDate.getDay(); // 0=Sun
    const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);

    const cells: (CalendarEntry & { day: number } | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      const entry = priceMap.get(dateStr);
      cells.push(entry ? { ...entry, day } : { date: dateStr, price: 0, airline: '', transferCount: 0, day });
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 10,
              fontWeight: 600,
              color: colors.borderTint,
              padding: '4px 0',
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const isPast = cell.date < today;
          const isSelected = cell.date === selectedDate;
          const isCheapest = cell.date === data.cheapestDate;
          const hasPrice = cell.price > 0;

          return (
            <button
              key={cell.date}
              onClick={() => hasPrice && !isPast && handleDateClick(cell)}
              disabled={isPast || !hasPrice}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 2px',
                borderRadius: 8,
                border: isSelected ? `2px solid ${colors.deepDusk}` : isCheapest ? `2px solid ${colors.darkerGreen}` : '2px solid transparent',
                backgroundColor: isSelected ? `${colors.deepDusk}10` : 'transparent',
                opacity: isPast ? 0.35 : 1,
                cursor: hasPrice && !isPast ? 'pointer' : 'default',
                minHeight: 44,
              }}
            >
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 12,
                  fontWeight: 500,
                  color: colors.deepDusk,
                }}
              >
                {cell.day}
              </span>
              {hasPrice && (
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 9,
                    fontWeight: 700,
                    color: getPriceColor(cell.price, data.calendar),
                  }}
                >
                  ${cell.price}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: colors.sageDrift,
          }}
        >
          Price Calendar
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setMonthOffset((p) => Math.max(0, p - 1))}
            disabled={monthOffset === 0}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid ${colors.borderTint}`,
              backgroundColor: 'transparent',
              cursor: monthOffset === 0 ? 'default' : 'pointer',
              opacity: monthOffset === 0 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: colors.deepDusk,
            }}
          >
            ‹
          </button>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              fontWeight: 600,
              color: colors.deepDusk,
              minWidth: 100,
              textAlign: 'center',
            }}
          >
            {monthLabel}
          </span>
          <button
            onClick={() => setMonthOffset((p) => Math.min(5, p + 1))}
            disabled={monthOffset >= 5}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid ${colors.borderTint}`,
              backgroundColor: 'transparent',
              cursor: monthOffset >= 5 ? 'default' : 'pointer',
              opacity: monthOffset >= 5 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: colors.deepDusk,
            }}
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            height: 200,
            borderRadius: 12,
            backgroundColor: `${colors.borderTint}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              color: colors.borderTint,
            }}
          >
            Loading prices...
          </span>
        </div>
      ) : data?.calendar?.length ? (
        <>
          {buildGrid()}
          {data.cheapestDate && data.cheapestPrice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                backgroundColor: `${colors.darkerGreen}12`,
              }}
            >
              <span style={{ fontSize: 14 }}>💡</span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 12,
                  color: colors.darkerGreen,
                  fontWeight: 500,
                }}
              >
                Cheapest: {new Date(data.cheapestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${data.cheapestPrice}
              </span>
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 12,
            color: colors.borderTint,
          }}
        >
          No price data available for this month
        </div>
      )}
    </div>
  );
}
