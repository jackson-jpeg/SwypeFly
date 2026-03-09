import { useCallback, useRef, useState } from 'react';
import { colors } from '@/tokens';

interface PhotoGalleryProps {
  images: string[];
  height?: number;
  /** Extra style applied to the outer wrapper */
  style?: React.CSSProperties;
}

export default function PhotoGallery({ images, height = 320, style }: PhotoGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const single = images.length <= 1;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(idx);
  }, []);

  if (images.length === 0) return null;

  /* Single image — no gallery chrome */
  if (single) {
    return (
      <div
        style={{
          width: '100%',
          height,
          overflow: 'hidden',
          ...style,
        }}
      >
        <img
          src={images[0]}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height, ...style }}>
      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',        /* Firefox */
          msOverflowStyle: 'none',       /* IE/Edge */
        }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              flexShrink: 0,
              scrollSnapAlign: 'start',
            }}
          />
        ))}
      </div>

      {/* Dot indicators */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        {images.map((_, i) => {
          const active = i === activeIndex;
          return (
            <div
              key={i}
              style={{
                width: active ? 8 : 6,
                height: active ? 8 : 6,
                borderRadius: '50%',
                backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                boxShadow: active ? `0 0 4px ${colors.deepDusk}80` : 'none',
                transition: 'all 0.2s ease',
              }}
            />
          );
        })}
      </div>

      {/* Hide scrollbar for webkit */}
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
