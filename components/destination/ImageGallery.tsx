import { useState } from 'react';
import { Platform, View, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';

interface ImageGalleryProps {
  images: string[];
  city: string;
}

export default function ImageGallery({ images, city }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (Platform.OS === 'web') {
    return (
      <div style={{ width: '100%', position: 'relative' }}>
        <style>{`
          .ig-scroll { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
          .ig-scroll::-webkit-scrollbar { display: none; }
          .ig-slide { scroll-snap-align: start; scroll-snap-stop: always; }
        `}</style>
        <div
          className="ig-scroll"
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
          }}
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const idx = Math.round(target.scrollLeft / target.clientWidth);
            setActiveIndex(idx);
          }}
        >
          {images.map((url, i) => (
            <div
              key={i}
              className="ig-slide"
              style={{
                minWidth: '100%',
                aspectRatio: '4/3',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <img
                src={url}
                alt={`${city} ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          ))}
        </div>
        {/* Gradient fade to light bg */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: 'linear-gradient(transparent, #F8FAFC)',
            pointerEvents: 'none',
          }}
        />
        {/* Pagination dots */}
        {images.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 6,
              zIndex: 5,
            }}
          >
            {images.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activeIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    i === activeIndex ? '#38BDF8' : 'rgba(0,0,0,0.25)',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Native
  const { width: screenWidth } = Dimensions.get('window');

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setActiveIndex(idx);
  };

  return (
    <View style={{ width: '100%', position: 'relative' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {images.map((url, i) => (
          <View key={i} style={{ width: screenWidth, aspectRatio: 4 / 3 }}>
            <Image
              source={{ uri: url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
            />
          </View>
        ))}
      </ScrollView>
      {/* Pagination dots */}
      {images.length > 1 && (
        <View
          style={{
            position: 'absolute',
            bottom: 16,
            alignSelf: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === activeIndex ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i === activeIndex ? '#38BDF8' : 'rgba(0,0,0,0.25)',
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
