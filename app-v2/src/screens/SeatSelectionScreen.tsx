import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useBookingStore } from '@/stores/bookingStore';
import { getStubDestination } from '@/api/stubs';

/* ───── shared booking header ───── */
function BookingHeader({
  step,
  stepName,
  bgImage,
  onBack,
  onClose,
}: {
  step: number;
  stepName: string;
  bgImage?: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 20,
          paddingTop: 56,
          paddingBottom: 8,
        }}
      >
        <button onClick={onBack} style={{ padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontSize: 15,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: colors.deepDusk,
            letterSpacing: '0.04em',
          }}
        >
          SoGoJet
        </span>
        <button onClick={onClose} style={{ padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div style={{ position: 'relative', height: 60 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgImage || 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=600'})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15,
          }}
        />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, paddingInline: 20, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, fontWeight: 600, color: colors.sageDrift }}>
              Step {step} of 6
            </span>
            <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.borderTint }}>
              {stepName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: s <= step ? colors.sageDrift : colors.warmDusk,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───── seat map data ───── */
type SeatState = 'available' | 'occupied' | 'extra';

// deterministic occupied pattern per the design screenshot
const occupiedPattern: Record<string, SeatState> = {
  '13-A': 'occupied',
  '13-E': 'occupied',
  '13-F': 'occupied',
  '14-E': 'occupied',
  '15-A': 'extra',
  '15-B': 'extra',
  '15-C': 'occupied',
  '15-D': 'extra',
  '15-E': 'extra',
  '15-F': 'extra',
  '16-A': 'occupied',
  '16-B': 'occupied',
  '16-D': 'occupied',
  '16-E': 'occupied',
  '17-C': 'occupied',
  '17-E': 'occupied',
};

const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
const rows = [12, 13, 14, 15, 16, 17];

function getSeatState(row: number, col: string): SeatState {
  return occupiedPattern[`${row}-${col}`] || 'available';
}

function seatBg(state: SeatState, selected: boolean): string {
  if (selected) return colors.confirmGreen;
  switch (state) {
    case 'occupied': return '#D4CCC0';
    case 'extra': return '#E3EDE7';
    default: return '#F0EBE3';
  }
}

function seatBorder(state: SeatState, selected: boolean): string {
  if (selected) return 'none';
  switch (state) {
    case 'occupied': return 'none';
    case 'extra': return '1px solid #C5D6CB';
    default: return '1px solid #D4CCC0';
  }
}

/* ───── screen ───── */
export default function SeatSelectionScreen() {
  const navigate = useNavigate();
  const booking = useBookingStore();
  const storeSeat = booking.setSeat;
  const dest = getStubDestination(booking.destinationId ?? '2');
  const [selectedSeat, setSelectedSeat] = useState<string | null>('14-C');

  const handleSeatClick = (row: number, col: string) => {
    const state = getSeatState(row, col);
    if (state === 'occupied') return;
    const key = `${row}-${col}`;
    setSelectedSeat(selectedSeat === key ? null : key);
  };

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BookingHeader
        step={3}
        stepName="Seat Selection"
        bgImage={dest?.imageUrl}
        onBack={() => navigate(-1)}
        onClose={() => navigate('/')}
      />

      {/* scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          paddingInline: 20,
          paddingTop: 12,
          paddingBottom: 24,
        }}
      >
        {/* legend */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', alignSelf: 'flex-start' }}>
          {[
            { label: 'Available', color: '#F0EBE3', border: '1px solid #D4CCC0' },
            { label: 'Selected', color: colors.confirmGreen, border: 'none' },
            { label: 'Occupied', color: '#D4CCC0', border: 'none' },
            { label: 'Extra leg', color: '#E3EDE7', border: '1px solid #C5D6CB' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: item.color,
                  border: item.border,
                }}
              />
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 10,
                  color: colors.mutedText,
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* fuselage */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '1.5px solid #D4CCC0',
            borderTopLeftRadius: 60,
            borderTopRightRadius: 60,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            paddingTop: 28,
            paddingBottom: 16,
            paddingInline: 20,
            width: 260,
          }}
        >
          {/* airplane icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
          </svg>

          {/* column headers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 6, width: '100%' }}>
            <div style={{ width: 20 }} />
            {columns.map((c, i) => (
              <div
                key={c}
                style={{
                  width: 26,
                  textAlign: 'center',
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 9,
                  color: colors.mutedText,
                  ...(i === 3 ? { marginLeft: 12 } : {}),
                }}
              >
                {c}
              </div>
            ))}
          </div>

          {/* seat rows */}
          {rows.map((row) => (
            <div key={row}>
              {/* EXIT row between row 13 and 14 */}
              {row === 14 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBlock: 6 }}>
                  <div style={{ flex: 1, height: 1.5, backgroundColor: colors.confirmGreen }} />
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 8,
                      fontWeight: 700,
                      color: colors.confirmGreen,
                      letterSpacing: '0.1em',
                    }}
                  >
                    EXIT
                  </span>
                  <div style={{ flex: 1, height: 1.5, backgroundColor: colors.confirmGreen }} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
                {/* row number */}
                <span
                  style={{
                    width: 20,
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 9,
                    color: selectedSeat?.startsWith(`${row}-`) ? colors.sageDrift : '#B5ADA3',
                    textAlign: 'center',
                  }}
                >
                  {row}
                </span>
                {columns.map((col, colIdx) => {
                  const state = getSeatState(row, col);
                  const key = `${row}-${col}`;
                  const isSelected = selectedSeat === key;
                  const isClickable = state !== 'occupied';

                  return (
                    <div
                      key={col}
                      style={{ ...(colIdx === 3 ? { marginLeft: 12 } : {}) }}
                    >
                      <button
                        onClick={() => handleSeatClick(row, col)}
                        disabled={!isClickable}
                        style={{
                          width: 26,
                          height: 26,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                          borderBottomLeftRadius: 6,
                          borderBottomRightRadius: 6,
                          backgroundColor: seatBg(state, isSelected),
                          border: seatBorder(state, isSelected),
                          cursor: isClickable ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* selection confirmation */}
        {selectedSeat && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.offWhite,
              border: '1px solid #C9A99A20',
              borderRadius: 14,
              paddingBlock: 14,
              paddingInline: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 15,
                  fontWeight: 600,
                  color: colors.deepDusk,
                }}
              >
                Seat {selectedSeat.replace('-', '')} — {(() => { const col = selectedSeat.split('-')[1]; return col === 'A' || col === 'F' ? 'Window' : col === 'C' || col === 'D' ? 'Aisle' : 'Middle'; })()}
              </span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 13,
                  color: colors.borderTint,
                }}
              >
                Standard seat · No extra charge
              </span>
            </div>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        )}
      </div>

      {/* CTA area */}
      <div style={{ paddingInline: 20, paddingBottom: 32, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button
          onClick={() => { storeSeat(selectedSeat ? selectedSeat.replace('-', '') : null); navigate('/booking/extras'); }}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 16,
              fontWeight: 600,
              color: colors.paleHorizon,
            }}
          >
            Continue to Bags & Extras
          </span>
        </button>
        <button
          onClick={() => { storeSeat(null); navigate('/booking/extras'); }}
          style={{ padding: 8 }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              color: colors.borderTint,
            }}
          >
            Skip seat selection
          </span>
        </button>
      </div>
    </div>
  );
}
