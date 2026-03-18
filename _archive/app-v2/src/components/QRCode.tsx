import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}

/**
 * Renders a QR code as a canvas-generated data URL image.
 * Uses the `qrcode` library for proper Reed-Solomon error correction.
 */
export default function QRCode({ value, size = 100, bgColor = '#3B2F2A', fgColor = '#FFFFFF' }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    QRCodeLib.toDataURL(value, {
      width: size * 2, // 2x for retina
      margin: 1,
      color: { dark: fgColor, light: bgColor },
      errorCorrectionLevel: 'M',
    }).then(setDataUrl).catch(() => setDataUrl(''));
  }, [value, size, bgColor, fgColor]);

  if (!dataUrl) return null;

  return (
    <img
      src={dataUrl}
      alt="QR code"
      width={size}
      height={size}
      style={{ borderRadius: 12, display: 'block' }}
    />
  );
}
