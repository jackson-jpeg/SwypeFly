import React from 'react';
import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { AntDesign, Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Button } from '@/components/common/Button';
import { QuickStats } from './QuickStats';
import { formatPrice } from '@/utils/formatPrice';
import { H1 } from '@/components/common/Typography';
import type { Destination } from '@/types/destination';

const { height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.6;

const getImageSource = (destination: Destination): string => {
  // Fallback hierarchy: destination.image → city.image → country.image → placeholder
  const placeholderImage = 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=1200&q=90';
  
  return destination.image || 
         destination.city?.image || 
         destination.country?.image || 
         placeholderImage;
};

interface DestinationHeroProps {
  destination: Destination;
  scrollOffset: Animated.SharedValue<number>;
}

export const DestinationHero: React.FC<DestinationHeroProps> = ({ 
  destination, 
  scrollOffset 
}) => {
  const router = useRouter();
  const imageSource = getImageSource(destination);

  const imageStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollOffset.value,
      [0, HERO_HEIGHT],
      [1, 1.5],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      scrollOffset.value,
      [0, HERO_HEIGHT * 0.8],
      [1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={{ height: HERO_HEIGHT }} className="relative">
      <Animated.View style={imageStyle} className="absolute inset-0">
        <Image
          source={{ uri: imageSource }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy={'memory-disk'}
          priority="high"
        />
      </Animated.View>

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
        }}
      />

      <View className="absolute bottom-8 left-6 right-6">
        <View className="flex-row items-center mb-2">
          <Text className="text-white/90 text-sm font-medium">
            {destination.city?.name || destination.country?.name}
          </Text>
          <Feather name="chevron-right" size={16} color="white" />
          <Text className="text-white text-sm font-semibold">{destination.name}</Text>
        </View>

        <H1 className="text-white mb-3" numberOfLines={1}>
          {destination.name}
        </H1>

        <QuickStats destination={destination} />

        <View className="mt-4 flex-row gap-3">
          <Button
            variant="primary"
            size="lg"
            onPress={() => {
              // Book action
            }}
            className="flex-1"
          >
            <Text className="font-bold text-base">
              Book from {formatPrice(destination.price)}
            </Text>
          </Button>

          <Button
            variant="secondary"
            size="lg"
            icon={<AntDesign name="hearto" size={20} color="white" />}
            onPress={() => {
              // Save action
            }}
            className="aspect-square"
          />
        </View>
      </View>
    </View>
  );
};
