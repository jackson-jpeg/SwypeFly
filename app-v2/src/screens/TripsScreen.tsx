import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts, typography } from '@/tokens';
import { useBookings, type BookingRecord } from '@/hooks/useBookings';
import { useAuthContext } from '@/hooks/AuthContext';
import BottomNav from '@/components/BottomNav';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function isUpcoming(departureDate: string): boolean {
  if (!departureDate) return false;
  const dep = new Date(departureDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dep >= today;
}

function StatusBadge({ status }: { status: string }) {
  const isConfirmed = status === 'confirmed';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 6,
        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: isConfirmed ? `${colors.confirmGreen}20` : status === 'failed' ? '#E5736820' : '#F5ECD7',
        color: isConfirmed ? colors.confirmGreen : status === 'failed' ? colors.terracotta : colors.borderTint,
      }}
    >
      {isConfirmed && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SectionDivider({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      <span
        style={{
          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: colors.borderTint,
          whiteSpace: 'nowrap',
        }}
      >
        {label} ({count})
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: '#C9A99A30' }} />
    </div>
  );
}

function TripCard({ booking }: { booking: BookingRecord }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const depDate = formatDate(booking.departureDate);
  const retDate = formatDate(booking.returnDate);
  const dateRange = depDate && retDate ? `${depDate} - ${retDate}` : depDate || 'Dates TBD';
  const upcoming = isUpcoming(booking.departureDate);

  return (
    <div
      style={{
        backgroundColor: colors.offWhite,
        border: `1px solid ${upcoming ? '#A8C4B830' : '#C9A99A20'}`,
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        ...(upcoming ? { boxShadow: '0 2px 12px #A8C4B818' } : {}),
      }}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((prev) => !prev);
      }}
      onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {/* Top row: route + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontWeight: 800,
                fontSize: 24,
                lineHeight: '28px',
                color: colors.deepDusk,
                textTransform: 'uppercase',
              }}
            >
              {booking.originIata || '???'}
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
            </svg>
            <span
              style={{
                fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                fontWeight: 800,
                fontSize: 24,
                lineHeight: '28px',
                color: colors.deepDusk,
                textTransform: 'uppercase',
              }}
            >
              {booking.destinationIata || '???'}
            </span>
          </div>
          {booking.destinationCity && (
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                color: colors.mutedText,
              }}
            >
              {booking.destinationCity}
            </span>
          )}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: '#C9A99A20' }} />

      {/* Details row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.borderTint }}>
            Dates
          </span>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 500, color: colors.deepDusk }}>
            {dateRange}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.borderTint }}>
            Passengers
          </span>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 500, color: colors.deepDusk }}>
            {booking.passengerCount}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.borderTint }}>
            Total
          </span>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 18, fontWeight: 700, color: colors.deepDusk }}>
            ${booking.totalAmount}
          </span>
        </div>
      </div>

      {/* Bottom row: booking ref + airline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.borderTint }}>
          Ref: {booking.bookingReference || booking.id.slice(0, 8)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {booking.airline && (
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.mutedText }}>
              {booking.airline}
            </span>
          )}
          {/* Expand chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.borderTint}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'transform 0.2s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 1, backgroundColor: '#C9A99A20' }} />

          {/* Flight info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.borderTint }}>
              Flight Details
            </span>

            {/* Outbound */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: '#F5ECD780',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
              </svg>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.deepDusk }}>
                  {booking.originIata} to {booking.destinationIata}
                  {booking.airline ? ` - ${booking.airline}` : ''}
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.mutedText }}>
                  {formatFullDate(booking.departureDate)}
                </span>
              </div>
            </div>

            {/* Return */}
            {booking.returnDate && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: '#F5ECD780',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
                  <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
                </svg>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.deepDusk }}>
                    {booking.destinationIata} to {booking.originIata}
                    {booking.airline ? ` - ${booking.airline}` : ''}
                  </span>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.mutedText }}>
                    {formatFullDate(booking.returnDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Passengers */}
          {booking.passengers && booking.passengers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.borderTint }}>
                Passengers
              </span>
              {booking.passengers.map((pax, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    borderRadius: 10,
                    backgroundColor: `${colors.seafoamMist}18`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: `${colors.sageDrift}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, fontWeight: 700, color: colors.darkerGreen }}>
                      {(pax.givenName?.[0] ?? '').toUpperCase()}{(pax.familyName?.[0] ?? '').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.deepDusk }}>
                      {pax.givenName} {pax.familyName}
                    </span>
                    {pax.email && (
                      <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.mutedText }}>
                        {pax.email}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View full details link */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/booking/confirmation?ref=${booking.bookingReference}`);
            }}
            style={{
              alignSelf: 'stretch',
              height: 40,
              borderRadius: 10,
              backgroundColor: 'transparent',
              border: `1.5px solid ${colors.borderTint}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.deepDusk }}>
              View Confirmation
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyTrips() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 40,
      }}
    >
      {/* Globe + plane illustration */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: `${colors.seafoamMist}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colors.sageDrift} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 22,
            textTransform: 'uppercase',
            color: colors.deepDusk,
            textAlign: 'center',
          }}
        >
          Your Adventures Start Here
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 15,
            lineHeight: '22px',
            color: colors.mutedText,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          Discover amazing destinations, book your flight, and track every trip right here.
        </span>
      </div>
      <button
        onClick={() => navigate('/')}
        style={{
          marginTop: 4,
          height: 52,
          paddingInline: 32,
          borderRadius: 14,
          backgroundColor: colors.deepDusk,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.paleHorizon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.paleHorizon }}>
          Explore Destinations
        </span>
      </button>
    </div>
  );
}

export default function TripsScreen() {
  const { user } = useAuthContext();
  const { data: bookings, isLoading, isError, refetch, isFetching } = useBookings();

  const { upcoming, past } = useMemo(() => {
    if (!bookings?.length) return { upcoming: [], past: [] };
    const up: BookingRecord[] = [];
    const pa: BookingRecord[] = [];
    for (const b of bookings) {
      if (isUpcoming(b.departureDate)) {
        up.push(b);
      } else {
        pa.push(b);
      }
    }
    return { upcoming: up, past: pa };
  }, [bookings]);

  const hasBookings = !!bookings?.length;

  return (
    <div
      className="screen-fixed"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingInline: 20,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1
            style={{
              ...typography.pageTitle,
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              color: colors.deepDusk,
              margin: 0,
            }}
          >
            My Trips
          </h1>
          {user && (
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.mutedText }}>
              {user.name || user.email}
            </span>
          )}
        </div>

        {/* Refresh button */}
        {hasBookings && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh trips"
            style={{
              marginTop: 4,
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.offWhite,
              border: `1px solid #C9A99A30`,
              cursor: isFetching ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isFetching ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.deepDusk}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: isFetching ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingInline: 20,
          paddingBottom: 16,
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="shimmer"
                style={{
                  height: 160,
                  borderRadius: 16,
                  backgroundColor: '#C9A99A15',
                }}
              />
            ))}
          </div>
        ) : isError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.terracotta }}>
              Failed to load trips. Please try again.
            </span>
            <button
              onClick={() => refetch()}
              style={{
                height: 40,
                paddingInline: 20,
                borderRadius: 10,
                backgroundColor: 'transparent',
                border: `1.5px solid ${colors.terracotta}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.terracotta }}>
                Retry
              </span>
            </button>
          </div>
        ) : !hasBookings ? (
          <EmptyTrips />
        ) : (
          <>
            {/* Upcoming section */}
            {upcoming.length > 0 && (
              <>
                <SectionDivider label="Upcoming" count={upcoming.length} />
                {upcoming.map((b) => <TripCard key={b.id} booking={b} />)}
              </>
            )}

            {/* Past section */}
            {past.length > 0 && (
              <>
                <SectionDivider label="Past" count={past.length} />
                {past.map((b) => <TripCard key={b.id} booking={b} />)}
              </>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
