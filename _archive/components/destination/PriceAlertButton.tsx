import React, { useState } from 'react';
import { Platform } from 'react-native';
import { getAuthHeaders } from '../../services/apiHelpers';
import { colors } from '../../constants/theme';

interface PriceAlertButtonProps {
  destinationId: string;
  currentPrice: number;
}

export function PriceAlertButton({ destinationId, currentPrice }: PriceAlertButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState(Math.round(currentPrice * 0.85));
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'no-auth'>('idle');

  if (Platform.OS !== 'web') return null;

  const handleSubmit = async () => {
    setStatus('saving');
    try {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders.Authorization) {
        setStatus('no-auth');
        return;
      }

      const res = await fetch('/api/alerts?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          destination_id: destinationId,
          target_price: targetPrice,
          email: email || undefined,
        }),
      });
      if (res.ok) {
        setStatus('saved');
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'saved') {
    return (
      <div style={{
        padding: '12px 20px', borderRadius: 12,
        backgroundColor: colors.successBackground, border: `1px solid ${colors.successBorder}`,
        color: colors.sageDrift, fontSize: 14, fontWeight: 600, textAlign: 'center',
      }}>
        Price alert set! We'll notify you when it drops to ${targetPrice}.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '12px 16px',
          backgroundColor: 'rgba(247,232,160,0.2)',
          border: `1px solid rgba(247,232,160,0.4)`,
          borderRadius: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 16 }}>🔔</span>
        <span style={{ color: colors.deepDusk, fontSize: 14, fontWeight: 600 }}>Watch Price</span>
      </button>

      {isOpen && (
        <div style={{
          marginTop: 8, padding: 16,
          backgroundColor: colors.paleHorizon,
          border: `1px solid ${colors.divider}`,
          borderRadius: 12,
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: colors.text.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
              Alert me when price drops to
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ color: colors.text.secondary, fontSize: 18 }}>$</span>
              <input
                type="number"
                value={targetPrice}
                aria-label="Target price in dollars"
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  backgroundColor: colors.duskSand,
                  border: `1px solid ${colors.divider}`,
                  color: colors.deepDusk, fontSize: 16, fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ color: colors.text.muted, fontSize: 11, marginTop: 4 }}>
              Current price: ${currentPrice}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: colors.text.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
              Email (for notification)
            </label>
            <input
              type="email"
              value={email}
              aria-label="Notification email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, marginTop: 6,
                backgroundColor: colors.duskSand,
                border: `1px solid ${colors.divider}`,
                color: colors.deepDusk, fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={status === 'saving'}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              background: colors.deepDusk,
              border: 'none', color: colors.paleHorizon, fontSize: 14, fontWeight: 700,
              cursor: status === 'saving' ? 'default' : 'pointer',
              opacity: status === 'saving' ? 0.6 : 1,
            }}
          >
            {status === 'saving' ? 'Setting alert...' : 'Set Price Alert'}
          </button>

          {status === 'error' && (
            <div style={{ color: colors.terracotta, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
              Failed to set alert. Try again.
            </div>
          )}
          {status === 'no-auth' && (
            <div style={{ color: colors.warmDusk, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
              Sign in to set price alerts.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
