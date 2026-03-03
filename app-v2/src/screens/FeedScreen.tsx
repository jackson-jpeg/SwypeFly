import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { colors, fonts, motion as motionTokens } from '@/tokens';

// Stub data — will be replaced by API
const STUB_DESTINATIONS = [
  { id: 'santorini', city: 'Santorini', country: 'Greece', tagline: 'Whitewashed cliffs above endless blue', tags: ['Islands', 'Romantic'], price: 387, image: '/images/santorini.jpg' },
  { id: 'bali', city: 'Bali', country: 'Indonesia', tagline: 'Emerald rice terraces meet sacred temples', tags: ['Tropical', 'Cultural'], price: 479, image: '/images/bali.jpg' },
  { id: 'kyoto', city: 'Kyoto', country: 'Japan', tagline: 'Ancient temples in a sea of cherry blossoms', tags: ['Cultural', 'Historic'], price: 612, image: '/images/kyoto.jpg' },
  { id: 'maldives', city: 'Maldives', country: 'Maldives', tagline: 'Overwater villas on crystal-clear lagoons', tags: ['Beach', 'Luxury'], price: 892, image: '/images/maldives.jpg' },
];

function FeedCard({
  destination,
  onSwipe,
  onTap,
  index,
  total,
}: {
  destination: (typeof STUB_DESTINATIONS)[0];
  onSwipe: (dir: 'left' | 'right') => void;
  onTap: () => void;
  index: number;
  total: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);
  const [saved, setSaved] = useState(false);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { velocity, offset } = info;
    if (Math.abs(velocity.x) > motionTokens.cardSwipe.velocityThreshold || Math.abs(offset.x) > motionTokens.cardSwipe.triggerDistance) {
      const dir = offset.x > 0 ? 'right' : 'left';
      animate(x, dir === 'right' ? 500 : -500, {
        type: motionTokens.cardSwipe.type,
        stiffness: motionTokens.cardSwipe.stiffness,
        damping: motionTokens.cardSwipe.damping,
      });
      setTimeout(() => onSwipe(dir), 200);
    } else {
      animate(x, 0, {
        type: 'spring',
        stiffness: 200,
        damping: 20,
      });
    }
  };

  const glassButton: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    backgroundColor: '#FFFFFF14',
    border: '1px solid #FFFFFF1F',
    cursor: 'pointer',
  };

  return (
    <motion.div
      style={{
        x,
        rotate,
        opacity,
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'clip',
        cursor: 'grab',
        touchAction: 'pan-y',
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      onClick={onTap}
    >
      {/* Full-bleed photo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${destination.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#0A0F1E',
        }}
      />
      {/* Bottom gradient overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '60%',
          background: 'linear-gradient(to top, rgba(10,15,30,1) 0%, rgba(10,15,30,0.95) 20%, rgba(10,15,30,0.7) 45%, transparent 100%)',
        }}
      />

      {/* Card progress dots */}
      <div style={{ position: 'absolute', top: 52, left: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: 6 }}>
        {Array.from({ length: Math.min(total, 4) }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 20,
              height: 3,
              borderRadius: 2,
              backgroundColor: i === index % 4 ? '#FFFFFF' : '#FFFFFF4D',
            }}
          />
        ))}
      </div>

      {/* Action buttons (right side) */}
      <div style={{ position: 'absolute', right: 16, top: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button
          style={glassButton}
          onClick={(e) => {
            e.stopPropagation();
            setSaved(!saved);
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill={saved ? '#FFFFFF' : 'none'} stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <button
          style={glassButton}
          onClick={(e) => {
            e.stopPropagation();
            console.log('share');
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>

      {/* Destination info */}
      <div style={{ position: 'absolute', bottom: 160, left: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 60,
            lineHeight: '58px',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
          }}
        >
          {destination.city}
        </div>
        <div
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 16,
            lineHeight: '20px',
            color: '#FFFFFFB3',
          }}
        >
          {destination.tagline}
        </div>
        {/* Tags row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, letterSpacing: '0.08em', lineHeight: '14px', textTransform: 'uppercase', color: '#FFFFFF73' }}>
            {destination.country}
          </span>
          {destination.tags.map((tag) => (
            <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF40', flexShrink: 0 }} />
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, letterSpacing: '0.08em', lineHeight: '14px', textTransform: 'uppercase', color: '#FFFFFF73' }}>
                {tag}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Price pill */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBlock: 12,
          paddingInline: 22,
          borderRadius: 24,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: '#2C1F1AE6',
          border: '1px solid #FFFFFF1A',
        }}
      >
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, lineHeight: '16px', color: colors.borderTint }}>
          From
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: '28px',
            color: colors.sunriseButter,
            width: 60,
          }}
        >
          ${destination.price}
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            lineHeight: '12px',
            color: colors.confirmGreen,
          }}
        >
          LIVE PRICE
        </span>
      </div>
    </motion.div>
  );
}

export default function FeedScreen() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = useCallback((_dir: 'left' | 'right') => {
    setCurrentIndex((prev) => Math.min(prev + 1, STUB_DESTINATIONS.length - 1));
  }, []);

  const handleTap = useCallback(() => {
    navigate(`/destination/${STUB_DESTINATIONS[currentIndex]?.id}`);
  }, [navigate, currentIndex]);

  return (
    <div className="screen" style={{ background: '#0A0F1E', position: 'relative', overflow: 'hidden' }}>
      {STUB_DESTINATIONS.slice(currentIndex, currentIndex + 2)
        .reverse()
        .map((dest, i, arr) => (
          <FeedCard
            key={dest.id}
            destination={dest}
            onSwipe={handleSwipe}
            onTap={handleTap}
            index={currentIndex + (arr.length - 1 - i)}
            total={STUB_DESTINATIONS.length}
          />
        ))}
    </div>
  );
}
