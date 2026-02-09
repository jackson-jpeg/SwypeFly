export function formatFlightPrice(
  price: number,
  currency = 'USD',
  priceSource?: 'travelpayouts' | 'amadeus' | 'estimate',
): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  const isLive = priceSource === 'travelpayouts' || priceSource === 'amadeus';
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
