export interface City {
  id: string;
  name: string;
  slug: string;
  image?: string;
  coordinates?: [number, number];
}

export interface Country {
  id: string;
  name: string;
  slug: string;
  image?: string;
  code: string;
  continent?: string;
}

export interface Destination {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  image?: string;
  gallery?: string[];
  city?: City;
  country?: Country;
  category?: 'budget' | 'mid-range' | 'luxury' | 'exclusive';
  tags?: string[];
  highlights?: string[];
  coordinates?: [number, number];
  featured?: boolean;
  trending?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SavedDestination extends Destination {
  saved_at?: string;
}

export type DestinationImageSource = string | { uri: string };
