export type PriceConfidence = 'live' | 'recent' | 'estimate';

export function getPriceConfidence(
  priceSource: string | undefined,
  priceFetchedAt: string | undefined,
  offerExpiresAt: string | undefined,
): PriceConfidence {
  if (!priceSource || priceSource === 'estimate') return 'estimate';
  if (!priceFetchedAt) return 'estimate';

  const ageMs = Date.now() - new Date(priceFetchedAt).getTime();
  const ageMinutes = ageMs / 60000;

  const offerValid = offerExpiresAt
    ? new Date(offerExpiresAt).getTime() > Date.now()
    : false;

  if (ageMinutes < 30 && offerValid) return 'live';
  if (ageMinutes < 60) return 'recent';
  return 'estimate';
}

export function getPriceAgeLabel(priceFetchedAt: string | undefined): string | null {
  if (!priceFetchedAt) return null;
  const ageMs = Date.now() - new Date(priceFetchedAt).getTime();
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatPriceWithConfidence(
  price: number | null,
  _confidence: PriceConfidence,
): string {
  if (price == null || price <= 0) return 'Check price';
  return `$${price.toLocaleString('en-US')}`;
}

export function formatFlightPrice(
  price: number,
  currency = 'USD',
  priceSource?: 'travelpayouts' | 'amadeus' | 'duffel' | 'estimate',
): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  const isLive = priceSource === 'travelpayouts' || priceSource === 'amadeus' || priceSource === 'duffel';
  return isLive ? `From ${formatted}` : `From ~${formatted}`;
}

export function formatHotelPrice(
  pricePerNight: number,
  currency = 'USD',
  hotelPriceSource?: 'liteapi' | 'estimate',
): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pricePerNight);

  const isLive = hotelPriceSource === 'liteapi';
  return isLive ? `${formatted}/night` : `~${formatted}/night`;
}
