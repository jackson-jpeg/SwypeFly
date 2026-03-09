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

function TripCard({ booking }: { booking: BookingRecord }) {
  const navigate = useNavigate();
  const depDate = formatDate(booking.departureDate);
  const retDate = formatDate(booking.returnDate);
  const dateRange = depDate && retDate ? `${depDate} – ${retDate}` : depDate || 'Dates TBD';

  return (
    <div
      onClick={() => navigate(`/booking/confirmation?ref=${booking.bookingReference}`)}
      style={{
        backgroundColor: colors.offWhite,
        border: '1px solid #C9A99A20',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
        transition: 'transform 0.15s ease',
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
        {booking.airline && (
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.mutedText }}>
            {booking.airline}
          </span>
        )}
      </div>
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
        gap: 16,
        padding: 40,
      }}
    >
      <div style={{ fontSize: 48, lineHeight: '56px' }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
        </svg>
      </div>
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
        No Trips Yet
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
        Book your first flight and it will appear here. Your boarding pass, itinerary, and booking details — all in one place.
      </span>
      <button
        onClick={() => navigate('/')}
        style={{
          marginTop: 8,
          height: 48,
          paddingInline: 28,
          borderRadius: 14,
          backgroundColor: colors.deepDusk,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.paleHorizon }}>
          Explore Destinations
        </span>
      </button>
    </div>
  );
}

export default function TripsScreen() {
  const { user } = useAuthContext();
  const { data: bookings, isLoading, isError } = useBookings();

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
          flexDirection: 'column',
          gap: 4,
        }}
      >
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
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.terracotta }}>
              Failed to load trips. Please try again.
            </span>
          </div>
        ) : !bookings?.length ? (
          <EmptyTrips />
        ) : (
          bookings.map((b) => <TripCard key={b.id} booking={b} />)
        )}
      </div>

      <BottomNav />
    </div>
  );
}
