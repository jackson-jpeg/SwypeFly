import { View, Platform } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { colors } from '../../theme/tokens';

interface PriceSparklineProps {
  prices: number[];
  currentPrice: number;
  width?: number;
  height?: number;
}

/**
 * Tiny sparkline showing price history with current price highlighted.
 * Shows a polyline of past prices + a dot for the current price.
 * Green when current price is below median, yellow at median, orange above.
 */
export default function PriceSparkline({
  prices,
  currentPrice,
  width = 64,
  height = 22,
}: PriceSparklineProps) {
  if (prices.length < 3) return null;

  const allPrices = [...prices, currentPrice];
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;

  const padX = 2;
  const padY = 3;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  // Map prices to SVG coordinates (inverted Y — lower price = higher on chart)
  const points = prices.map((p, i) => {
    const x = padX + (i / (prices.length - 1)) * plotW;
    const y = padY + (1 - (p - min) / range) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Current price dot position (rightmost)
  const dotX = width - padX;
  const dotY = padY + (1 - (currentPrice - min) / range) * plotH;

  // Median line
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const medianY = padY + (1 - (median - min) / range) * plotH;

  // Color based on current vs median
  const lineColor = currentPrice < median * 0.9
    ? colors.dealAmazing
    : currentPrice < median
      ? colors.green
      : currentPrice < median * 1.1
        ? colors.yellow
        : '#E85D4A';

  // Web fallback — inline SVG string (react-native-svg doesn't render on web)
  if (Platform.OS === 'web') {
    const svgStr = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padX}" y1="${medianY.toFixed(1)}" x2="${width - padX}" y2="${medianY.toFixed(1)}" stroke="${colors.muted}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
      <circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="2.5" fill="${lineColor}"/>
    </svg>`;

    return (
      <View style={{ width, height }}>
        <div
          style={{ width, height }}
          dangerouslySetInnerHTML={{ __html: svgStr }}
        />
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Median reference line */}
        <Line
          x1={padX}
          y1={medianY}
          x2={width - padX}
          y2={medianY}
          stroke={colors.muted}
          strokeWidth={0.5}
          strokeDasharray="2,2"
          opacity={0.4}
        />
        {/* Price trend line */}
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
        {/* Current price dot */}
        <Circle cx={dotX} cy={dotY} r={2.5} fill={lineColor} />
      </Svg>
    </View>
  );
}
