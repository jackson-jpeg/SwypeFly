// OG Image generator — returns a real 1200×630 PNG image for social sharing
// Usage: /api/og?id=<destination_id>
//    or: /api/og?city=Paris&country=France&price=64&image=https://...
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageResponse } from '@vercel/og';
import { supabase, TABLES } from '../services/supabaseServer';
import { cors } from './_cors.js';
import { env } from '../utils/env';

function formatTravelDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return '';
  }
}
import {
  getCacheKey,
  tryCacheHit,
  cacheAndSend,
  OG_COLORS,
  DEAL_TIER_COLORS,
  DEAL_TIER_LABELS,
  VIBE_TAG_COLORS,
  VIBE_TAG_LABELS,
} from './_ogCache';

function escapeStr(str: string): string {
  return str.replace(/[<>"'&]/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  let cityStr = 'Amazing Destination';
  let countryStr = '';
  let priceStr = '';
  let hotelPriceStr = '';
  let imageUrl =
    'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630';
  let tagline = '';
  let flightDuration = '';
  let costLevel = '';
  let dealTier = '';
  let savingsPercent = 0;
  let vibeTags: string[] = [];
  let origin = '';
  let departDate = '';
  let returnDate = '';

  const { id, city, country, price, image } = req.query;

  if (id) {
    try {
      const { data: dest } = await supabase
        .from(TABLES.destinations)
        .select('*')
        .eq('id', String(id))
        .single();
      if (dest) {
        cityStr = escapeStr(dest.city || cityStr);
        countryStr = escapeStr(dest.country || '');
        tagline = escapeStr(dest.tagline || '');
        try {
          const parsedUrl = new URL(dest.image_url || imageUrl);
          if (parsedUrl.protocol === 'https:') imageUrl = parsedUrl.href;
        } catch {
          /* invalid URL — keep default image */
        }
        const rawPrice = dest.live_price ?? dest.flight_price;
        const effectivePrice = rawPrice
          ? Math.round(rawPrice * (1 + env.BOOKING_MARKUP_PERCENT / 100))
          : null;
        priceStr = effectivePrice ? `$${effectivePrice}` : '';
        flightDuration = escapeStr(dest.flight_duration || '');
        const hotelPrice = dest.hotel_price_per_night || 0;
        if (hotelPrice > 0) {
          hotelPriceStr = `$${Math.round(hotelPrice)}/night`;
        }
        costLevel =
          hotelPrice <= 60
            ? '$'
            : hotelPrice <= 120
              ? '$$'
              : hotelPrice <= 200
                ? '$$$'
                : '$$$$';
        if (Array.isArray(dest.vibe_tags)) vibeTags = dest.vibe_tags;
      }

      try {
        const { data: calendarRows } = await supabase
          .from(TABLES.priceCalendar)
          .select('deal_tier, savings_percent, origin, date, return_date')
          .eq('destination_id', String(id))
          .order('deal_score', { ascending: false })
          .limit(1);
        if (calendarRows && calendarRows.length > 0) {
          const pd = calendarRows[0];
          const dbTier = (pd.deal_tier as string) || '';
          if (dbTier in DEAL_TIER_COLORS) dealTier = dbTier;
          savingsPercent = Math.max(
            0,
            Math.min(100, (pd.savings_percent as number) || 0),
          );
          origin = (pd.origin as string) || '';
          departDate = (pd.date as string) || '';
          returnDate = (pd.return_date as string) || '';
        }
      } catch {
        // OK — proceed without deal data
      }
    } catch {
      // Fall through to query params
    }
  }

  // Query param overrides
  if (city) cityStr = escapeStr(String(city));
  if (country) countryStr = escapeStr(String(country));
  if (price) priceStr = `$${escapeStr(String(price))}`;
  if (image) {
    try {
      const parsed = new URL(String(image));
      if (parsed.protocol === 'https:') imageUrl = parsed.href;
    } catch {
      /* invalid URL — keep default image */
    }
  }
  if (req.query.dealTier) {
    const tier = String(req.query.dealTier);
    if (tier in DEAL_TIER_COLORS) dealTier = tier;
  }
  if (req.query.savingsPercent)
    savingsPercent = Math.max(
      0,
      Math.min(100, parseInt(String(req.query.savingsPercent), 10) || 0),
    );

  // Check cache before rendering
  const cacheKey = getCacheKey({
    type: 'og',
    city: cityStr,
    country: countryStr,
    price: priceStr,
    hotel: hotelPriceStr,
    image: imageUrl,
    tagline,
    dealTier,
    savingsPercent,
    vibeTags,
    origin,
    departDate,
    returnDate,
  });
  if (tryCacheHit(req, res, cacheKey)) return;

  const metaParts = [countryStr, flightDuration, costLevel].filter(Boolean);
  const metaRow = metaParts.join('  ·  ');

  const tierColor = DEAL_TIER_COLORS[dealTier] || '';
  const tierLabel = DEAL_TIER_LABELS[dealTier] || '';

  // Build price pill text: "Flights from $X" and optionally "· Hotels from $Y/night"
  const priceParts: string[] = [];
  if (priceStr) priceParts.push(`Flights from ${priceStr}`);
  if (hotelPriceStr) priceParts.push(`Hotels from ${hotelPriceStr}`);
  const priceDisplay = priceParts.join('  ·  ') || '';

  try {
    const imgResponse = new ImageResponse(
      {
        type: 'div',
        key: null,
        props: {
          style: {
            position: 'relative',
            width: 1200,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#2C1F1A',
            fontFamily: 'sans-serif',
          },
          children: [
            // Background image
            {
              type: 'img',
              props: {
                src: imageUrl,
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 1200,
                  height: 630,
                  objectFit: 'cover',
                },
              },
            },
            // Gradient overlay
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 1200,
                  height: 630,
                  background:
                    'linear-gradient(to bottom, transparent 25%, rgba(44,31,26,0.3) 50%, rgba(44,31,26,0.85) 80%, rgba(44,31,26,0.95) 100%)',
                },
              },
            },
            // Top bar
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: 28,
                  left: 40,
                  right: 40,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                },
                children: [
                  // Logo
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      },
                      children: [
                        {
                          type: 'span',
                          props: {
                            style: {
                              fontSize: 28,
                              fontWeight: 800,
                              color: '#fff',
                              letterSpacing: -0.5,
                            },
                            children: 'SoGoJet',
                          },
                        },
                        {
                          type: 'span',
                          props: {
                            style: {
                              fontSize: 14,
                              fontWeight: 500,
                              color: 'rgba(255,255,255,0.5)',
                              letterSpacing: 1,
                              textTransform: 'uppercase' as const,
                            },
                            children: 'Discover Your Next Trip',
                          },
                        },
                      ],
                    },
                  },
                  // Deal badge (top-right)
                  ...(tierColor && tierLabel
                    ? [
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              backgroundColor: tierColor + '20',
                              border: `1px solid ${tierColor}60`,
                              padding: '8px 18px',
                              borderRadius: 8,
                            },
                            children: [
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    width: 10,
                                    height: 10,
                                    borderRadius: 5,
                                    backgroundColor: tierColor,
                                  },
                                },
                              },
                              {
                                type: 'span',
                                props: {
                                  style: {
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: tierColor,
                                    letterSpacing: 1,
                                  },
                                  children: tierLabel,
                                },
                              },
                              ...(savingsPercent > 0
                                ? [
                                    {
                                      type: 'span',
                                      props: {
                                        style: {
                                          fontSize: 16,
                                          fontWeight: 600,
                                          color: tierColor,
                                          marginLeft: 6,
                                        },
                                        children: `${savingsPercent}% OFF`,
                                      },
                                    },
                                  ]
                                : []),
                            ],
                          },
                        },
                      ]
                    : []),
                ],
              },
            },
            // Bottom content
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  bottom: 40,
                  left: 40,
                  right: 40,
                  display: 'flex',
                  flexDirection: 'column',
                },
                children: [
                  // City name
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 72,
                        fontWeight: 800,
                        color: '#fff',
                        lineHeight: 1,
                        letterSpacing: -2,
                      },
                      children: cityStr,
                    },
                  },
                  // Tagline
                  ...(tagline
                    ? [
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: 22,
                              fontWeight: 400,
                              fontStyle: 'italic' as const,
                              color: 'rgba(255,255,255,0.6)',
                              marginTop: 8,
                            },
                            children: tagline,
                          },
                        },
                      ]
                    : []),
                  // Meta row
                  ...(metaRow
                    ? [
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: 18,
                              fontWeight: 500,
                              color: 'rgba(255,255,255,0.7)',
                              marginTop: 8,
                              letterSpacing: 0.5,
                            },
                            children: metaRow,
                          },
                        },
                      ]
                    : []),
                  // Route + dates
                  ...(origin
                    ? [
                        {
                          type: 'div',
                          props: {
                            style: {
                              marginTop: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                            },
                            children: [
                              {
                                type: 'span',
                                props: {
                                  style: {
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: '#fff',
                                    letterSpacing: 2,
                                  },
                                  children: origin,
                                },
                              },
                              {
                                type: 'span',
                                props: {
                                  style: {
                                    fontSize: 16,
                                    color: OG_COLORS.green,
                                  },
                                  children: '→',
                                },
                              },
                              {
                                type: 'span',
                                props: {
                                  style: {
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: '#fff',
                                    letterSpacing: 2,
                                  },
                                  children: cityStr.toUpperCase(),
                                },
                              },
                              ...(departDate && returnDate
                                ? [
                                    {
                                      type: 'span',
                                      props: {
                                        style: {
                                          fontSize: 15,
                                          color: 'rgba(255,255,255,0.5)',
                                          marginLeft: 8,
                                        },
                                        children: `${formatTravelDate(departDate)} – ${formatTravelDate(returnDate)}`,
                                      },
                                    },
                                  ]
                                : []),
                            ],
                          },
                        },
                      ]
                    : []),
                  // Vibe tags
                  ...(vibeTags.length > 0
                    ? [
                        {
                          type: 'div',
                          props: {
                            style: {
                              marginTop: 12,
                              display: 'flex',
                              gap: 8,
                              flexWrap: 'wrap' as const,
                            },
                            children: vibeTags.slice(0, 4).map((tag: string, i: number) => ({
                              type: 'div',
                              key: String(i),
                              props: {
                                style: {
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: VIBE_TAG_COLORS[tag] || OG_COLORS.muted,
                                  backgroundColor:
                                    (VIBE_TAG_COLORS[tag] || OG_COLORS.muted) + '18',
                                  border: `1px solid ${(VIBE_TAG_COLORS[tag] || OG_COLORS.muted) + '40'}`,
                                  padding: '4px 12px',
                                  borderRadius: 4,
                                  letterSpacing: 0.5,
                                  textTransform: 'uppercase' as const,
                                },
                                children: VIBE_TAG_LABELS[tag] || tag,
                              },
                            })),
                          },
                        },
                      ]
                    : []),
                  // Price pill with hotel info
                  ...(priceDisplay
                    ? [
                        {
                          type: 'div',
                          props: {
                            style: {
                              marginTop: 20,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '10px 28px',
                              borderRadius: 999,
                              background:
                                'linear-gradient(135deg, rgba(168,196,184,0.9), rgba(168,196,184,0.9))',
                              fontSize: hotelPriceStr ? 22 : 28,
                              fontWeight: 700,
                              color: '#1a1a1a',
                              alignSelf: 'flex-start',
                            },
                            children: priceDisplay,
                          },
                        },
                      ]
                    : []),
                ],
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
      },
    );

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    cacheAndSend(res, cacheKey, buffer, 86400);
  } catch (err) {
    console.error('[og] Image generation failed:', err);
    res.setHeader('Location', imageUrl);
    res.status(302).end();
  }
}
