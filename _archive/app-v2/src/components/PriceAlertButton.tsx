import { useState } from 'react';
import { colors, fonts } from '@/tokens';
import { apiFetch } from '@/api/client';
import { useAuthContext } from '@/hooks/AuthContext';

interface Props {
  destinationId: string;
  currentPrice: number;
}

export default function PriceAlertButton({ destinationId, currentPrice }: Props) {
  const { session } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState(String(Math.round(currentPrice * 0.85)));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleCreate = async () => {
    const price = Number(targetPrice);
    if (!price || price <= 0 || price >= currentPrice) return;

    setStatus('saving');
    try {
      await apiFetch('/api/alerts?action=create', {
        method: 'POST',
        body: JSON.stringify({ destination_id: destinationId, target_price: price }),
      });
      setStatus('saved');
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setStatus('error');
    }
  };

  if (!session) return null;

  if (status === 'saved' && !open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.confirmGreen, fontWeight: 500 }}>
          Price alert set for ${targetPrice}
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 10,
          backgroundColor: '#A8C4B815',
          border: '1px solid #A8C4B840',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, fontWeight: 500, color: colors.confirmGreen }}>
          Set Price Alert
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        borderRadius: 12,
        backgroundColor: colors.offWhite,
        border: '1px solid #C9A99A40',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: colors.deepDusk }}>
          Alert me when price drops to:
        </span>
        <button onClick={() => { setOpen(false); setStatus('idle'); }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: 40, borderRadius: 10, backgroundColor: '#F8F6F2', border: '1px solid #C9A99A40', paddingInline: 12 }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, color: colors.borderTint }}>$</span>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => { setTargetPrice(e.target.value); setStatus('idle'); }}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 15,
              color: colors.deepDusk,
              paddingLeft: 4,
            }}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={status === 'saving'}
          style={{
            height: 40,
            paddingInline: 16,
            borderRadius: 10,
            backgroundColor: colors.confirmGreen,
            border: 'none',
            cursor: status === 'saving' ? 'wait' : 'pointer',
            opacity: status === 'saving' ? 0.7 : 1,
          }}
        >
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>
            {status === 'saving' ? '...' : 'Set'}
          </span>
        </button>
      </div>

      <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, color: colors.borderTint }}>
        Current price: ${currentPrice} · We'll email you when it drops
      </span>

      {status === 'error' && (
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.terracotta }}>
          Failed to set alert. Please try again.
        </span>
      )}
    </div>
  );
}
