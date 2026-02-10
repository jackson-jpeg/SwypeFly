const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const BASE_URL = 'https://api.unsplash.com';

export interface UnsplashImage {
  unsplashId: string;
  urlRaw: string;
  urlRegular: string;   // 1080w
  urlSmall: string;      // 400w
  blurHash: string;
  photographer: string;
  photographerUrl: string;
}

/**
 * Search Unsplash for destination photos.
 * Free tier: 50 req/hr. Keep count low per batch.
 */
export async function searchDestinationImages(
  query: string,
  count = 5,
): Promise<UnsplashImage[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('[unsplash] No UNSPLASH_ACCESS_KEY set, skipping');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(count),
      orientation: 'portrait',
      content_filter: 'high',
    });

    const res = await fetch(`${BASE_URL}/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });

    if (!res.ok) {
      console.warn(`[unsplash] Search failed for "${query}": ${res.status}`);
      return [];
    }

    const json = (await res.json()) as {
      results: Array<{
        id: string;
        blur_hash: string | null;
        urls: { raw: string; regular: string; small: string };
        user: { name: string; links: { html: string } };
      }>;
    };

    return json.results.map((photo) => ({
      unsplashId: photo.id,
      urlRaw: photo.urls.raw,
      urlRegular: photo.urls.regular,
      urlSmall: photo.urls.small,
      blurHash: photo.blur_hash || '',
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
    }));
  } catch (err) {
    console.error(`[unsplash] Error searching "${query}":`, err);
    return [];
  }
}
