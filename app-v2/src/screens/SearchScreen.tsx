import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useBookingStore } from '@/stores/bookingStore';
import { useSearchDeals, type Deal } from '@/hooks/useSearchDeals';
import { getAirlineName } from '@/utils/airlines';
import { colors, typography, fonts, spacing, radius, surfaces, useThemeColors } from '@/tokens';
import BottomNav from '@/components/BottomNav';

const REGIONS = [
  { value: '', label: 'All Regions' },
  { value: 'domestic', label: 'Domestic' },
  { value: 'caribbean', label: 'Caribbean' },
  { value: 'latam', label: 'Latin America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'africa-me', label: 'Africa & ME' },
  { value: 'oceania', label: 'Oceania' },
];

const SORT_OPTIONS: { value: 'cheapest' | 'trending' | 'newest'; label: string }[] = [
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
];

const IMAGE_FALLBACK =
  'linear-gradient(135deg, #1a2a3a 0%, #2d1b3d 40%, #1a3a2a 70%, #0A0F1E 100%)';

export default function SearchScreen() {
  const t = useThemeColors();
  const departureCode = useUIStore((s) => s.departureCode);
  const navigate = useNavigate();
  const setDestination = useBookingStore((s) => s.setDestination);
  const setCachedOffer = useBookingStore((s) => s.setCachedOffer);

  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState<'cheapest' | 'trending' | 'newest'>('cheapest');
  const [maxPrice, setMaxPrice] = useState(5000);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedAirlines, setSelectedAirlines] = useState<Set<string>>(new Set());

  const queryParams = useMemo(
    () => ({
      origin: departureCode,
      search: search || undefined,
      region: region || undefined,
      maxPrice: maxPrice < 5000 ? maxPrice : undefined,
      sort,
    }),
    [departureCode, search, region, maxPrice, sort],
  );

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSearchDeals(queryParams);

  const allDeals = useMemo(
    () => data?.pages.flatMap((p) => p.deals) ?? [],
    [data],
  );

  // Extract unique airlines from current results
  const availableAirlines = useMemo(() => {
    const codes = new Set<string>();
    for (const d of allDeals) {
      if (d.airline) codes.add(d.airline);
    }
    return Array.from(codes).sort((a, b) =>
      getAirlineName(a).localeCompare(getAirlineName(b)),
    );
  }, [allDeals]);

  const toggleAirline = useCallback((code: string) => {
    setSelectedAirlines((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // Apply client-side airline filter
  const deals = useMemo(() => {
    if (selectedAirlines.size === 0) return allDeals;
    return allDeals.filter((d) => selectedAirlines.has(d.airline));
  }, [allDeals, selectedAirlines]);

  const handleBookDeal = useCallback(
    (deal: Deal) => {
      setDestination(deal.destinationId, deal.price);
      if (deal.offerJson) setCachedOffer(deal.offerJson);
      navigate('/booking/flights', {
        state: {
          fromSearch: true,
          departureDate: deal.departureDate,
          returnDate: deal.returnDate,
          destinationIata: deal.iataCode,
        },
      });
    },
    [setDestination, setCachedOffer, navigate],
  );

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
      <div style={{ padding: `${spacing.md}px ${spacing.sm}px ${spacing.xs}px` }}>
        <h1
          style={{
            ...typography.pageTitle,
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            color: t.primary,
            margin: 0,
          }}
        >
          Search Deals
        </h1>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          padding: `0 ${spacing.sm}px ${spacing.sm}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.xs,
        }}
      >
        {/* Search + Region row */}
        <div style={{ display: 'flex', gap: spacing.xs }}>
          <input
            type="text"
            placeholder="Search destinations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              height: 42,
              borderRadius: radius.md,
              border: `1px solid ${t.border}`,
              background: t.surface,
              padding: '0 12px',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              color: t.primary,
              outline: 'none',
            }}
          />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              height: 42,
              borderRadius: radius.md,
              border: `1px solid ${t.border}`,
              background: t.surface,
              padding: '0 10px',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              color: t.primary,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort pills */}
        <div style={{ display: 'flex', gap: 8 }}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              style={{
                height: 32,
                borderRadius: radius.pill,
                border:
                  sort === opt.value
                    ? `1.5px solid ${t.accent}`
                    : `1px solid ${t.border}`,
                background: sort === opt.value ? t.accentSoft : t.surface,
                padding: '0 14px',
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 12,
                fontWeight: sort === opt.value ? 600 : 500,
                color: sort === opt.value ? t.accent : t.body,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Price slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              ...typography.sectionLabel,
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              color: t.muted,
              whiteSpace: 'nowrap',
            }}
          >
            MAX PRICE
          </span>
          <input
            type="range"
            min={0}
            max={5000}
            step={50}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            style={{ flex: 1, accentColor: t.accent }}
          />
          <span
            style={{
              ...typography.secondary,
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              color: t.primary,
              fontWeight: 700,
              minWidth: 50,
              textAlign: 'right',
            }}
          >
            {maxPrice >= 5000 ? 'Any' : `$${maxPrice}`}
          </span>
        </div>

        {/* Airline filter chips */}
        {availableAirlines.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  ...typography.sectionLabel,
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  color: t.muted,
                }}
              >
                AIRLINES
              </span>
              {selectedAirlines.size > 0 && (
                <button
                  onClick={() => setSelectedAirlines(new Set())}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.terracotta,
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {availableAirlines.map((code) => {
                const isSelected = selectedAirlines.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => toggleAirline(code)}
                    style={{
                      height: 30,
                      borderRadius: radius.pill,
                      border: isSelected
                        ? `1.5px solid ${t.accent}`
                        : `1px solid ${t.border}`,
                      background: isSelected ? t.accentSoft : t.surface,
                      padding: '0 12px',
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 11,
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? t.accent : t.body,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {getAirlineName(code)}
                    {isSelected && (
                      <span style={{ fontSize: 13, lineHeight: 1 }}>x</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
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
            Finding deals...
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
              padding: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                ...typography.subheadline,
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                color: t.primary,
              }}
            >
              No deals found
            </span>
            <span
              style={{
                ...typography.secondary,
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                color: t.muted,
              }}
            >
              Try adjusting your filters or search for a different destination
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
              const isExpanded = expandedId === deal.destinationId;
              return (
                <div
                  key={deal.destinationId}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : deal.destinationId)
                  }
                  style={{
                    ...surfaces.card,
                    gridColumn: isExpanded ? '1 / -1' : undefined,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {/* Image */}
                  <div
                    style={{
                      width: '100%',
                      height: isExpanded ? 200 : 140,
                      background: deal.imageUrl
                        ? `url(${deal.imageUrl}) center/cover no-repeat`
                        : IMAGE_FALLBACK,
                      position: 'relative',
                      transition: 'height 0.25s ease',
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
                        ${deal.price}
                      </span>
                    </div>

                    {/* Price direction indicator */}
                    {deal.priceDirection && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background:
                            deal.priceDirection === 'down'
                              ? t.accent
                              : colors.terracotta,
                          borderRadius: radius.sm,
                          padding: '2px 6px',
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#fff',
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        }}
                      >
                        {deal.priceDirection === 'down' ? 'Price Drop' : 'Rising'}
                      </div>
                    )}

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
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <div>
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
                      </div>
                      <div
                        style={{
                          ...typography.secondary,
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          color: t.muted,
                          fontSize: 11,
                          textAlign: 'right',
                        }}
                      >
                        <div>{getAirlineName(deal.airline)}</div>
                        <div>
                          {deal.departureDate
                            ? new Date(deal.departureDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                          {deal.returnDate
                            ? ` - ${new Date(deal.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: `1px solid ${t.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <InfoChip label="Airline" value={getAirlineName(deal.airline)} />
                          <InfoChip
                            label="Duration"
                            value={`${deal.tripDurationDays} day${deal.tripDurationDays !== 1 ? 's' : ''}`}
                          />
                          <InfoChip
                            label="Source"
                            value={deal.priceSource === 'duffel' ? 'Live Price' : 'Estimate'}
                          />
                          {deal.previousPrice && deal.previousPrice !== deal.price && (
                            <InfoChip
                              label="Was"
                              value={`$${deal.previousPrice}`}
                              strike
                            />
                          )}
                        </div>

                        {deal.vibeTags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {deal.vibeTags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                                  color: t.accent,
                                  background: t.accentSoft,
                                  borderRadius: radius.pill,
                                  padding: '3px 8px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookDeal(deal);
                          }}
                          style={{
                            height: 44,
                            borderRadius: radius.md,
                            border: 'none',
                            background: t.ctaBg,
                            color: t.ctaText,
                            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                            fontWeight: 600,
                            fontSize: 15,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          Book This Deal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div style={{ textAlign: 'center', padding: `${spacing.md}px 0` }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                height: 40,
                borderRadius: radius.pill,
                border: `1.5px solid ${t.border}`,
                background: 'transparent',
                padding: '0 24px',
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 13,
                fontWeight: 600,
                color: t.body,
                cursor: isFetchingNextPage ? 'default' : 'pointer',
                opacity: isFetchingNextPage ? 0.6 : 1,
              }}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More Deals'}
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

/* Small helper component for expanded info chips */
function InfoChip({
  label,
  value,
  strike,
}: {
  label: string;
  value: string;
  strike?: boolean;
}) {
  const t = useThemeColors();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: t.border,
        borderRadius: radius.sm,
        padding: '4px 10px',
      }}
    >
      <span
        style={{
          ...typography.sectionLabel,
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          color: t.muted,
          fontSize: 9,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 13,
          fontWeight: 600,
          color: t.primary,
          textDecoration: strike ? 'line-through' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
