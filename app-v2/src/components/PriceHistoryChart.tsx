import { useEffect, useState, useCallback } from 'react';
import { colors, fonts } from '@/tokens';
import { API_BASE } from '@/api/client';

interface HistoryPoint {
  date: string;
  price: number;
  source: string;
  airline: string;
}

interface PriceHistoryData {
  history: HistoryPoint[];
  currentPrice: number | null;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  trend: 'up' | 'down' | 'stable';
}

interface Props {
  origin: string;
  destination: string;
}

const CHART_HEIGHT = 120;
const CHART_PADDING = { top: 12, right: 12, bottom: 24, left: 12 };

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PriceHistoryChart({ origin, destination }: Props) {
  const [data, setData] = useState<PriceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: HistoryPoint } | null>(null);
  const [svgWidth, setSvgWidth] = useState(300);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSvgWidth(entry.contentRect.width);
      }
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(
      `${API_BASE}/api/destination?action=price-history&origin=${origin}&destination=${destination}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json as PriceHistoryData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [origin, destination]);

  // Trend color
  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'down') return colors.sageDrift;
    if (trend === 'up') return colors.terracotta;
    return colors.bodyText;
  };

  const getTrendLabel = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'down') return 'Trending down';
    if (trend === 'up') return 'Trending up';
    return 'Stable';
  };

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ padding: '0 24px' }}>
        <div
          style={{
            height: CHART_HEIGHT,
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
            Loading price history...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  // Not enough data
  if (data.history.length < 3) {
    return (
      <div style={{ padding: '0 24px' }}>
        <div
          style={{
            padding: '16px 0',
            textAlign: 'center',
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 12,
            color: colors.borderTint,
          }}
        >
          Not enough price data to show history
        </div>
      </div>
    );
  }

  const trendColor = getTrendColor(data.trend);
  const points = data.history.filter((p) => p.price > 0);
  const prices = points.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const priceRange = maxP - minP || 1;

  // Chart dimensions
  const plotWidth = svgWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  // Map data to SVG coordinates
  const coords = points.map((p, i) => ({
    x: CHART_PADDING.left + (points.length > 1 ? (i / (points.length - 1)) * plotWidth : plotWidth / 2),
    y: CHART_PADDING.top + plotHeight - ((p.price - minP) / priceRange) * plotHeight,
    point: p,
  }));

  // Build SVG path
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  // Area path (fill under line)
  const areaPath =
    linePath +
    ` L${coords[coords.length - 1].x.toFixed(1)},${(CHART_PADDING.top + plotHeight).toFixed(1)}` +
    ` L${coords[0].x.toFixed(1)},${(CHART_PADDING.top + plotHeight).toFixed(1)} Z`;

  // X-axis labels: first, middle, last
  const xLabels = [
    { x: coords[0].x, label: formatShortDate(points[0].date) },
    { x: coords[Math.floor(coords.length / 2)].x, label: formatShortDate(points[Math.floor(points.length / 2)].date) },
    { x: coords[coords.length - 1].x, label: formatShortDate(points[points.length - 1].date) },
  ];

  const gradientId = `ph-gradient-${origin}-${destination}`;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find closest point
    let closest = coords[0];
    let closestDist = Infinity;
    for (const c of coords) {
      const dist = Math.abs(c.x - mouseX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = c;
      }
    }

    if (closestDist < 30) {
      setTooltip((prev) =>
        prev && prev.point.date === closest.point.date ? null : { x: closest.x, y: closest.y, point: closest.point },
      );
    } else {
      setTooltip(null);
    }
  };

  return (
    <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: colors.sageDrift,
          }}
        >
          Price History
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 11,
            fontWeight: 600,
            color: trendColor,
          }}
        >
          {getTrendLabel(data.trend)}
        </span>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: 12,
          backgroundColor: `${colors.borderTint}08`,
          overflow: 'hidden',
        }}
      >
        <svg
          width={svgWidth}
          height={CHART_HEIGHT}
          onClick={handleSvgClick}
          style={{ display: 'block', cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line */}
          <path d={linePath} fill="none" stroke={trendColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={tooltip?.point.date === c.point.date ? 5 : 2.5}
              fill={trendColor}
              stroke={colors.offWhite}
              strokeWidth={tooltip?.point.date === c.point.date ? 2 : 0}
            />
          ))}

          {/* X-axis labels */}
          {xLabels.map((label, i) => (
            <text
              key={i}
              x={label.x}
              y={CHART_HEIGHT - 4}
              textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 9,
                fill: colors.mutedText,
              }}
            >
              {label.label}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(Math.max(tooltip.x - 50, 4), svgWidth - 104),
              top: Math.max(tooltip.y - 48, 4),
              width: 100,
              padding: '6px 8px',
              borderRadius: 8,
              backgroundColor: colors.deepDusk,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 13,
                fontWeight: 700,
                color: colors.paleHorizon,
              }}
            >
              ${tooltip.point.price}
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 9,
                color: colors.warmDusk,
              }}
            >
              {formatShortDate(tooltip.point.date)}
              {tooltip.point.airline ? ` · ${tooltip.point.airline}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Min / Avg / Max labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {data.minPrice != null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: colors.mutedText,
              }}
            >
              Low
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                fontWeight: 700,
                color: colors.darkerGreen,
              }}
            >
              ${data.minPrice}
            </span>
          </div>
        )}
        {data.avgPrice != null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: colors.mutedText,
              }}
            >
              Avg
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                fontWeight: 700,
                color: colors.bodyText,
              }}
            >
              ${data.avgPrice}
            </span>
          </div>
        )}
        {data.maxPrice != null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: colors.mutedText,
              }}
            >
              High
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                fontWeight: 700,
                color: colors.terracotta,
              }}
            >
              ${data.maxPrice}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
