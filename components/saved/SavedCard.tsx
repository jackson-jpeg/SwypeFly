import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { formatPrice } from '@/utils/formatPrice';
import { getCategoryColor } from '@/utils/categoryColors';
import { H5 } from '@/components/common/Typography';
import type { SavedDestination } from '@/types/destination';

const getImageSource = (destination: SavedDestination): string => {
  // Fallback hierarchy: destination.image → city.image → country.image → placeholder
  const placeholderImage = 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=400&q=80';
  
  return destination.image || 
         destination.city?.image || 
         destination.country?.image || 
         placeholderImage;
};

interface SavedCardProps {
  destination: SavedDestination;
  onRemove?: () => void;
}

export const SavedCard: React.FC<SavedCardProps> = ({ destination, onRemove }) => {
  const router = useRouter();
  const imageSource = getImageSource(destination);
  const categoryColor = getCategoryColor(destination.category || 'budget');

  return (
    <Pressable
      className="w-full h-48 rounded-2xl overflow-hidden mb-3"
      onPress={() => router.push(`/destination/${destination.slug}`)}
    >
      <Image
        source={{ uri: imageSource }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        cachePolicy={'memory-disk'}
        priority="normal"
      />
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40%',
        }}
      />
      
      <View className="absolute bottom-3 left-3 right-3">
        <H5 className="text-white mb-1" numberOfLines={1}>
          {destination.name}
        </H5>
        
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {destination.city?.name && (
              <>
                <Text className="text-white/80 text-sm">
                  {destination.city.name}
                </Text>
                <Feather name="chevron-right" size={12} color="white" style={{ marginHorizontal: 2 }} />
              </>
            )}
            <Text className="text-white/80 text-sm">
              {destination.country?.name}
            </Text>
          </View>
          
          <View className="bg-black/40 rounded-full px-2 py-1">
            <Text className="text-white text-xs font-semibold">
              from {formatPrice(destination.price)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};
