import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useBookingStore } from '@/stores/bookingStore';
import { useDestination } from '@/hooks/useDestination';
import { useOfferDetail } from '@/hooks/useBooking';
import { useUIStore } from '@/stores/uiStore';
import BookingHeader from '@/components/BookingHeader';
import type { SeatMap, SeatMapSeat } from '@/api/types';

/* ───── seat helpers ───── */
type SeatState = 'available' | 'occupied' | 'extra';

function seatStateFromData(seat: SeatMapSeat, exitRows: number[], rowNum: number): SeatState {
  if (!seat.available) return 'occupied';
  if (seat.extraLegroom || exitRows.includes(rowNum)) return 'extra';
  return 'available';
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
  const { data: dest } = useDestination(booking.destinationId ?? undefined);
  const { departureCode } = useUIStore();
  const { data: offerDetail, isLoading: offerLoading } = useOfferDetail(
    booking.selectedOffer?.id ?? null,
    booking.destinationId ?? undefined,
    departureCode,
  );

  const seatMap: SeatMap | null = offerDetail?.seatMap ?? null;

  const { columns, rows, exitRows, aisleAfterSet } = useMemo(() => {
    if (!seatMap) return { columns: ['A', 'B', 'C', 'D', 'E', 'F'], rows: [] as number[], exitRows: [] as number[], aisleAfterSet: new Set(['C']) };
    return {
      columns: seatMap.columns,
      rows: seatMap.rows.map((r) => r.rowNumber),
      exitRows: seatMap.exitRows,
      aisleAfterSet: new Set(seatMap.aisleAfterColumns ?? ['C']),
    };
  }, [seatMap]);

  const seatLookup = useMemo(() => {
    if (!seatMap) return new Map<string, SeatMapSeat>();
    const map = new Map<string, SeatMapSeat>();
    for (const row of seatMap.rows) {
      for (const seat of row.seats) {
        map.set(`${row.rowNumber}-${seat.column}`, seat);
      }
    }
    return map;
  }, [seatMap]);

  function getSeatState(row: number, col: string): SeatState {
    const seat = seatLookup.get(`${row}-${col}`);
    if (!seat) return 'available';
    return seatStateFromData(seat, exitRows, row);
  }

  function getSeatPrice(row: number, col: string): number {
    return seatLookup.get(`${row}-${col}`)?.price ?? 0;
  }

  function getSeatServiceId(row: number, col: string): string | null {
    return seatLookup.get(`${row}-${col}`)?.serviceId ?? null;
  }

  // Detect if seat map exists but no seats are selectable (airline doesn't sell through Duffel)
  const allSeatsUnavailable = useMemo(() => {
    if (!seatMap || seatMap.rows.length === 0) return false;
    return seatMap.rows.every((r) => r.seats.every((s) => !s.available));
  }, [seatMap]);

  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

  const handleSeatClick = (row: number, col: string) => {
    const state = getSeatState(row, col);
    if (state === 'occupied') return;
    const key = `${row}-${col}`;
    setSelectedSeat(selectedSeat === key ? null : key);
  };

  return (
    <div
      className="screen-fixed"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BookingHeader
        step={3}
        stepLabel="Seat Selection"
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
        {/* loading / empty state */}
        {offerLoading && rows.length === 0 && (
          <div style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.mutedText, padding: 40, textAlign: 'center' }}>
            Loading seat map...
          </div>
        )}
        {!offerLoading && (rows.length === 0 || allSeatsUnavailable) && (
          <div style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 14,
            color: colors.mutedText,
            padding: 40,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
            </svg>
            <span style={{ fontWeight: 600, color: colors.deepDusk }}>Seat selection not available</span>
            <span>This airline assigns seats at check-in. You can skip this step and continue.</span>
          </div>
        )}

        {/* legend + fuselage — only when seat map available and seats are selectable */}
        {rows.length > 0 && !allSeatsUnavailable && <>
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
            width: Math.max(260, columns.length * 30 + (aisleAfterSet.size * 12) + 40),
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
                  ...(i > 0 && columns[i - 1] && aisleAfterSet.has(columns[i - 1]!) ? { marginLeft: 12 } : {}),
                }}
              >
                {c}
              </div>
            ))}
          </div>

          {/* seat rows */}
          {rows.map((row) => (
            <div key={row}>
              {/* EXIT row indicator */}
              {exitRows.includes(row) && (
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
                      style={{ ...(colIdx > 0 && columns[colIdx - 1] && aisleAfterSet.has(columns[colIdx - 1]!) ? { marginLeft: 12 } : {}) }}
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
        </>}

        {/* selection confirmation */}
        {selectedSeat && !allSeatsUnavailable && (
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
                Seat {selectedSeat.replace('-', '')} — {(() => { const col = selectedSeat.split('-')[1] ?? ''; const ci = columns.indexOf(col); if (ci === 0 || ci === columns.length - 1) return 'Window'; if (aisleAfterSet.has(col) || (ci > 0 && columns[ci - 1] && aisleAfterSet.has(columns[ci - 1]!))) return 'Aisle'; return 'Middle'; })()} seat
              </span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 13,
                  color: colors.borderTint,
                }}
              >
                {(() => {
                  const [r, c] = selectedSeat!.split('-');
                  const price = getSeatPrice(parseInt(r!), c!);
                  const state = getSeatState(parseInt(r!), c!);
                  if (state === 'extra' || price > 0) return `Extra legroom · +$${price}`;
                  return 'Standard seat · No extra charge';
                })()}
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
          onClick={() => {
            const [rowStr, col] = selectedSeat ? selectedSeat.split('-') : [null, null];
            const price = rowStr && col ? getSeatPrice(parseInt(rowStr), col) : 0;
            const serviceId = rowStr && col ? getSeatServiceId(parseInt(rowStr), col) : null;
            storeSeat(selectedSeat ? selectedSeat.replace('-', '') : null, price, serviceId);
            navigate('/booking/extras');
          }}
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
          onClick={() => { storeSeat(null, 0, null); navigate('/booking/extras'); }}
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
