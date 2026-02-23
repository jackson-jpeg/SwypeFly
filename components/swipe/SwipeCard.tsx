import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MotiView, MotiImage } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CardGradient } from './CardGradient';
import { CardActions } from './CardActions';
import { CardPriceTag } from './CardPriceTag';
import { H4 } from '@/components/common/Typography';
import { formatPrice } from '@/utils/formatPrice';
import { getCategoryColor } from '@/utils/categoryColors';
import type { Destination } from '@/types/destination';

interface SwipeCardProps {
  destination: Destination;
  index?: number;
  style?: any;
  showActions?: boolean;
}

const getImageSource = (destination: Destination): string => {
  // Fallback hierarchy: destination.image → city.image → country.image → placeholder
  const placeholderImage = 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=800&q=80';
  
  return destination.image || 
         destination.city?.image || 
         destination.country?.image || 
         placeholderImage;
};

export const SwipeCard: React.FC<SwipeCardProps> = ({ 
  destination, 
  index = 0, 
  style,
  showActions = true
}) => {
  const router = useRouter();
  const imageSource = getImageSource(destination);
  const categoryColor = getCategoryColor(destination.category || 'budget');

  return (
    <Pressable 
      className="w-full h-full"
      onPress={() => router.push(`/destination/${destination.slug}`)}
    >
      <View className="relative w-full h-full overflow-hidden rounded-3xl">
        <Image
          source={{ uri: imageSource }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={1000}
          priority={index < 5 ? 'high' : 'low'}
        />
        
        <CardGradient intensity="medium">
          <CardActions destination={destination} />
          <CardPriceTag price={destination.price} category={destination.category} />
        </CardGradient>
      </View>
    </Pressable>
  );
};
