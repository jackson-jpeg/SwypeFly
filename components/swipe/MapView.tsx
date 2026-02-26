import React, { useState, useMemo, useRef } from 'react';
import { router } from 'expo-router';
import { colors } from '../../constants/theme';
import type { Destination } from '../../types/destination';

// Extended city coords — lat/lng to normalized 0-1 on equirectangular projection
function latLngToXY(lat: number, lng: number): [number, number] {
  const x = (lng + 180) / 360;
  // Mercator-ish Y with clamp
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = 0.5 - mercN / (2 * Math.PI);
  return [Math.max(0, Math.min(1, x)), Math.max(0.05, Math.min(0.95, y))];
}

// Known city coordinates (lat, lng)
const CITY_LATLNG: Record<string, [number, number]> = {
  'Paris': [48.86, 2.35], 'London': [51.51, -0.13], 'Tokyo': [35.68, 139.69],
  'Bangkok': [13.76, 100.50], 'Rome': [41.90, 12.50], 'Barcelona': [41.39, 2.17],
  'Bali': [-8.34, 115.09], 'Dubai': [25.20, 55.27], 'New York': [40.71, -74.01],
  'Sydney': [-33.87, 151.21], 'Istanbul': [41.01, 28.98], 'Lisbon': [38.72, -9.14],
  'Mexico City': [19.43, -99.13], 'Buenos Aires': [-34.60, -58.38], 'Cairo': [30.04, 31.24],
  'Marrakech': [31.63, -8.01], 'Cape Town': [-33.93, 18.42], 'Seoul': [37.57, 126.98],
  'Singapore': [1.35, 103.82], 'Amsterdam': [52.37, 4.90], 'Prague': [50.08, 14.44],
  'Cancún': [21.16, -86.85], 'Rio de Janeiro': [-22.91, -43.17], 'Reykjavik': [64.15, -21.94],
  'Athens': [37.98, 23.73], 'Havana': [23.11, -82.37], 'Lima': [-12.05, -77.04],
  'Nairobi': [-1.29, 36.82], 'Mumbai': [19.08, 72.88], 'Hanoi': [21.03, 105.85],
  'Kuala Lumpur': [3.14, 101.69], 'Ho Chi Minh City': [10.82, 106.63],
  'Jakarta': [-6.21, 106.85], 'Bogotá': [4.71, -74.07], 'Santiago': [-33.45, -70.67],
  'Medellín': [6.25, -75.56], 'Cartagena': [10.39, -75.51], 'São Paulo': [-23.55, -46.63],
  'Berlin': [52.52, 13.41], 'Vienna': [48.21, 16.37], 'Budapest': [47.50, 19.04],
  'Dublin': [53.35, -6.26], 'Edinburgh': [55.95, -3.19], 'Zurich': [47.38, 8.54],
  'Copenhagen': [55.68, 12.57], 'Stockholm': [59.33, 18.07], 'Oslo': [59.91, 10.75],
  'Helsinki': [60.17, 24.94], 'Osaka': [34.69, 135.50], 'Kyoto': [35.01, 135.77],
  'Taipei': [25.03, 121.57], 'Hong Kong': [22.32, 114.17], 'Manila': [14.60, 120.98],
  'Queenstown': [-45.03, 168.66], 'Auckland': [-36.85, 174.76], 'Fiji': [-17.78, 177.96],
  'Phuket': [7.88, 98.39], 'Chiang Mai': [18.79, 98.98], 'Petra': [30.33, 35.44],
  'Santorini': [36.39, 25.46], 'Dubrovnik': [42.65, 18.09], 'Amalfi': [40.63, 14.60],
  'Maldives': [3.20, 73.22], 'Zanzibar': [-6.16, 39.19], 'Cusco': [-13.53, -71.97],
  'Machu Picchu': [-13.16, -72.55], 'Patagonia': [-50.34, -72.26],
};

interface MapViewProps {
  destinations: Destination[];
  onClose: () => void;
}

export function MapView({ destinations, onClose }: MapViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const pins = useMemo(() => {
    return destinations.map(d => {
      const coords = CITY_LATLNG[d.city];
      if (!coords) return null;
      const [x, y] = latLngToXY(coords[0], coords[1]);
      return { dest: d, x, y };
    }).filter(Boolean) as { dest: Destination; x: number; y: number }[];
  }, [destinations]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  const handleMouseUp = () => { isDragging.current = false; };

  const hovered = hoveredId ? destinations.find(d => d.id === hoveredId) : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      backgroundColor: '#070E1B',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
          🗺️ Map View · <span style={{ color: colors.primary }}>{pins.length}</span> destinations
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={zoomBtnStyle}>−</button>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, width: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} style={zoomBtnStyle}>+</button>
          <button onClick={onClose} style={{
            ...zoomBtnStyle, marginLeft: 12, fontSize: 16, width: 36, height: 36,
          }}>✕</button>
        </div>
      </div>

      {/* Map area */}
      <div
        style={{ flex: 1, overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'grab', position: 'relative' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{
          width: '100%', height: '100%', position: 'relative',
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: 'center center',
          transition: isDragging.current ? 'none' : 'transform 0.1s',
        }}>
          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map(v => (
            <React.Fragment key={v}>
              <div style={{ position: 'absolute', top: `${v * 100}%`, left: 0, right: 0, height: 1, backgroundColor: 'rgba(56,189,248,0.04)' }} />
              <div style={{ position: 'absolute', left: `${v * 100}%`, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(56,189,248,0.04)' }} />
            </React.Fragment>
          ))}

          {/* Region labels */}
          {[
            { label: 'North America', x: 20, y: 30 },
            { label: 'South America', x: 28, y: 60 },
            { label: 'Europe', x: 50, y: 22 },
            { label: 'Africa', x: 52, y: 50 },
            { label: 'Asia', x: 72, y: 30 },
            { label: 'Oceania', x: 82, y: 65 },
          ].map(({ label, x, y }) => (
            <div key={label} style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              color: 'rgba(56,189,248,0.12)', fontSize: 14, fontWeight: 700,
              letterSpacing: 3, textTransform: 'uppercase', pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
            }}>{label}</div>
          ))}

          {/* Destination pins */}
          {pins.map(({ dest, x, y }) => {
            const isHovered = hoveredId === dest.id;
            const price = dest.livePrice ?? dest.flightPrice;
            return (
              <div
                key={dest.id}
                style={{
                  position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isHovered ? 20 : 10,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredId(dest.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => { e.stopPropagation(); router.push(`/destination/${dest.id}`); }}
              >
                {/* Pin dot */}
                <div style={{
                  width: isHovered ? 14 : 8, height: isHovered ? 14 : 8,
                  borderRadius: '50%',
                  backgroundColor: isHovered ? colors.primary : 'rgba(56,189,248,0.8)',
                  boxShadow: isHovered
                    ? '0 0 12px rgba(56,189,248,0.6), 0 0 24px rgba(56,189,248,0.3)'
                    : '0 0 6px rgba(56,189,248,0.4)',
                  transition: 'all 0.15s',
                  border: '2px solid rgba(255,255,255,0.3)',
                }} />
                {/* Price label (always visible) */}
                <div style={{
                  position: 'absolute', top: '100%', left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 4, whiteSpace: 'nowrap',
                  padding: '2px 6px', borderRadius: 6,
                  backgroundColor: isHovered ? 'rgba(56,189,248,0.2)' : 'rgba(0,0,0,0.5)',
                  fontSize: 9, fontWeight: 700,
                  color: isHovered ? colors.primary : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.15s',
                }}>
                  ${price}
                </div>
                {/* Hover card */}
                {isHovered && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 12, whiteSpace: 'nowrap',
                    padding: '10px 14px', borderRadius: 12,
                    backgroundColor: 'rgba(15,23,42,0.95)',
                    border: '1px solid rgba(56,189,248,0.3)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(12px)',
                    minWidth: 140,
                  }}>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{dest.city}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{dest.country}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(56,189,248,0.2)', color: colors.primary,
                        fontSize: 12, fontWeight: 700,
                      }}>✈️ ${price}</span>
                      {dest.rating && (
                        <span style={{ color: '#FBBF24', fontSize: 11, fontWeight: 600 }}>★ {dest.rating}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom info bar */}
      {hovered && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: '#fff', fontWeight: 700 }}>{hovered.city}, {hovered.country}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
          <span style={{ color: colors.primary, fontWeight: 600 }}>From ${hovered.livePrice ?? hovered.flightPrice}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{hovered.flightDuration}</span>
        </div>
      )}
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  backgroundColor: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', fontSize: 18, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
