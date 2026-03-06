import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { colors, fonts } from '@/tokens';
import { useSavedStore } from '@/stores/savedStore';
import { useAuthContext } from '@/hooks/AuthContext';
import { apiFetch, USE_STUBS } from '@/api/client';
import { STUB_DESTINATIONS } from '@/api/stubs';
import { useUIStore } from '@/stores/uiStore';
import type { Destination } from '@/api/types';
import BottomNav from '@/components/BottomNav';

function HeartFilled({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={colors.deepDusk} stroke={colors.deepDusk}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type SortMode = 'all' | 'price' | 'recent';

export default function WishlistScreen() {
  const navigate = useNavigate();
  const { savedIds, toggle } = useSavedStore();
  const { session } = useAuthContext();
  const departureCode = useUIStore((s) => s.departureCode);
  const [sort, setSort] = useState<SortMode>('all');
  const userId = session?.userId;

  // Fetch destination details for each saved ID
  const destQueries = useQueries({
    queries: savedIds.map((id) => ({
      queryKey: ['destination', id, departureCode],
      queryFn: async (): Promise<Destination | null> => {
        if (USE_STUBS) {
          return STUB_DESTINATIONS.find((d) => d.id === id) ?? null;
        }
        try {
          return await apiFetch<Destination>(`/api/destination?id=${id}&origin=${departureCode}`);
        } catch {
          return null;
        }
      },
      staleTime: 10 * 60 * 1000,
    })),
  });

  const allData = destQueries
    .map((q, idx) => {
      const d = q.data;
      return d ? { ...d, savedOrder: idx } : null;
    })
    .filter(Boolean) as (Destination & { savedOrder: number })[];

  const sorted = sort === 'price'
    ? [...allData].sort((a, b) => a.flightPrice - b.flightPrice)
    : sort === 'recent'
      ? [...allData].reverse()
      : allData;

  const WISHLIST_DATA = sorted.map((d) => ({
    id: d.id,
    city: d.city,
    country: d.country,
    vibe: d.vibeTags[0] ?? 'Travel',
    price: d.livePrice ?? d.flightPrice,
    image: d.imageUrl,
    priceDrop: d.previousPrice ? d.previousPrice - d.flightPrice : undefined,
  }));

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'clip',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 24, paddingRight: 24, paddingTop: 60 }}>
        <h1
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 34,
            lineHeight: '40px',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: colors.deepDusk,
            margin: 0,
          }}
        >
          My Wishlist
        </h1>

        {/* Stats pills */}
        {WISHLIST_DATA.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#F2CEBC40',
                border: '1px solid #C9A99A40',
                borderRadius: 16,
                paddingBlock: 6,
                paddingInline: 12,
              }}
            >
              <HeartFilled size={14} />
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, lineHeight: '16px', color: colors.borderTint }}>
                {WISHLIST_DATA.length} saved
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#F2CEBC40',
                border: '1px solid #C9A99A40',
                borderRadius: 16,
                paddingBlock: 6,
                paddingInline: 12,
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, lineHeight: '16px', color: colors.borderTint }}>
                Avg ${Math.round(WISHLIST_DATA.reduce((s, d) => s + d.price, 0) / WISHLIST_DATA.length)}
              </span>
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          {([['all', 'All'], ['price', 'Price low'], ['recent', 'Recently added']] as const).map(([key, label]) => {
            const active = sort === key;
            return (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 32,
                  paddingInline: 14,
                  backgroundColor: active ? colors.deepDusk : '#F2CEBC40',
                  border: active ? 'none' : '1px solid #C9A99A40',
                  borderRadius: 16,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, fontWeight: active ? 600 : 400, lineHeight: '16px', color: active ? colors.paleHorizon : colors.bodyText }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Card grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '20px 24px', flex: 1 }}>
        {WISHLIST_DATA.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 60, width: '100%' }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: colors.mutedText }}>No saved destinations yet</span>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.borderTint }}>Tap the heart on destinations you love</span>
          </div>
        )}
        {WISHLIST_DATA.map((dest) => (
          <div
            key={dest.id}
            onClick={() => navigate(`/destination/${dest.id}`)}
            style={{
              cursor: 'pointer',
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'clip',
              width: 'calc(50% - 7px)',
              flexShrink: 0,
            }}
          >
            {/* Image area */}
            <div style={{ height: 120, position: 'relative', width: '100%' }}>
              <div
                style={{
                  backgroundImage: `url(${dest.image})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundColor: colors.deepDusk,
                  position: 'absolute',
                  inset: 0,
                }}
              />
              {/* Gradient overlay */}
              <div
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 60,
                }}
              />
              {/* City name */}
              <span
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 10,
                  right: 30,
                  fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  lineHeight: '18px',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {dest.city}
              </span>
              {/* Heart icon — tap to unsave */}
              <button
                onClick={(e) => { e.stopPropagation(); toggle(dest.id, userId); }}
                style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <HeartFilled />
              </button>
              {/* Price drop badge */}
              {dest.priceDrop && dest.priceDrop > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    backgroundColor: colors.confirmGreen,
                    borderRadius: 20,
                    paddingBlock: 3,
                    paddingInline: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      lineHeight: '12px',
                      color: '#FFFFFF',
                    }}
                  >
                    ↓ ${dest.priceDrop} since saved
                  </span>
                </div>
              )}
            </div>
            {/* Info area */}
            <div style={{ backgroundColor: colors.offWhite, paddingBlock: 10, paddingInline: 10 }}>
              <div
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: '20px',
                  color: colors.deepDusk,
                }}
              >
                ${dest.price}
              </div>
              <div
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 11,
                  lineHeight: '14px',
                  color: colors.borderTint,
                }}
              >
                {dest.country} · {dest.vibe}
              </div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
