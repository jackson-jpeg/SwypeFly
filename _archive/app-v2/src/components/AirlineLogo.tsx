import { useState } from 'react';
import { colors, fonts } from '@/tokens';

interface AirlineLogoProps {
  code: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Renders an airline logo from the avs.io CDN.
 * Falls back to a styled 2-letter code in a rounded rectangle.
 *
 * @param code  2-letter IATA airline code (e.g. "AA", "DL")
 * @param size  Display size in px (default 24). Image fetched at 2x for retina.
 */
export default function AirlineLogo({ code, size = 24, style }: AirlineLogoProps) {
  const [failed, setFailed] = useState(false);
  const displayCode = code.slice(0, 2).toUpperCase();
  const retinaSize = size * 2;

  if (failed || !code || code.length < 2) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          backgroundColor: '#FFFFFF14',
          border: '1px solid #FFFFFF1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...style,
        }}
      >
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: Math.max(8, size * 0.4),
            fontWeight: 700,
            lineHeight: 1,
            color: colors.mutedText,
          }}
        >
          {displayCode}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://pics.avs.io/${retinaSize}/${retinaSize}/${displayCode}.png`}
      alt={`${displayCode} logo`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        borderRadius: 4,
        flexShrink: 0,
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}
