import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useBookingStore } from '@/stores/bookingStore';
import { getStubDestination } from '@/api/stubs';
import { useAuthContext } from '@/hooks/AuthContext';

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
      {/* top row */}
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

      {/* photo strip + step info overlay */}
      <div style={{ position: 'relative', height: 60 }}>
        {/* background photo strip */}
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
        {/* step text */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, paddingInline: 20, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11,
                fontWeight: 600,
                color: colors.sageDrift,
              }}
            >
              Step {step} of 6
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 11,
                fontWeight: 400,
                color: colors.borderTint,
              }}
            >
              {stepName}
            </span>
          </div>
          {/* progress bar */}
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

/* ───── reusable styles ───── */
const labelStyle: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: colors.borderTint,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  backgroundColor: colors.offWhite,
  border: '1px solid #C9A99A60',
  borderRadius: 10,
  paddingInline: 14,
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 15,
  color: colors.deepDusk,
  outline: 'none',
};

const accordionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: colors.offWhite,
  border: '1px solid #C9A99A20',
  borderRadius: 14,
  paddingBlock: 16,
  paddingInline: 16,
  width: '100%',
};

/* ───── screen ───── */
export default function PassengerDetailsScreen() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const bookingStore = useBookingStore();
  const { addPassenger, updatePassenger, passengers } = bookingStore;
  const dest = getStubDestination(bookingStore.destinationId ?? '2');
  const nameParts = (user?.name ?? '').split(' ');
  const [firstName, setFirstName] = useState(nameParts[0] ?? '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') ?? '');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Female');
  const [passportOpen, setPassportOpen] = useState(false);
  const [passportNumber, setPassportNumber] = useState('');
  const [ffOpen, setFfOpen] = useState(false);
  const [ffNumber, setFfNumber] = useState('');

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
        step={2}
        stepName="Passenger Details"
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
          gap: 16,
          paddingInline: 20,
          paddingTop: 20,
          paddingBottom: 32,
        }}
      >
        {/* passenger label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontSize: 16,
              fontWeight: 800,
              color: colors.deepDusk,
            }}
          >
            Passenger 1 — Adult
          </span>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              fontWeight: 500,
              color: colors.sageDrift,
            }}
          >
            Primary
          </span>
        </div>

        {/* form card */}
        <div
          style={{
            backgroundColor: colors.offWhite,
            border: '1px solid #C9A99A20',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* first name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>First Name</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* last name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Last Name</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* DOB + Gender row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Date of Birth</span>
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                style={{ ...inputStyle, color: dob ? colors.deepDusk : colors.mutedText }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Gender</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    paddingRight: 32,
                  }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.mutedText}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* passport accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <button onClick={() => setPassportOpen(!passportOpen)} style={accordionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M2 8h20" />
                <path d="M6 12h4" />
              </svg>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 15,
                  fontWeight: 500,
                  color: colors.deepDusk,
                }}
              >
                Passport Details
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.mutedText }}>
                Optional
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.mutedText}
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transform: passportOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </button>
          {passportOpen && (
            <div style={{ paddingInline: 16, paddingBlock: 12, backgroundColor: colors.offWhite, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderTop: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={labelStyle}>Passport Number</span>
                <input
                  type="text"
                  placeholder="Enter passport number"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>

        {/* frequent flyer accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <button onClick={() => setFfOpen(!ffOpen)} style={accordionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-2 2 4 1 1 4 2-2v-3l3-2 3.8 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
              </svg>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 15,
                  fontWeight: 500,
                  color: colors.deepDusk,
                }}
              >
                Frequent Flyer
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.mutedText }}>
                Optional
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.mutedText}
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transform: ffOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </button>
          {ffOpen && (
            <div style={{ paddingInline: 16, paddingBlock: 12, backgroundColor: colors.offWhite, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderTop: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={labelStyle}>Frequent Flyer Number</span>
                <input
                  type="text"
                  placeholder="Enter frequent flyer number"
                  value={ffNumber}
                  onChange={(e) => setFfNumber(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>

        {/* add another passenger — disabled for MVP */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingBlock: 12,
            width: '100%',
            opacity: 0.4,
            cursor: 'not-allowed',
          }}
        >
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.borderTint }}>
            + Add Another Passenger
          </span>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.mutedText }}>
            (Coming soon)
          </span>
        </div>
      </div>

      {/* CTA */}
      <div style={{ paddingInline: 20, paddingBottom: 32, paddingTop: 8 }}>
        <button
          onClick={() => {
            const paxData = {
              id: 'pax-1',
              given_name: firstName,
              family_name: lastName,
              born_on: dob,
              gender: (gender === 'Male' ? 'm' : 'f') as 'f' | 'm',
              title: (gender === 'Male' ? 'mr' : 'ms') as 'mr' | 'ms',
              email: user?.email ?? '',
              phone_number: '',
            };
            const existingIdx = passengers.findIndex((p) => p.id === 'pax-1');
            if (existingIdx >= 0) {
              updatePassenger(existingIdx, paxData);
            } else {
              addPassenger(paxData);
            }
            navigate('/booking/seats');
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
            Continue to Seat Selection
          </span>
        </button>
      </div>
    </div>
  );
}
