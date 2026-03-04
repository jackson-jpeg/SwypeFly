import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useBookingStore } from '@/stores/bookingStore';
import { useDestination } from '@/hooks/useDestination';
import { useAuthContext } from '@/hooks/AuthContext';
import BookingHeader from '@/components/BookingHeader';

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

/* ───── helpers ───── */

/** Mask input to MM/DD/YYYY format */
function maskDob(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Validate a MM/DD/YYYY date string: real date, passenger at least 2 years old */
function validateDob(dob: string): string | null {
  if (!dob) return 'Date of birth is required';
  const match = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return 'Use MM/DD/YYYY format';
  const [, mm, dd, yyyy] = match;
  const month = parseInt(mm!, 10);
  const day = parseInt(dd!, 10);
  const year = parseInt(yyyy!, 10);
  if (month < 1 || month > 12) return 'Invalid month';
  if (day < 1 || day > 31) return 'Invalid day';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return 'Invalid date';
  }
  const today = new Date();
  const age = today.getFullYear() - year - (today < new Date(today.getFullYear(), month - 1, day) ? 1 : 0);
  if (age < 2) return 'Passenger must be at least 2 years old';
  if (year < 1900) return 'Invalid year';
  return null;
}

/** Format phone: strip non-digits except leading + */
function formatPhone(raw: string): string {
  if (raw.startsWith('+')) return '+' + raw.slice(1).replace(/[^\d]/g, '');
  return raw.replace(/[^\d+]/g, '');
}

/* ───── screen ───── */
export default function PassengerDetailsScreen() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const bookingStore = useBookingStore();
  const { addPassenger, updatePassenger, passengers } = bookingStore;
  const { data: dest } = useDestination(bookingStore.destinationId ?? undefined);
  const nameParts = (user?.name ?? '').split(' ');
  const [firstName, setFirstName] = useState(nameParts[0] ?? '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') ?? '');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Female');
  const [phone, setPhone] = useState('');
  const [passportOpen, setPassportOpen] = useState(false);
  const [passportNumber, setPassportNumber] = useState('');
  const [ffOpen, setFfOpen] = useState(false);
  const [ffNumber, setFfNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'Required';
    if (!lastName.trim()) errs.lastName = 'Required';
    const dobErr = validateDob(dob);
    if (dobErr) errs.dob = dobErr;
    if (!phone.trim()) errs.phone = 'Phone number is required';
    else if (phone.replace(/\D/g, '').length < 7) errs.phone = 'Enter a valid phone number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
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
        step={2}
        stepLabel="Passenger Details"
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
              onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: '' })); }}
              style={{ ...inputStyle, ...(errors.firstName ? { borderColor: colors.terracotta } : {}) }}
            />
            {errors.firstName && <span style={{ fontSize: 12, color: colors.terracotta, fontFamily: `"${fonts.body}", system-ui, sans-serif` }}>{errors.firstName}</span>}
          </div>

          {/* last name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Last Name</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: '' })); }}
              style={{ ...inputStyle, ...(errors.lastName ? { borderColor: colors.terracotta } : {}) }}
            />
            {errors.lastName && <span style={{ fontSize: 12, color: colors.terracotta, fontFamily: `"${fonts.body}", system-ui, sans-serif` }}>{errors.lastName}</span>}
          </div>

          {/* DOB + Gender row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Date of Birth</span>
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={dob}
                onChange={(e) => { setDob(maskDob(e.target.value)); setErrors((p) => ({ ...p, dob: '' })); }}
                maxLength={10}
                style={{ ...inputStyle, color: dob ? colors.deepDusk : colors.mutedText, ...(errors.dob ? { borderColor: colors.terracotta } : {}) }}
              />
              {errors.dob && <span style={{ fontSize: 12, color: colors.terracotta, fontFamily: `"${fonts.body}", system-ui, sans-serif` }}>{errors.dob}</span>}
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
                  <option value="Other">Prefer not to say</option>
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

          {/* phone number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Phone Number</span>
            <input
              type="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => { setPhone(formatPhone(e.target.value)); setErrors((p) => ({ ...p, phone: '' })); }}
              style={{ ...inputStyle, ...(errors.phone ? { borderColor: colors.terracotta } : {}) }}
            />
            {errors.phone && <span style={{ fontSize: 12, color: colors.terracotta, fontFamily: `"${fonts.body}", system-ui, sans-serif` }}>{errors.phone}</span>}
          </div>

          {/* email (readonly) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Email (for booking confirmation)</span>
            <input
              type="email"
              value={user?.email ?? ''}
              readOnly
              style={{ ...inputStyle, backgroundColor: '#F5ECD7', color: colors.mutedText }}
            />
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
      </div>

      {/* CTA */}
      <div style={{ paddingInline: 20, paddingBottom: 32, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => {
            if (!validate()) return;

            // Map gender for Duffel API (only supports 'm' and 'f')
            const genderCode = gender === 'Male' ? 'm' : 'f';
            // Duffel API doesn't support 'mx'; use 'ms' as neutral default
            const titleCode = gender === 'Male' ? 'mr' : 'ms';

            // Convert MM/DD/YYYY to YYYY-MM-DD for Duffel API
            const [mm, dd, yyyy] = dob.split('/');
            const bornOn = `${yyyy}-${mm}-${dd}`;

            const paxData = {
              id: 'pax-1',
              given_name: firstName.trim(),
              family_name: lastName.trim(),
              born_on: bornOn,
              gender: genderCode as 'f' | 'm',
              title: titleCode as 'mr' | 'ms',
              email: user?.email ?? '',
              phone_number: phone.trim(),
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
            border: 'none',
            backgroundColor: colors.deepDusk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
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
