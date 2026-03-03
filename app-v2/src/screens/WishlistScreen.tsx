import { colors, fonts } from '@/tokens';
import BottomNav from '@/components/BottomNav';

const WISHLIST_DATA = [
  { city: 'Santorini', country: 'Greece', vibe: 'Romance', price: 387, image: '/images/santorini.jpg', priceDrop: 23 },
  { city: 'Bali', country: 'Indonesia', vibe: 'Tropical', price: 479, image: '/images/bali.jpg' },
  { city: 'Kyoto', country: 'Japan', vibe: 'Culture', price: 612, image: '/images/kyoto.jpg' },
  { city: 'Maldives', country: 'Maldives', vibe: 'Luxury', price: 892, image: '/images/maldives.jpg' },
];

function HeartFilled({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={colors.deepDusk} stroke={colors.deepDusk}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function WishlistScreen() {
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

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              paddingInline: 14,
              backgroundColor: colors.deepDusk,
              borderRadius: 16,
            }}
          >
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, fontWeight: 600, lineHeight: '16px', color: colors.paleHorizon }}>
              All
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              paddingInline: 14,
              backgroundColor: '#F2CEBC40',
              border: '1px solid #C9A99A40',
              borderRadius: 16,
            }}
          >
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, lineHeight: '16px', color: colors.bodyText }}>
              Price low
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              paddingInline: 14,
              backgroundColor: '#F2CEBC40',
              border: '1px solid #C9A99A40',
              borderRadius: 16,
            }}
          >
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, lineHeight: '16px', color: colors.bodyText }}>
              Recently added
            </span>
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '20px 24px', flex: 1 }}>
        {WISHLIST_DATA.map((dest) => (
          <div
            key={dest.city}
            style={{
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
                  fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  lineHeight: '18px',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                }}
              >
                {dest.city}
              </span>
              {/* Heart icon */}
              <div style={{ position: 'absolute', right: 8, top: 8 }}>
                <HeartFilled />
              </div>
              {/* Price drop badge */}
              {dest.priceDrop && (
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
