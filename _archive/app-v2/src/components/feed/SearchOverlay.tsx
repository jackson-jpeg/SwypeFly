import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useFeedStore } from '@/stores/feedStore';
import { useUIStore } from '@/stores/uiStore';
import { apiFetch, USE_STUBS } from '@/api/client';
import { getStubFeed } from '@/api/stubs';
import type { Destination } from '@/api/types';
import type { DestinationFeedPage } from '@/api/types';

export default function SearchOverlay() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    searchQuery,
    setSearchQuery,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    setSearchOpen,
  } = useFeedStore();
  const departureCode = useUIStore((s) => s.departureCode);

  const [results, setResults] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autofocus
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Debounced search
  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        let data: DestinationFeedPage;
        if (USE_STUBS) {
          data = await getStubFeed(0, 10);
          // Filter stubs client-side for search
          data = {
            ...data,
            destinations: data.destinations.filter(
              (d) =>
                d.city.toLowerCase().includes(query.toLowerCase()) ||
                d.country.toLowerCase().includes(query.toLowerCase()),
            ),
          };
        } else {
          const params = new URLSearchParams({ origin: departureCode, search: query.trim() });
          data = await apiFetch<DestinationFeedPage>(`/api/feed?${params.toString()}`);
        }
        setResults(data.destinations);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [departureCode],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localQuery);
      search(localQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localQuery, search, setSearchQuery]);

  const handleSelect = (dest: Destination) => {
    addRecentSearch(dest.city);
    setSearchOpen(false);
    navigate(`/destination/${dest.id}`);
  };

  const handleRecentTap = (query: string) => {
    setLocalQuery(query);
  };

  const close = () => {
    setSearchOpen(false);
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 30,
    backgroundColor: 'rgba(10,15,30,0.95)',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 640,
    margin: '0 auto',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid #FFFFFF14',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    height: 40,
    paddingInline: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF0F',
    border: '1px solid #FFFFFF1F',
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
    outline: 'none',
  };

  const iconBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  };

  return (
    <div style={overlayStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button onClick={close} style={iconBtnStyle} aria-label="Close search">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFFCC" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search destinations..."
          style={inputStyle}
        />
        {localQuery && (
          <button onClick={() => setLocalQuery('')} style={iconBtnStyle} aria-label="Clear search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF80" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {/* Recent searches (when no query typed) */}
        {!localQuery.trim() && recentSearches.length > 0 && (
          <div style={{ padding: '8px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#FFFFFF60',
              }}>
                Recent Searches
              </span>
              <button
                onClick={clearRecentSearches}
                style={{ fontSize: 12, color: '#FFFFFF50', cursor: 'pointer', padding: 0 }}
              >
                Clear
              </button>
            </div>
            {recentSearches.map((q) => (
              <button
                key={q}
                onClick={() => handleRecentTap(q)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 0',
                  cursor: 'pointer',
                  borderBottom: '1px solid #FFFFFF0A',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF50" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 15, color: '#FFFFFFCC',
                }}>
                  {q}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && localQuery.trim() && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <span style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14, color: '#FFFFFF50',
            }}>
              Searching...
            </span>
          </div>
        )}

        {/* Results */}
        {!loading && localQuery.trim() && results.length > 0 && (
          <div>
            {results.map((dest) => (
              <button
                key={dest.id}
                onClick={() => handleSelect(dest)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  width: '100%',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #FFFFFF0A',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    flexShrink: 0,
                    backgroundImage: `url(${dest.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: '#FFFFFF14',
                  }}
                />
                {/* Info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                  <span style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 15, fontWeight: 600, color: '#FFFFFF',
                  }}>
                    {dest.city}
                  </span>
                  <span style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 12, color: '#FFFFFF70',
                  }}>
                    {dest.country}
                  </span>
                </div>
                {/* Price */}
                <span style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 16, fontWeight: 700, color: colors.sunriseButter,
                  flexShrink: 0,
                }}>
                  ${dest.flightPrice}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && localQuery.trim() && results.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <span style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14, color: '#FFFFFF50',
            }}>
              No destinations found
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
