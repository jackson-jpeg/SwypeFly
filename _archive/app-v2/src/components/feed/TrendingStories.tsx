import { useState, useEffect, useMemo } from 'react';
import { colors, fonts } from '@/tokens';
import type { Destination } from '@/api/types';

const CIRCLE_SIZE = 64;
const RING_WIDTH = 2;
const MAX_ITEMS = 12;

interface TrendingStoriesProps {
  destinations: Destination[];
  onSelect: (dest: Destination) => void;
}

// CSS for hidden scrollbar + stagger animation injected once
const STYLE_ID = 'trending-stories-css';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .trending-scroll::-webkit-scrollbar { display: none }
    @keyframes trending-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function StoryCircle({
  destination,
  index,
  onSelect,
}: {
  destination: Destination;
  index: number;
  onSelect: (dest: Destination) => void;
}) {
  const hasLiveDeal =
    destination.priceSource !== 'estimate' && destination.flightPrice > 0;
  const hasPriceDrop =
    (destination.priceDropPercent ?? 0) > 0;

  const gradientBorder = hasLiveDeal
    ? 'linear-gradient(135deg, #7BAF8E, #F7E8A0)'
    : 'linear-gradient(135deg, #FFFFFF30, #FFFFFF18)';

  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      onClick={() => onSelect(destination)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        flexShrink: 0,
        width: CIRCLE_SIZE + 8,
        animation: `trending-fade-up 0.35s ease-out ${index * 50}ms both`,
      }}
    >
      {/* Ring + image */}
      <div style={{ position: 'relative' }}>
        {/* Gradient ring */}
        <div
          style={{
            width: CIRCLE_SIZE + RING_WIDTH * 2,
            height: CIRCLE_SIZE + RING_WIDTH * 2,
            borderRadius: '50%',
            background: gradientBorder,
            padding: RING_WIDTH,
            boxSizing: 'border-box',
          }}
        >
          {/* Inner circle with image */}
          <div
            style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: '#0A0F1E',
              border: '2px solid #0A0F1E',
              boxSizing: 'border-box',
            }}
          >
            <img
              src={destination.imageUrl}
              alt={destination.city}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Fire badge for price drop */}
        {hasPriceDrop && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: '#0A0F1E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            <span role="img" aria-label="Hot deal">
              {'\uD83D\uDD25'}
            </span>
          </div>
        )}
      </div>

      {/* City name */}
      <span
        style={{
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 11,
          lineHeight: '14px',
          color: '#FFFFFFB3',
          textAlign: 'center',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {destination.city}
      </span>

      {/* Price badge */}
      <span
        style={{
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 10,
          fontWeight: 700,
          lineHeight: '12px',
          color: colors.sunriseButter,
          textAlign: 'center',
        }}
      >
        ${destination.flightPrice}
      </span>
    </div>
  );
}

export default function TrendingStories({
  destinations,
  onSelect,
}: TrendingStoriesProps) {
  useEffect(() => {
    ensureStyles();
  }, []);

  const trending = useMemo(() => {
    if (!destinations.length) return [];

    // Sort: prioritize live prices + price drops, then by price
    const sorted = [...destinations].sort((a, b) => {
      const aLive = a.priceSource !== 'estimate' ? 1 : 0;
      const bLive = b.priceSource !== 'estimate' ? 1 : 0;
      const aDrop = a.priceDropPercent ?? 0;
      const bDrop = b.priceDropPercent ?? 0;

      // Price drops first
      if (aDrop > 0 && bDrop === 0) return -1;
      if (bDrop > 0 && aDrop === 0) return 1;
      if (aDrop !== bDrop) return bDrop - aDrop;

      // Then live prices
      if (aLive !== bLive) return bLive - aLive;

      // Then cheapest
      return a.flightPrice - b.flightPrice;
    });

    return sorted.slice(0, MAX_ITEMS);
  }, [destinations]);

  if (trending.length === 0) return null;

  return (
    <div
      className="trending-scroll"
      style={{
        display: 'flex',
        gap: 12,
        paddingInline: 16,
        paddingTop: 52,
        paddingBottom: 8,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0,
      }}
    >
      {trending.map((dest, i) => (
        <StoryCircle
          key={dest.id}
          destination={dest}
          index={i}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
