import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useAuthContext } from '@/hooks/AuthContext';
import { useUIStore } from '@/stores/uiStore';
import { apiFetch } from '@/api/client';
import BottomNav from '@/components/BottomNav';

interface Alert {
  id: string;
  destinationId: string;
  targetPrice: number;
  isActive: boolean;
  createdAt: string;
  triggeredAt: string | null;
  triggeredPrice: number | null;
}

interface DestinationInfo {
  city: string;
  country: string;
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.terracotta} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function BellIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function AlertsScreen() {
  const navigate = useNavigate();
  const { session, isGuest } = useAuthContext();
  const departureCode = useUIStore((s) => s.departureCode);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [destInfo, setDestInfo] = useState<Record<string, DestinationInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<{ alerts: Alert[]; total: number }>('/api/alerts?action=list');
      setAlerts(data.alerts);

      // Fetch destination info for each unique destinationId
      const uniqueIds = [...new Set(data.alerts.map((a) => a.destinationId))];
      const infoMap: Record<string, DestinationInfo> = {};
      await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const dest = await apiFetch<{ id: string; city: string; country: string }>(
              `/api/destination?id=${id}&origin=${departureCode}`,
            );
            infoMap[id] = { city: dest.city, country: dest.country };
          } catch {
            // Fallback — just show the ID
          }
        }),
      );
      setDestInfo(infoMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [departureCode]);

  useEffect(() => {
    if (!session && !isGuest) return;
    fetchAlerts();
  }, [session, isGuest, fetchAlerts]);

  const handleDelete = async (alertId: string) => {
    setDeletingId(alertId);
    try {
      await apiFetch('/api/alerts?action=delete', {
        method: 'DELETE',
        body: JSON.stringify({ alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = alerts.filter((a) => a.isActive).length;

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 24, paddingRight: 24, paddingTop: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: '#F2CEBC40',
              border: '1px solid #C9A99A40',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <BackArrow />
          </button>
          <h1
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 34,
              lineHeight: '40px',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              color: colors.deepDusk,
              margin: 0,
            }}
          >
            Price Alerts
          </h1>
        </div>

        {/* Stats pill */}
        {!loading && alerts.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: activeCount > 0 ? '#C8DDD430' : '#F2CEBC40',
                border: `1px solid ${activeCount > 0 ? '#C8DDD440' : '#C9A99A40'}`,
                borderRadius: 16,
                paddingBlock: 6,
                paddingInline: 12,
              }}
            >
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: '16px',
                  color: activeCount > 0 ? colors.darkerGreen : colors.borderTint,
                }}
              >
                {activeCount} active alert{activeCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 24px', flex: 1 }}>
        {/* Loading state */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: colors.offWhite,
                  borderRadius: 14,
                  height: 88,
                  opacity: 0.6,
                  animation: 'shimmer 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div
            style={{
              backgroundColor: '#F2CEBC',
              border: '1px solid #C9A99A40',
              borderRadius: 14,
              padding: 16,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                color: colors.terracotta,
              }}
            >
              {error}
            </span>
            <button
              onClick={() => { setLoading(true); fetchAlerts(); }}
              style={{
                display: 'block',
                margin: '10px auto 0',
                backgroundColor: 'transparent',
                border: `1.5px solid ${colors.terracotta}`,
                borderRadius: 10,
                padding: '6px 16px',
                cursor: 'pointer',
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 13,
                fontWeight: 600,
                color: colors.terracotta,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && alerts.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <BellIcon />
            <h3
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                color: colors.deepDusk,
                fontSize: 20,
                fontWeight: 700,
                textTransform: 'uppercase',
                margin: '16px 0 0 0',
              }}
            >
              No price alerts yet
            </h3>
            <p
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                color: colors.mutedText,
                fontSize: 14,
                lineHeight: '22px',
                margin: '8px 0 24px 0',
                maxWidth: 280,
              }}
            >
              Browse destinations and set alerts to track prices. We'll notify you when fares drop.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 44,
                paddingInline: 24,
                borderRadius: 12,
                backgroundColor: colors.deepDusk,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 15,
                  fontWeight: 600,
                  color: colors.paleHorizon,
                }}
              >
                Browse Destinations
              </span>
            </button>
          </div>
        )}

        {/* Alert cards */}
        {!loading && alerts.map((alert) => {
          const info = destInfo[alert.destinationId];
          const cityName = info?.city ?? `Destination #${alert.destinationId}`;
          const countryName = info?.country ?? '';
          const isDeleting = deletingId === alert.id;
          const dropPercent =
            alert.triggeredPrice && alert.targetPrice > 0
              ? Math.round(((alert.targetPrice - alert.triggeredPrice) / alert.targetPrice) * 100)
              : null;

          return (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                backgroundColor: colors.offWhite,
                border: '1px solid #C9A99A20',
                borderRadius: 14,
                overflow: 'clip',
                opacity: isDeleting ? 0.5 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {/* Status indicator bar */}
              <div
                style={{
                  width: 4,
                  flexShrink: 0,
                  backgroundColor: alert.isActive
                    ? colors.confirmGreen
                    : alert.triggeredAt
                      ? colors.terracotta
                      : colors.borderTint,
                }}
              />

              {/* Card content */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flex: 1,
                  padding: '14px 12px 14px 14px',
                  gap: 12,
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/destination/${alert.destinationId}`)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                  {/* City name */}
                  <span
                    style={{
                      fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                      fontSize: 16,
                      fontWeight: 800,
                      lineHeight: '20px',
                      letterSpacing: '-0.01em',
                      textTransform: 'uppercase',
                      color: colors.deepDusk,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cityName}
                  </span>

                  {/* Country + date */}
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 12,
                      lineHeight: '16px',
                      color: colors.mutedText,
                    }}
                  >
                    {countryName ? `${countryName} · ` : ''}Created {formatDate(alert.createdAt)}
                  </span>

                  {/* Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    {alert.isActive && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: '#C8DDD430',
                          border: '1px solid #C8DDD440',
                          borderRadius: 10,
                          paddingBlock: 2,
                          paddingInline: 8,
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: '16px',
                          color: colors.darkerGreen,
                        }}
                      >
                        Active
                      </span>
                    )}
                    {!alert.isActive && alert.triggeredAt && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: '#F2CEBC40',
                          border: '1px solid #C9A99A40',
                          borderRadius: 10,
                          paddingBlock: 2,
                          paddingInline: 8,
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: '16px',
                          color: colors.terracotta,
                        }}
                      >
                        Triggered at ${alert.triggeredPrice}
                        {dropPercent != null && dropPercent > 0 ? ` (-${dropPercent}%)` : ''}
                      </span>
                    )}
                    {!alert.isActive && !alert.triggeredAt && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: '#C9A99A20',
                          borderRadius: 10,
                          paddingBlock: 2,
                          paddingInline: 8,
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: '16px',
                          color: colors.mutedText,
                        }}
                      >
                        Expired
                      </span>
                    )}
                  </div>
                </div>

                {/* Target price + delete */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        lineHeight: '12px',
                        textTransform: 'uppercase',
                        color: colors.mutedText,
                      }}
                    >
                      Target
                    </span>
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 20,
                        fontWeight: 800,
                        lineHeight: '24px',
                        color: colors.deepDusk,
                      }}
                    >
                      ${alert.targetPrice}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(alert.id);
                    }}
                    disabled={isDeleting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: '#F2CEBC30',
                      border: '1px solid #C9A99A30',
                      cursor: isDeleting ? 'default' : 'pointer',
                      padding: 0,
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
