import { useEffect, useState } from 'react';
import { colors, fonts } from '@/tokens';
import { API_BASE } from '@/api/client';

interface MonthEntry {
  month: string;
  price: number;
  airline: string;
  transferCount: number;
}

interface MonthlyData {
  months: MonthEntry[];
  cheapestMonth: string | null;
  cheapestPrice: number | null;
}

interface Props {
  origin: string;
  destination: string;
  onMonthSelect?: (month: string) => void;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyPriceBar({ origin, destination, onMonthSelect }: Props) {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/destination?action=monthly&origin=${origin}&destination=${destination}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json as MonthlyData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [origin, destination]);

  if (loading) {
    return (
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          Cheapest Month
        </span>
        <div
          style={{
            height: 180,
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
            Loading monthly prices...
          </span>
        </div>
      </div>
    );
  }

  if (!data?.months?.length) {
    return (
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          Cheapest Month
        </span>
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 12,
            color: colors.borderTint,
          }}
        >
          No monthly price data available
        </div>
      </div>
    );
  }

  const prices = data.months.map((m) => m.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);

  const getBarColor = (price: number) => {
    if (price === minPrice) return colors.darkerGreen;
    if (price === maxPrice) return `${colors.terracotta}60`;
    return colors.sageDrift;
  };

  const getMonthLabel = (monthStr: string) => {
    const monthIndex = parseInt(monthStr.split('-')[1], 10) - 1;
    return MONTH_LABELS[monthIndex] ?? monthStr;
  };

  return (
    <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        Cheapest Month
      </span>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          height: 180,
          justifyContent: 'space-between',
        }}
      >
        {data.months.map((entry) => {
          const barWidth = maxPrice > 0 ? Math.max((entry.price / maxPrice) * 100, 8) : 8;
          const isCheapest = entry.month === data.cheapestMonth;

          return (
            <button
              key={entry.month}
              onClick={() => onMonthSelect?.(entry.month)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: 0,
                background: 'none',
                border: 'none',
              }}
            >
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 10,
                  fontWeight: isCheapest ? 700 : 500,
                  color: isCheapest ? colors.darkerGreen : colors.mutedText,
                  width: 28,
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {getMonthLabel(entry.month)}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '100%',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    minHeight: 10,
                    borderRadius: 4,
                    backgroundColor: getBarColor(entry.price),
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 10,
                  fontWeight: isCheapest ? 700 : 500,
                  color: isCheapest ? colors.darkerGreen : colors.bodyText,
                  width: 40,
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                ${entry.price}
              </span>
            </button>
          );
        })}
      </div>

      {data.cheapestMonth && data.cheapestPrice != null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 10,
            backgroundColor: `${colors.darkerGreen}12`,
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              color: colors.darkerGreen,
              fontWeight: 500,
            }}
          >
            Cheapest:{' '}
            {new Date(data.cheapestMonth + '-01T00:00:00').toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}{' '}
            at ${data.cheapestPrice}
          </span>
        </div>
      )}
    </div>
  );
}
