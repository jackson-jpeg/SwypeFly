import { useState, useRef, useEffect, useMemo } from 'react';
import { colors, fonts } from '@/tokens';
import type { Destination } from '@/api/types';

// ─── Coordinate lookup by IATA code ──────────────────────────────────
const COORDS: Record<string, { lat: number; lng: number }> = {
  DPS: { lat: -8.65, lng: 115.22 }, JTR: { lat: 36.42, lng: 25.43 },
  NRT: { lat: 35.68, lng: 139.69 }, CUZ: { lat: -13.53, lng: -71.97 },
  RAK: { lat: 31.63, lng: -7.98 }, KEF: { lat: 64.13, lng: -21.94 },
  NAP: { lat: 40.63, lng: 14.60 }, CPT: { lat: -33.92, lng: 18.42 },
  KIX: { lat: 35.01, lng: 135.77 }, DBV: { lat: 42.65, lng: 18.09 },
  MLE: { lat: 4.17, lng: 73.51 }, BCN: { lat: 41.39, lng: 2.17 },
  YYC: { lat: 51.18, lng: -115.57 }, LIS: { lat: 38.72, lng: -9.14 },
  ZQN: { lat: -45.03, lng: 168.66 }, DXB: { lat: 25.20, lng: 55.27 },
  EZE: { lat: -46.00, lng: -71.30 }, CNX: { lat: 18.79, lng: 98.98 },
  ZRH: { lat: 46.95, lng: 8.22 }, HAV: { lat: 23.11, lng: -82.37 },
  CUN: { lat: 21.16, lng: -86.85 }, PUJ: { lat: 18.56, lng: -68.37 },
  MBJ: { lat: 18.50, lng: -77.91 }, SJU: { lat: 18.47, lng: -66.12 },
  AUA: { lat: 12.51, lng: -69.97 }, NAS: { lat: 25.06, lng: -77.35 },
  CZM: { lat: 20.51, lng: -86.94 }, UVF: { lat: 13.91, lng: -60.97 },
  SJO: { lat: 9.93, lng: -84.08 }, BOG: { lat: 4.71, lng: -74.07 },
  MDE: { lat: 6.24, lng: -75.57 }, LIM: { lat: -12.05, lng: -77.04 },
  CTG: { lat: 10.39, lng: -75.51 }, PTY: { lat: 9.00, lng: -79.52 },
  LHR: { lat: 51.51, lng: -0.13 }, CDG: { lat: 48.86, lng: 2.35 },
  AMS: { lat: 52.37, lng: 4.90 }, FCO: { lat: 41.90, lng: 12.50 },
  DUB: { lat: 53.35, lng: -6.26 }, PRG: { lat: 50.08, lng: 14.44 },
  CPH: { lat: 55.68, lng: 12.57 }, TXL: { lat: 52.52, lng: 13.41 },
  BKK: { lat: 13.76, lng: 100.50 }, SIN: { lat: 1.35, lng: 103.82 },
  ICN: { lat: 37.57, lng: 126.98 }, HAN: { lat: 21.03, lng: 105.85 },
  HNL: { lat: 21.31, lng: -157.86 }, MSY: { lat: 29.95, lng: -90.07 },
  BNA: { lat: 36.16, lng: -86.78 }, JFK: { lat: 40.71, lng: -74.01 },
  AUS: { lat: 30.27, lng: -97.74 }, DEN: { lat: 39.74, lng: -104.99 },
  CHS: { lat: 32.78, lng: -79.93 }, SFO: { lat: 37.77, lng: -122.42 },
  LAS: { lat: 36.17, lng: -115.14 }, SEA: { lat: 47.61, lng: -122.33 },
  MIA: { lat: 25.76, lng: -80.19 }, PHX: { lat: 33.45, lng: -111.95 },
  SAV: { lat: 32.08, lng: -81.09 }, SAN: { lat: 32.72, lng: -117.16 },
  PDX: { lat: 45.51, lng: -122.68 }, ATL: { lat: 33.75, lng: -84.39 },
  BGI: { lat: 13.10, lng: -59.61 }, GCM: { lat: 19.29, lng: -81.37 },
  POS: { lat: 10.65, lng: -61.50 }, CUR: { lat: 12.17, lng: -68.98 },
  SXM: { lat: 18.04, lng: -63.11 }, REP: { lat: 13.37, lng: 103.84 },
  LPQ: { lat: 19.89, lng: 102.13 }, RGN: { lat: 16.87, lng: 96.20 },
  CEB: { lat: 10.31, lng: 123.89 }, DAD: { lat: 16.05, lng: 108.22 },
  KUL: { lat: 3.14, lng: 101.69 }, GIG: { lat: -22.91, lng: -43.17 },
  SCL: { lat: -33.45, lng: -70.67 }, UIO: { lat: -0.18, lng: -78.47 },
  MVD: { lat: -34.90, lng: -56.16 }, NBO: { lat: -1.29, lng: 36.82 },
  ZNZ: { lat: -6.16, lng: 39.19 }, CMN: { lat: 33.57, lng: -7.59 },
  ACC: { lat: 5.60, lng: -0.19 }, DOH: { lat: 25.29, lng: 51.53 },
  AMM: { lat: 31.95, lng: 35.93 }, TLV: { lat: 32.09, lng: 34.77 },
  VIE: { lat: 48.21, lng: 16.37 }, ATH: { lat: 37.98, lng: 23.73 },
  BUD: { lat: 47.50, lng: 19.04 }, WAW: { lat: 52.23, lng: 21.01 },
  EDI: { lat: 55.95, lng: -3.19 }, VCE: { lat: 45.44, lng: 12.34 },
  IST: { lat: 41.01, lng: 28.98 }, MXP: { lat: 45.46, lng: 9.19 },
  OPO: { lat: 41.15, lng: -8.61 }, SVQ: { lat: 37.39, lng: -5.98 },
  FLR: { lat: 43.77, lng: 11.25 }, SYD: { lat: -33.87, lng: 151.21 },
  MEL: { lat: -37.81, lng: 144.96 }, HKG: { lat: 22.32, lng: 114.17 },
  TPE: { lat: 25.03, lng: 121.57 }, DEL: { lat: 28.61, lng: 77.21 },
  OGG: { lat: 20.80, lng: -156.33 }, EYW: { lat: 24.56, lng: -81.80 },
  ABQ: { lat: 35.69, lng: -105.94 }, ASE: { lat: 39.19, lng: -106.82 },
  RNO: { lat: 39.10, lng: -120.04 }, AVL: { lat: 35.60, lng: -82.55 },
  ANC: { lat: 61.22, lng: -149.90 }, MVY: { lat: 41.39, lng: -70.61 },
  JAC: { lat: 43.48, lng: -110.76 }, CNY: { lat: 38.57, lng: -109.55 },
  FCA: { lat: 48.41, lng: -114.35 }, PLS: { lat: 21.77, lng: -72.17 },
  STT: { lat: 18.34, lng: -64.93 }, ANU: { lat: 17.12, lng: -61.85 },
  GND: { lat: 12.06, lng: -61.75 }, SKB: { lat: 17.30, lng: -62.72 },
  BON: { lat: 12.14, lng: -68.27 }, BDA: { lat: 32.30, lng: -64.79 },
  BZE: { lat: 17.50, lng: -88.20 }, RTB: { lat: 16.32, lng: -86.52 },
  GUA: { lat: 14.63, lng: -90.51 }, MGA: { lat: 11.93, lng: -85.96 },
  SAL: { lat: 13.69, lng: -89.19 }, TGU: { lat: 14.07, lng: -87.17 },
  LPB: { lat: -16.50, lng: -68.15 }, GRU: { lat: -23.55, lng: -46.63 },
  GPS: { lat: -0.74, lng: -90.31 }, FTE: { lat: -50.34, lng: -72.27 },
  MLA: { lat: 35.90, lng: 14.51 }, BRU: { lat: 50.85, lng: 4.35 },
  BGO: { lat: 60.39, lng: 5.32 }, SPU: { lat: 43.51, lng: 16.44 },
  TLL: { lat: 59.44, lng: 24.75 }, RIX: { lat: 56.95, lng: 24.11 },
  TBS: { lat: 41.72, lng: 44.79 }, DSS: { lat: 14.69, lng: -17.44 },
  LVI: { lat: -17.82, lng: 25.85 }, JRO: { lat: -3.37, lng: 37.34 },
  LOS: { lat: 6.52, lng: 3.38 }, ADD: { lat: 9.02, lng: 38.75 },
  MCT: { lat: 23.59, lng: 58.54 }, GOI: { lat: 15.50, lng: 73.83 },
  KTM: { lat: 27.72, lng: 85.32 }, CMB: { lat: 6.93, lng: 79.85 },
  NAN: { lat: -17.77, lng: 177.95 }, PPT: { lat: -17.54, lng: -149.57 },
  STS: { lat: 38.30, lng: -122.29 }, PSP: { lat: 33.83, lng: -116.55 },
  TEX: { lat: 37.94, lng: -107.81 }, OAJ: { lat: 35.91, lng: -75.60 },
  LIH: { lat: 22.09, lng: -159.34 }, KOA: { lat: 19.64, lng: -155.99 },
  BZN: { lat: 45.68, lng: -111.04 }, GRB: { lat: 45.03, lng: -87.14 },
  HHH: { lat: 32.22, lng: -80.75 }, VPS: { lat: 30.39, lng: -86.47 },
  RSW: { lat: 26.14, lng: -81.80 }, PIE: { lat: 27.97, lng: -82.77 },
  MYR: { lat: 33.69, lng: -78.89 }, BKG: { lat: 36.64, lng: -93.22 },
  TVC: { lat: 44.76, lng: -85.62 }, PVD: { lat: 41.82, lng: -71.41 },
  BGR: { lat: 44.39, lng: -68.20 }, ACK: { lat: 41.28, lng: -70.10 },
  AXA: { lat: 18.22, lng: -63.06 }, DOM: { lat: 15.30, lng: -61.39 },
  SBH: { lat: 17.90, lng: -62.85 }, FDF: { lat: 14.62, lng: -61.06 },
  PTP: { lat: 16.24, lng: -61.53 }, MNI: { lat: 16.74, lng: -62.19 },
  EIS: { lat: 18.43, lng: -64.62 }, TAB: { lat: 11.15, lng: -60.83 },
  CYB: { lat: 19.69, lng: -79.88 }, GOA: { lat: 44.31, lng: 9.71 },
  JMK: { lat: 37.45, lng: 25.33 }, NCE: { lat: 43.70, lng: 7.27 },
  PSA: { lat: 43.72, lng: 10.40 }, TIV: { lat: 42.43, lng: 18.72 },
  LJU: { lat: 46.05, lng: 14.51 }, SZG: { lat: 47.80, lng: 13.04 },
  AJA: { lat: 41.93, lng: 8.74 }, CAG: { lat: 39.22, lng: 9.12 },
  FNC: { lat: 32.65, lng: -16.91 }, PDL: { lat: 37.75, lng: -25.66 },
  VRN: { lat: 45.44, lng: 10.99 }, SXB: { lat: 48.58, lng: 7.75 },
  LGK: { lat: 6.33, lng: 99.73 }, PPS: { lat: 9.74, lng: 118.73 },
  LOP: { lat: -8.65, lng: 116.32 }, SOQ: { lat: -0.93, lng: 131.12 },
  USM: { lat: 9.51, lng: 100.06 }, PBH: { lat: 27.47, lng: 89.64 },
  OKA: { lat: 26.34, lng: 127.77 }, CJU: { lat: 33.51, lng: 126.53 },
  SEZ: { lat: -4.68, lng: 55.49 }, MRU: { lat: -20.16, lng: 57.50 },
  TNR: { lat: -18.91, lng: 47.54 }, LXR: { lat: 25.69, lng: 32.64 },
  FEZ: { lat: 34.03, lng: -5.00 }, AUH: { lat: 24.45, lng: 54.65 },
  BRC: { lat: -41.13, lng: -71.31 }, IGR: { lat: -25.60, lng: -54.57 },
  FEN: { lat: -3.85, lng: -32.43 }, MDZ: { lat: -32.89, lng: -68.83 },
  SRE: { lat: -20.46, lng: -66.99 },
};

function getCoords(dest: Destination): { lat: number; lng: number } | null {
  return COORDS[dest.iataCode] ?? null;
}

// Mercator projection: convert lat/lng to percentage x/y
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 100;
  // Clamp latitude for Mercator
  const clampedLat = Math.max(-80, Math.min(80, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = (1 - mercY / Math.PI) * 50;
  return { x, y };
}

interface MapViewProps {
  destinations: Destination[];
  onSelect: (dest: Destination) => void;
}

export default function MapView({ destinations, onSelect }: MapViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [appeared, setAppeared] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger staggered fade-in
    const timer = setTimeout(() => setAppeared(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const pins = useMemo(() => {
    return destinations
      .map((dest) => {
        const coords = getCoords(dest);
        if (!coords) return null;
        const { x, y } = project(coords.lat, coords.lng);
        return { dest, x, y };
      })
      .filter(Boolean) as { dest: Destination; x: number; y: number }[];
  }, [destinations]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: '#0D1117',
      }}
    >
      {/* Subtle grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(168, 196, 184, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 196, 184, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Continent hint shapes (simplified SVG) */}
      <svg
        viewBox="0 0 1000 500"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.06,
        }}
        preserveAspectRatio="none"
      >
        {/* North America */}
        <ellipse cx="220" cy="170" rx="110" ry="80" fill={colors.sageDrift} />
        {/* South America */}
        <ellipse cx="280" cy="330" rx="55" ry="100" fill={colors.sageDrift} />
        {/* Europe */}
        <ellipse cx="500" cy="140" rx="60" ry="50" fill={colors.sageDrift} />
        {/* Africa */}
        <ellipse cx="510" cy="280" rx="55" ry="90" fill={colors.sageDrift} />
        {/* Asia */}
        <ellipse cx="680" cy="170" rx="120" ry="80" fill={colors.sageDrift} />
        {/* Australia */}
        <ellipse cx="800" cy="350" rx="55" ry="40" fill={colors.sageDrift} />
      </svg>

      {/* Equator line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${colors.sageDrift}15, transparent)`,
        }}
      />

      {/* Destination pins */}
      {pins.map(({ dest, x, y }, i) => {
        const isHovered = hoveredId === dest.id;
        const isLive = dest.priceSource !== 'estimate';
        const price = dest.flightPrice;

        return (
          <div
            key={dest.id}
            onMouseEnter={() => setHoveredId(dest.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelect(dest)}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              zIndex: isHovered ? 100 : 10,
              opacity: appeared ? 1 : 0,
              transition: `opacity 0.5s ease ${i * 20}ms, transform 0.2s ease`,
            }}
          >
            {/* Pin dot */}
            <div
              style={{
                width: isHovered ? 14 : 10,
                height: isHovered ? 14 : 10,
                borderRadius: '50%',
                backgroundColor: isLive ? colors.sageDrift : colors.borderTint,
                border: `2px solid ${isHovered ? '#FFFFFF' : isLive ? colors.darkerGreen : colors.mutedText}`,
                boxShadow: isHovered
                  ? `0 0 16px ${colors.sageDrift}80, 0 0 4px ${colors.sageDrift}`
                  : isLive
                    ? `0 0 8px ${colors.sageDrift}40`
                    : 'none',
                transition: 'all 0.2s ease',
                animation: isLive && !isHovered ? 'mapPulse 3s ease-in-out infinite' : 'none',
              }}
            />

            {/* Price label (always visible) */}
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 2,
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 8,
                fontWeight: 700,
                color: isHovered ? '#FFFFFF' : '#FFFFFF80',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                transition: 'color 0.2s ease',
                letterSpacing: '0.02em',
              }}
            >
              ${price}
            </div>

            {/* Hover tooltip card */}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 10,
                  width: 200,
                  borderRadius: 12,
                  overflow: 'hidden',
                  backgroundColor: colors.deepDusk,
                  border: `1px solid ${colors.borderTint}30`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
                  animation: 'tooltipIn 0.2s ease',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: '100%',
                    height: 80,
                    backgroundImage: `url(${dest.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                {/* Info */}
                <div style={{ padding: '8px 10px' }}>
                  <div
                    style={{
                      fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                      fontWeight: 800,
                      fontSize: 13,
                      lineHeight: '16px',
                      letterSpacing: '-0.01em',
                      textTransform: 'uppercase',
                      color: '#FFFFFF',
                    }}
                  >
                    {dest.city}
                  </div>
                  <div
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 10,
                      color: '#FFFFFF70',
                      marginTop: 2,
                    }}
                  >
                    {dest.country}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 15,
                        fontWeight: 700,
                        color: colors.sunriseButter,
                      }}
                    >
                      ${price}
                    </span>
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: isLive ? colors.confirmGreen : '#FFFFFF60',
                      }}
                    >
                      {isLive ? 'LIVE' : 'EST.'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* CSS animations */}
      <style>{`
        @keyframes mapPulse {
          0%, 100% { box-shadow: 0 0 4px ${colors.sageDrift}30; }
          50% { box-shadow: 0 0 12px ${colors.sageDrift}60; }
        }
        @keyframes tooltipIn {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
