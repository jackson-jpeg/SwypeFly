import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { useUIStore } from '@/stores/uiStore';
import { getAirlineName } from '@/utils/airlines';
import type { Destination } from '@/api/types';
import { colors, typography, fonts, spacing, radius, surfaces, useThemeColors } from '@/tokens';
import BottomNav from '@/components/BottomNav';

const IMAGE_FALLBACK =
  'linear-gradient(135deg, #1a2a3a 0%, #2d1b3d 40%, #1a3a2a 70%, #0A0F1E 100%)';

interface BudgetResponse {
  destinations: Destination[];
  budget: { min: number; max: number };
  totalResults: number;
  matchedDestinations: number;
}

type SortMode = 'price' | 'destination';

export default function DealsScreen() {
  const t = useThemeColors();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeOrigin = useUIStore((s) => s.departureCode);

  const max = Number(searchParams.get('max')) || 500;
  const origin = searchParams.get('origin') || storeOrigin;

  const [sortMode, setSortMode] = useState<SortMode>('price');
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery<BudgetResponse>({
    queryKey: ['hot-deals', origin, max],
    queryFn: () =>
      apiFetch<BudgetResponse>(
        `/api/feed?action=budget&origin=${encodeURIComponent(origin)}&maxPrice=${max}`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  const deals = useMemo(() => {
    if (!data?.destinations) return [];
    const sorted = [...data.destinations];
    if (sortMode === 'price') {
      sorted.sort((a, b) => (a.livePrice ?? a.flightPrice) - (b.livePrice ?? b.flightPrice));
    } else {
      sorted.sort((a, b) => a.city.localeCompare(b.city));
    }
    return sorted;
  }, [data, sortMode]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Flights Under $${max}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled share or clipboard failed
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Nothing we can do
      }
    }
  }, [max]);

  return (
    <div
      className="screen"
      style={{
        background: t.canvas,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${spacing.md}px ${spacing.sm}px ${spacing.xs}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1
              style={{
                ...typography.pageTitle,
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                color: t.primary,
                margin: 0,
                fontSize: 28,
              }}
            >
              Flights Under ${max}
            </h1>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
                background: t.accentSoft,
                borderRadius: radius.pill,
                padding: '3px 10px',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={t.accent}
                strokeWidth="2"
              >
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
              </svg>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.accent,
                }}
              >
                From {origin}
              </span>
            </div>
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          aria-label="Share deals"
          style={{
            height: 36,
            borderRadius: radius.pill,
            border: `1.5px solid ${t.border}`,
            background: copied ? t.accentSoft : 'transparent',
            padding: '0 14px',
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 12,
            fontWeight: 600,
            color: copied ? t.accent : t.body,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {/* Sort toggle */}
      <div
        style={{
          padding: `0 ${spacing.sm}px ${spacing.sm}px`,
          display: 'flex',
          gap: 8,
        }}
      >
        {(['price', 'destination'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            style={{
              height: 32,
              borderRadius: radius.pill,
              border:
                sortMode === mode
                  ? `1.5px solid ${t.accent}`
                  : `1px solid ${t.border}`,
              background: sortMode === mode ? t.accentSoft : t.surface,
              padding: '0 14px',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              fontWeight: sortMode === mode ? 600 : 500,
              color: sortMode === mode ? t.accent : t.body,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {mode === 'price' ? 'Cheapest First' : 'A-Z Destination'}
          </button>
        ))}
        {data && (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              fontWeight: 500,
              color: t.muted,
              alignSelf: 'center',
            }}
          >
            {deals.length} deal{deals.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: `0 ${spacing.sm}px`, paddingBottom: 100 }}>
        {isLoading && (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              ...typography.secondary,
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              color: t.muted,
            }}
          >
            Finding hot deals...
          </div>
        )}

        {isError && (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              ...typography.secondary,
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              color: colors.terracotta,
            }}
          >
            Failed to load deals. Please try again.
          </div>
        )}

        {!isLoading && !isError && deals.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.muted}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span
              style={{
                ...typography.subheadline,
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                color: t.primary,
              }}
            >
              No deals under ${max}
            </span>
            <span
              style={{
                ...typography.secondary,
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                color: t.muted,
                maxWidth: 280,
              }}
            >
              Try increasing your budget or check back later for new deals from {origin}
            </span>
          </div>
        )}

        {deals.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: spacing.xs,
            }}
          >
            {deals.map((deal) => {
              const price = deal.livePrice ?? deal.flightPrice;
              return (
                <div
                  key={deal.id}
                  onClick={() => navigate(`/destination/${deal.id}`)}
                  style={{
                    ...surfaces.card,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  {/* Image */}
                  <div
                    style={{
                      width: '100%',
                      height: 140,
                      background: deal.imageUrl
                        ? `url(${deal.imageUrl}) center/cover no-repeat`
                        : IMAGE_FALLBACK,
                      position: 'relative',
                    }}
                  >
                    {/* Price badge */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.65)',
                        borderRadius: radius.sm,
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 2,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontWeight: 800,
                          fontSize: 18,
                          color: '#fff',
                        }}
                      >
                        ${price}
                      </span>
                    </div>

                    {/* Source badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: radius.sm,
                        padding: '2px 6px',
                        fontSize: 9,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.8)',
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {deal.priceSource === 'duffel' ? 'LIVE' : 'EST.'}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '10px 12px' }}>
                    <div
                      style={{
                        ...typography.subheadline,
                        fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                        color: t.primary,
                      }}
                    >
                      {deal.city}
                    </div>
                    <div
                      style={{
                        ...typography.secondary,
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        color: t.muted,
                        fontSize: 12,
                      }}
                    >
                      {deal.country}
                    </div>

                    {/* Airline + dates */}
                    <div
                      style={{
                        marginTop: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      {deal.airline && (
                        <span
                          style={{
                            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                            fontSize: 11,
                            fontWeight: 600,
                            color: t.body,
                          }}
                        >
                          {getAirlineName(deal.airline)}
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 10,
                          color: t.muted,
                        }}
                      >
                        {deal.departureDate
                          ? new Date(deal.departureDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                        {deal.returnDate
                          ? ` - ${new Date(deal.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : ''}
                      </span>
                    </div>

                    {/* Affiliate link */}
                    {deal.affiliateUrl && (
                      <a
                        href={deal.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'block',
                          marginTop: 8,
                          textAlign: 'center',
                          padding: '6px 0',
                          borderRadius: radius.sm,
                          background: t.accentSoft,
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.accent,
                          textDecoration: 'none',
                        }}
                      >
                        Book on Aviasales
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
