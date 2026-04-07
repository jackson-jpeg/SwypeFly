// Social share card generator — returns a real PNG image
// Usage: /api/share-card?id=<destination_id>&format=instagram|twitter
//        /api/share-card?top=5  — "Top 5 Deals" board card (Instagram format)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageResponse } from '@vercel/og';
import { supabase, TABLES } from '../services/supabaseServer';
import { cors } from './_cors.js';
import { env } from '../utils/env';
import { sendError } from '../utils/apiResponse';

const BOOKING_MARKUP_PERCENT = env.BOOKING_MARKUP_PERCENT;
function withMarkup(price: number): number {
  return Math.round(price * (1 + BOOKING_MARKUP_PERCENT / 100));
}

function escapeStr(str: string): string {
  return str.replace(/[<>"'&]/g, '');
}

const COLORS = {
  bg: '#0A0806',
  surface: '#151210',
  yellow: '#F7E8A0',
  white: '#FFF8F0',
  muted: '#8B7D6B',
  green: '#A8C4B8',
  dealAmazing: '#4ADE80',
  dealGreat: '#FBBF24',
  dealGood: '#60A5FA',
  border: '#2A231A',
};

const TIER_COLORS: Record<string, string> = {
  amazing: COLORS.dealAmazing,
  great: COLORS.dealGreat,
  good: COLORS.dealGood,
  fair: COLORS.muted,
};

// ─── Single deal card (Satori element tree) ─────────────────────────

function singleDealElement(
  city: string,
  country: string,
  price: number,
  imageUrl: string,
  dealTier: string,
  savingsPercent: number | null,
  usualPrice: number | null,
  airline: string,
  isNonstop: boolean,
  format: 'instagram' | 'twitter',
) {
  const w = format === 'instagram' ? 1080 : 1200;
  const h = format === 'instagram' ? 1080 : 630;
  const tierColor = TIER_COLORS[dealTier] || COLORS.muted;
  const tierLabel =
    dealTier === 'amazing'
      ? 'INCREDIBLE DEAL'
      : dealTier === 'great'
        ? 'GREAT DEAL'
        : dealTier === 'good'
          ? 'GOOD PRICE'
          : '';
  const fontSize = format === 'instagram' ? 64 : 52;
  const priceSize = format === 'instagram' ? 56 : 44;
  const bottomPad = format === 'instagram' ? 60 : 40;

  return {
    element: {
      type: 'div',
      props: {
        style: {
          position: 'relative' as const,
          width: w,
          height: h,
          display: 'flex',
          flexDirection: 'column' as const,
          backgroundColor: COLORS.bg,
          fontFamily: 'sans-serif',
        },
        children: [
          // Background image
          {
            type: 'img',
            props: {
              src: imageUrl,
              style: {
                position: 'absolute' as const,
                top: 0,
                left: 0,
                width: w,
                height: h,
                objectFit: 'cover' as const,
              },
            },
          },
          // Gradient overlay
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute' as const,
                top: 0,
                left: 0,
                width: w,
                height: h,
                background:
                  'linear-gradient(to bottom, transparent 20%, rgba(10,8,6,0.4) 50%, rgba(10,8,6,0.92) 80%, rgba(10,8,6,0.98) 100%)',
              },
            },
          },
          // Top bar
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute' as const,
                top: 40,
                left: 40,
                right: 40,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
              children: [
                // Deal badge (left)
                ...(tierLabel
                  ? [
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: tierColor + '20',
                            border: `1px solid ${tierColor}50`,
                            padding: '8px 16px',
                            borderRadius: 6,
                          },
                          children: [
                            {
                              type: 'div',
                              props: {
                                style: {
                                  width: 8,
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: tierColor,
                                },
                              },
                            },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: tierColor,
                                  letterSpacing: 1,
                                },
                                children: tierLabel,
                              },
                            },
                            ...(savingsPercent && savingsPercent > 0
                              ? [
                                  {
                                    type: 'span',
                                    props: {
                                      style: {
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: tierColor,
                                        marginLeft: 8,
                                      },
                                      children: `${savingsPercent}% BELOW AVG`,
                                    },
                                  },
                                ]
                              : []),
                          ],
                        },
                      },
                    ]
                  : [
                      { type: 'div', props: { children: '' } },
                    ]),
                // SoGoJet branding (right)
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                    },
                    children: [
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: 24,
                            fontWeight: 800,
                            color: COLORS.white,
                            letterSpacing: -0.5,
                          },
                          children: 'SoGo',
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: 24,
                            fontWeight: 800,
                            color: COLORS.green,
                            letterSpacing: -0.5,
                          },
                          children: 'Jet',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // Bottom content
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute' as const,
                bottom: bottomPad,
                left: 40,
                right: 40,
                display: 'flex',
                flexDirection: 'column' as const,
              },
              children: [
                // City
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize,
                      fontWeight: 800,
                      color: COLORS.white,
                      lineHeight: 1,
                      letterSpacing: -2,
                    },
                    children: city,
                  },
                },
                // Country + airline
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 18,
                      color: COLORS.muted,
                      marginTop: 6,
                      textTransform: 'uppercase' as const,
                      letterSpacing: 1,
                    },
                    children: [
                      country,
                      airline ? ` · ${airline}` : '',
                      isNonstop ? ' · Nonstop' : '',
                    ].join(''),
                  },
                },
                // Price row
                {
                  type: 'div',
                  props: {
                    style: {
                      marginTop: 20,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 16,
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: priceSize,
                            fontWeight: 800,
                            color: COLORS.yellow,
                            letterSpacing: -1,
                          },
                          children: `$${price}`,
                        },
                      },
                      ...(usualPrice
                        ? [
                            {
                              type: 'div',
                              props: {
                                style: {
                                  fontSize: 22,
                                  color: COLORS.muted,
                                  textDecoration: 'line-through',
                                },
                                children: `$${usualPrice}`,
                              },
                            },
                          ]
                        : []),
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 14,
                            color: COLORS.muted,
                            letterSpacing: 0.5,
                          },
                          children: 'round trip',
                        },
                      },
                    ],
                  },
                },
                // Footer
                {
                  type: 'div',
                  props: {
                    style: {
                      marginTop: 20,
                      fontSize: 14,
                      color: COLORS.muted,
                      letterSpacing: 0.5,
                    },
                    children: 'Found on SoGoJet · sogojet.com',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    width: w,
    height: h,
  };
}

// ─── Board card — top N deals ────────────────────────────────────────

function boardCardElement(
  deals: Array<{
    origin: string;
    city: string;
    price: number;
    savingsPercent: number | null;
    dealTier: string;
  }>,
) {
  const w = 1080;
  const h = 1080;

  const rows = deals.map((d, i) => {
    const tierColor = TIER_COLORS[d.dealTier] || COLORS.muted;
    const savingsStr =
      d.savingsPercent && d.savingsPercent > 0
        ? `−${d.savingsPercent}%`
        : '';
    return {
      type: 'div',
      key: String(i),
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          padding: '18px 0',
          ...(i < deals.length - 1
            ? { borderBottom: `1px solid ${COLORS.border}` }
            : {}),
        },
        children: [
          // Origin code
          {
            type: 'div',
            props: {
              style: {
                width: 80,
                fontSize: 28,
                fontWeight: 800,
                color: COLORS.muted,
              },
              children: d.origin,
            },
          },
          // Arrow
          {
            type: 'div',
            props: {
              style: {
                fontSize: 16,
                color: COLORS.muted,
                margin: '0 12px',
              },
              children: '→',
            },
          },
          // City
          {
            type: 'div',
            props: {
              style: {
                flex: 1,
                fontSize: 24,
                fontWeight: 700,
                color: COLORS.white,
                letterSpacing: 1,
              },
              children: d.city.toUpperCase(),
            },
          },
          // Price + savings
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column' as const,
                alignItems: 'flex-end',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 28,
                      fontWeight: 800,
                      color: COLORS.yellow,
                    },
                    children: `$${d.price}`,
                  },
                },
                ...(savingsStr
                  ? [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 13,
                            fontWeight: 600,
                            color: tierColor,
                          },
                          children: savingsStr,
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
          // Tier dot
          {
            type: 'div',
            props: {
              style: {
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: tierColor,
                marginLeft: 16,
              },
            },
          },
        ],
      },
    };
  });

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    element: {
      type: 'div',
      props: {
        style: {
          width: w,
          height: h,
          backgroundColor: COLORS.bg,
          display: 'flex',
          flexDirection: 'column' as const,
          fontFamily: 'sans-serif',
        },
        children: [
          // Header
          {
            type: 'div',
            props: {
              style: {
                padding: '40px 40px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column' as const },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                          },
                          children: [
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: 32,
                                  fontWeight: 800,
                                  color: COLORS.white,
                                  letterSpacing: -0.5,
                                },
                                children: 'SoGo',
                              },
                            },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: 32,
                                  fontWeight: 800,
                                  color: COLORS.green,
                                  letterSpacing: -0.5,
                                },
                                children: 'Jet',
                              },
                            },
                          ],
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 13,
                            color: COLORS.muted,
                            letterSpacing: 1,
                            textTransform: 'uppercase' as const,
                            marginTop: 4,
                          },
                          children: 'Flight Deals Board',
                        },
                      },
                    ],
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 14,
                      color: COLORS.muted,
                      letterSpacing: 0.5,
                    },
                    children: dateStr,
                  },
                },
              ],
            },
          },
          // Deals rows
          {
            type: 'div',
            props: {
              style: {
                flex: 1,
                padding: '10px 40px',
                display: 'flex',
                flexDirection: 'column' as const,
              },
              children: rows,
            },
          },
          // Footer
          {
            type: 'div',
            props: {
              style: {
                padding: '20px 40px 40px',
                textAlign: 'center' as const,
                fontSize: 14,
                color: COLORS.muted,
              },
              children: '✈️ sogojet.com — Swipe your next trip',
            },
          },
        ],
      },
    },
    width: w,
    height: h,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (cors(req, res)) return;

  const format = String(req.query.format || 'instagram') as
    | 'instagram'
    | 'twitter';
  const topN = req.query.top ? parseInt(String(req.query.top), 10) : 0;
  const destId = req.query.id ? String(req.query.id) : null;

  try {
    // Board mode — top N deals
    if (topN > 0) {
      const { data: entriesData, error: entriesError } = await supabase
        .from(TABLES.priceCalendar)
        .select('*')
        .gt('deal_score', 50)
        .order('deal_score', { ascending: false })
        .limit(topN * 2);

      if (entriesError) throw entriesError;
      const entries = entriesData ?? [];

      const seen = new Set<string>();
      const deals: Array<{
        origin: string;
        city: string;
        price: number;
        savingsPercent: number | null;
        dealTier: string;
      }> = [];

      for (const doc of entries) {
        const key = doc.destination_iata || doc.city;
        if (seen.has(key)) continue;
        seen.add(key);
        deals.push({
          origin: doc.origin || 'JFK',
          city: escapeStr(doc.city || 'Unknown'),
          price: doc.price ? withMarkup(doc.price as number) : 0,
          savingsPercent: doc.savings_percent || null,
          dealTier: doc.deal_tier || 'fair',
        });
        if (deals.length >= topN) break;
      }

      const { element, width, height } = boardCardElement(deals);
      const imgResponse = new ImageResponse(element, { width, height });
      const buffer = Buffer.from(await imgResponse.arrayBuffer());

      res.setHeader('Content-Type', 'image/png');
      res.setHeader(
        'Cache-Control',
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      );
      return res.status(200).send(buffer);
    }

    // Single deal mode
    if (!destId) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Provide ?id=<destination_id> or ?top=N',
      );
    }

    const { data: dest, error: destError } = await supabase
      .from(TABLES.destinations)
      .select('*')
      .eq('id', destId)
      .single();

    if (destError) throw destError;

    // Try to get price calendar data for deal context
    let dealTier = 'fair';
    let savingsPercent: number | null = null;
    let usualPrice: number | null = null;
    let isNonstop = false;

    try {
      const { data: priceData } = await supabase
        .from(TABLES.priceCalendar)
        .select('*')
        .eq('destination_id', destId)
        .order('deal_score', { ascending: false })
        .limit(1);
      if (priceData && priceData.length > 0) {
        const pd = priceData[0];
        dealTier = pd.deal_tier || 'fair';
        savingsPercent = pd.savings_percent || null;
        usualPrice = pd.usual_price || null;
        isNonstop = pd.is_nonstop || false;
      }
    } catch {
      // OK — proceed without deal context
    }

    const city = escapeStr(dest.city || 'Amazing Destination');
    const country = escapeStr(dest.country || '');
    const rawPrice = (dest.live_price ?? dest.flight_price ?? 0) as number;
    const price = rawPrice > 0 ? withMarkup(rawPrice) : 0;
    const imageUrl =
      dest.image_url ||
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80';
    const airline = escapeStr(dest.airline_name || '');

    const { element, width, height } = singleDealElement(
      city,
      country,
      price,
      imageUrl,
      dealTier,
      savingsPercent,
      usualPrice,
      airline,
      isNonstop,
      format,
    );

    const imgResponse = new ImageResponse(element, { width, height });
    const buffer = Buffer.from(await imgResponse.arrayBuffer());

    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Cache-Control',
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    );
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[share-card] Error:', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal error');
  }
}
