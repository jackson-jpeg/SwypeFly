const shimmerBg: React.CSSProperties = {
  backgroundImage: 'linear-gradient(90deg, #FFFFFF08 0%, #FFFFFF18 40%, #FFFFFF08 80%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.8s ease-in-out infinite',
  borderRadius: 8,
};

export default function SkeletonCard() {
  return (
    <div
      style={{
        height: '100%',
        minHeight: '100%',
        width: '100%',
        position: 'relative',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        overflow: 'hidden',
        backgroundColor: '#0A0F1E',
      }}
    >
      {/* Image area shimmer */}
      <div
        style={{
          ...shimmerBg,
          position: 'absolute',
          inset: 0,
          borderRadius: 0,
        }}
      />

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '65%',
          background:
            'linear-gradient(to top, rgba(10,15,30,1) 0%, rgba(10,15,30,0.95) 20%, rgba(10,15,30,0.7) 45%, transparent 100%)',
        }}
      />

      {/* Right side action button placeholders */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 220,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              ...shimmerBg,
              width: 48,
              height: 48,
              borderRadius: 24,
            }}
          />
        ))}
      </div>

      {/* Text placeholders */}
      <div
        style={{
          position: 'absolute',
          bottom: 140,
          left: 20,
          right: 72,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* City name */}
        <div style={{ ...shimmerBg, width: '60%', height: 32 }} />
        {/* Tagline */}
        <div style={{ ...shimmerBg, width: '85%', height: 18 }} />
        {/* Tags */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...shimmerBg, width: 60, height: 14 }} />
          <div style={{ ...shimmerBg, width: 50, height: 14 }} />
          <div style={{ ...shimmerBg, width: 45, height: 14 }} />
        </div>
      </div>

      {/* Price pill placeholder */}
      <div
        style={{
          ...shimmerBg,
          position: 'absolute',
          bottom: 88,
          left: 20,
          width: 160,
          height: 56,
          borderRadius: 16,
        }}
      />
    </div>
  );
}
