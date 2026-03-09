import { colors, fonts } from '@/tokens';

interface RouteMapProps {
  originCode: string;
  destCode: string;
  airlineName?: string;
  duration?: string;
}

export default function RouteMap({ originCode, destCode, airlineName, duration }: RouteMapProps) {
  if (!originCode || !destCode) return null;

  // SVG layout constants
  const W = 360;
  const H = 120;
  const padX = 48;
  const dotY = 90;
  const arcPeakY = 28;
  const dotR = 5;

  const x1 = padX;
  const x2 = W - padX;
  const midX = (x1 + x2) / 2;

  // Quadratic bezier control point (above midpoint)
  const cpX = midX;
  const cpY = arcPeakY - 10;

  // Compute tangent angle at midpoint of quadratic bezier for plane rotation
  // At t=0.5: tangent = d/dt [B(t)] = 2(1-t)(P1-P0) + 2t(P2-P1)
  const tx = 0.5 * (cpX - x1) + 0.5 * (x2 - cpX); // simplifies to (x2 - x1) / 2
  const ty = 0.5 * (cpY - dotY) + 0.5 * (dotY - cpY); // simplifies to 0
  const angleDeg = Math.atan2(ty, tx) * (180 / Math.PI);

  const pathD = `M ${x1} ${dotY} Q ${cpX} ${cpY}, ${x2} ${dotY}`;

  const styleId = 'route-map-anim';

  return (
    <div style={{ width: '100%', padding: '8px 0' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block', overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`
          @keyframes ${styleId} {
            0% { offset-distance: 0%; opacity: 0; }
            5% { opacity: 1; }
            95% { opacity: 1; }
            100% { offset-distance: 100%; opacity: 0; }
          }
        `}</style>

        {/* Dashed arc path */}
        <path
          d={pathD}
          fill="none"
          stroke={colors.borderTint}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          strokeLinecap="round"
        />

        {/* Origin dot */}
        <circle cx={x1} cy={dotY} r={dotR} fill={colors.sageDrift} />

        {/* Destination dot */}
        <circle cx={x2} cy={dotY} r={dotR} fill={colors.sageDrift} />

        {/* Origin label */}
        <text
          x={x1}
          y={dotY + 16}
          textAnchor="middle"
          fontFamily={`"${fonts.body}", system-ui, sans-serif`}
          fontSize={13}
          fontWeight={700}
          fill={colors.deepDusk}
        >
          {originCode}
        </text>

        {/* Destination label */}
        <text
          x={x2}
          y={dotY + 16}
          textAnchor="middle"
          fontFamily={`"${fonts.body}", system-ui, sans-serif`}
          fontSize={13}
          fontWeight={700}
          fill={colors.deepDusk}
        >
          {destCode}
        </text>

        {/* Duration label at top center of arc */}
        {duration && (
          <text
            x={midX}
            y={arcPeakY - 6}
            textAnchor="middle"
            fontFamily={`"${fonts.body}", system-ui, sans-serif`}
            fontSize={11}
            fontWeight={600}
            fill={colors.mutedText}
          >
            {duration}
          </text>
        )}

        {/* Airline label below duration */}
        {airlineName && (
          <text
            x={midX}
            y={arcPeakY + (duration ? 8 : -6)}
            textAnchor="middle"
            fontFamily={`"${fonts.body}", system-ui, sans-serif`}
            fontSize={9}
            fontWeight={500}
            fill={colors.borderTint}
          >
            {airlineName}
          </text>
        )}

        {/* Animated airplane along the path */}
        <g
          style={{
            offsetPath: `path('${pathD}')`,
            offsetRotate: `${angleDeg}deg`,
            animation: `${styleId} 3s ease-in-out infinite`,
          }}
        >
          <text
            fontSize={16}
            textAnchor="middle"
            dominantBaseline="central"
            fill={colors.deepDusk}
          >
            ✈
          </text>
        </g>
      </svg>
    </div>
  );
}
