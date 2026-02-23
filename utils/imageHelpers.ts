import type { Destination, SavedDestination } from '@/types/destination';

export const getDestinationImage = (
  destination: Destination | SavedDestination,
  size: 'small' | 'medium' | 'large' = 'medium'
): string => {
  const sizes = {
    small: 400,
    medium: 800,
    large: 1200
  };
  
  const width = sizes[size];
  const placeholderImage = `https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=${width}&q=80`;
  
  // Fallback hierarchy: destination.image → city.image → country.image → placeholder
  let imageUrl = destination.image || 
                  (destination as any).city?.image || 
                  (destination as any).country?.image || 
                  placeholderImage;
  
  // Ensure URL has proper width parameter
  if (!imageUrl.includes('w=')) {
    imageUrl += (imageUrl.includes('?') ? '&' : '?') + `w=${width}&q=80`;
  }
  
  return imageUrl;
};

export const preloadDestinationImages = async (destinations: any[]) => {
  if (!destinations?.length) return;
  
  const imageSources = destinations.map(dest => getDestinationImage(dest));
  const uniqueSources = [...new Set(imageSources)];
  
  // Prefetch images for faster loading
  const { Image } = await import('expo-image');
  await Image.prefetch(uniqueSources);
};

export const createImageWithFallback = (
  primaryUrl?: string,
  secondaryUrl?: string,
  placeholder?: string
): string => {
  const defaultPlaceholder = 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=800&q=80';
  return primaryUrl || secondaryUrl || placeholder || defaultPlaceholder;
};
