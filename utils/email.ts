import { Resend } from 'resend';
import { env } from './env';

// ---------------------------------------------------------------------------
// Email utility for SoGoJet — uses Resend as the provider.
// Every export is async, returns void, and never throws.
// If RESEND_API_KEY is missing the functions log a warning and bail.
// ---------------------------------------------------------------------------

const BRAND = {
  terracotta: '#E07A5F',
  deepDusk: '#1B1B3A',
  white: '#FFFFFF',
  lightBg: '#F5F3F0',
  gray: '#6B7280',
  green: '#7BAF8E',
};

function getResend(): Resend | null {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send');
    return null;
  }
  return new Resend(key);
}

function fromAddress(): string {
  return env.FROM_EMAIL?.trim() || 'noreply@sogojet.com';
}

function fromHeader(): string {
  return `SoGoJet <${fromAddress()}>`;
}

// ---------------------------------------------------------------------------
// Shared layout wrapper — mobile-friendly, inline styles
// ---------------------------------------------------------------------------

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.lightBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.lightBg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:${BRAND.deepDusk};padding:24px 32px;text-align:center;">
          <span style="font-size:24px;font-weight:700;color:${BRAND.terracotta};letter-spacing:1px;">SoGoJet</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;color:${BRAND.deepDusk};font-size:15px;line-height:1.6;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;text-align:center;font-size:12px;color:${BRAND.gray};border-top:1px solid #E5E7EB;">
          &copy; ${new Date().getFullYear()} SoGoJet &mdash; Travel deals, simplified.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function detailRow(label: string, value: string, highlight?: boolean): string {
  return `<tr>
    <td style="padding:6px 0;color:${BRAND.gray};font-size:13px;">${label}</td>
    <td style="padding:6px 0;text-align:right;font-weight:${highlight ? '700' : '600'};font-size:${highlight ? '17px' : '15px'};color:${highlight ? BRAND.terracotta : BRAND.deepDusk};">${value}</td>
  </tr>`;
}

// ---------------------------------------------------------------------------
// 1. Booking confirmation
// ---------------------------------------------------------------------------

export interface BookingConfirmationParams {
  to: string;
  passengerName: string;
  bookingReference: string;
  destinationCity: string;
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate: string;
  airline: string;
  totalPaid: number;
  currency: string;
  seatDesignator?: string;
}

export async function sendBookingConfirmationEmail(
  params: BookingConfirmationParams,
): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return;

    const {
      to,
      passengerName,
      bookingReference,
      destinationCity,
      originIata,
      destinationIata,
      departureDate,
      returnDate,
      airline,
      totalPaid,
      currency,
      seatDesignator,
    } = params;

    const formattedTotal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(totalPaid);

    const body = `
      <!-- Success banner -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:${BRAND.green};color:${BRAND.white};font-size:24px;font-weight:700;">&#10003;</div>
        <h2 style="margin:12px 0 4px;font-size:20px;color:${BRAND.deepDusk};">Booking Confirmed!</h2>
        <p style="margin:0;color:${BRAND.gray};">You're headed to <strong style="color:${BRAND.deepDusk};">${destinationCity}</strong></p>
      </div>

      <!-- Route -->
      <div style="text-align:center;padding:16px 0;border-top:2px dashed #E5E7EB;border-bottom:2px dashed #E5E7EB;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:700;color:${BRAND.deepDusk};letter-spacing:2px;">${originIata} &nbsp;&#9992;&nbsp; ${destinationIata}</span>
      </div>

      <!-- Details -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.lightBg};border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${detailRow('Passenger', passengerName)}
            ${detailRow('Airline', airline)}
            ${detailRow('Departure', formatDate(departureDate))}
            ${detailRow('Return', formatDate(returnDate))}
            ${seatDesignator ? detailRow('Seat', seatDesignator) : ''}
            ${detailRow('Reference', bookingReference)}
            ${detailRow('Total Paid', formattedTotal, true)}
          </table>
        </td></tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:16px;">
        <a href="https://sogojet.com" style="display:inline-block;padding:14px 36px;background:${BRAND.deepDusk};color:${BRAND.white};text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">View Your Trip</a>
      </div>

      <p style="margin:0;font-size:13px;color:${BRAND.gray};text-align:center;">
        Need help? Reply to this email and we'll get back to you.
      </p>
    `;

    await resend.emails.send({
      from: fromHeader(),
      to,
      subject: `Booking confirmed: ${originIata} \u2192 ${destinationIata} (${bookingReference})`,
      html: layout('Booking Confirmed', body),
    });

    console.log(`[email] Booking confirmation sent to ${to} (ref: ${bookingReference})`);
  } catch (err) {
    console.error('[email] Failed to send booking confirmation:', err);
  }
}

// ---------------------------------------------------------------------------
// 2. Price alert
// ---------------------------------------------------------------------------

export async function sendPriceAlertEmail(
  email: string,
  destName: string,
  currentPrice: number,
  targetPrice: number,
): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return;

    const formattedCurrent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(currentPrice);

    const formattedTarget = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(targetPrice);

    const savings = Math.round(((targetPrice - currentPrice) / targetPrice) * 100);

    const body = `
      <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND.deepDusk};">Price Drop Alert</h2>
      <p style="margin:0 0 24px;">Great news! Flights to <strong>${destName}</strong> just dropped below your target.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding:16px;background:${BRAND.lightBg};border-radius:8px;text-align:center;width:48%;">
            <div style="font-size:13px;color:${BRAND.gray};margin-bottom:4px;">Current Price</div>
            <div style="font-size:28px;font-weight:700;color:${BRAND.terracotta};">${formattedCurrent}</div>
          </td>
          <td style="width:4%;"></td>
          <td style="padding:16px;background:${BRAND.lightBg};border-radius:8px;text-align:center;width:48%;">
            <div style="font-size:13px;color:${BRAND.gray};margin-bottom:4px;">Your Target</div>
            <div style="font-size:28px;font-weight:700;color:${BRAND.deepDusk};">${formattedTarget}</div>
          </td>
        </tr>
      </table>

      ${savings > 0 ? `<p style="margin:0 0 24px;text-align:center;font-size:15px;color:${BRAND.terracotta};font-weight:600;">That's ${savings}% below your target!</p>` : ''}

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:16px;">
        <a href="https://sogojet.com" style="display:inline-block;padding:14px 36px;background:${BRAND.terracotta};color:${BRAND.white};text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Book Now</a>
      </div>

      <p style="margin:0;font-size:13px;color:${BRAND.gray};text-align:center;">
        Open SoGoJet to book before prices change. This alert has been deactivated.
      </p>
    `;

    await resend.emails.send({
      from: fromHeader(),
      to: email,
      subject: `Price drop: ${destName} now ${formattedCurrent}`,
      html: layout('Price Drop Alert', body),
    });

    console.log(`[email] Price alert sent to ${email} for ${destName} (${formattedCurrent})`);
  } catch (err) {
    console.error('[email] Failed to send price alert:', err);
  }
}

// ---------------------------------------------------------------------------
// 3. Schedule change notification (Duffel webhook)
// ---------------------------------------------------------------------------

export interface ScheduleChangeParams {
  to: string;
  passengerName: string;
  bookingReference: string;
  destinationCity: string;
  changeDescription: string;
}

export async function sendScheduleChangeEmail(params: ScheduleChangeParams): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return;

    const { to, passengerName, bookingReference, destinationCity, changeDescription } = params;

    const body = `
      <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND.deepDusk};">Schedule Change</h2>
      <p style="margin:0 0 24px;">Hey ${passengerName}, the airline has made a change to your upcoming trip to <strong>${destinationCity}</strong>.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3C7;border-radius:8px;margin-bottom:24px;border-left:4px solid ${BRAND.terracotta};">
        <tr><td style="padding:16px;">
          <div style="font-size:13px;color:${BRAND.gray};margin-bottom:8px;">Booking Reference: <strong style="color:${BRAND.deepDusk};">${bookingReference}</strong></div>
          <div style="font-size:15px;color:${BRAND.deepDusk};line-height:1.5;">${changeDescription}</div>
        </td></tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:16px;">
        <a href="https://sogojet.com" style="display:inline-block;padding:14px 36px;background:${BRAND.deepDusk};color:${BRAND.white};text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Review Changes</a>
      </div>

      <p style="margin:0;font-size:13px;color:${BRAND.gray};text-align:center;">
        If this doesn't work for you, reply to this email and we'll help sort it out.
      </p>
    `;

    await resend.emails.send({
      from: fromHeader(),
      to,
      subject: `Schedule change: ${destinationCity} trip (${bookingReference})`,
      html: layout('Schedule Change', body),
    });

    console.log(`[email] Schedule change email sent to ${to} (ref: ${bookingReference})`);
  } catch (err) {
    console.error('[email] Failed to send schedule change email:', err);
  }
}

// ---------------------------------------------------------------------------
// 4. Welcome email
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(to: string, airport: string): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return;

    const body = `
      <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND.deepDusk};">Welcome to SoGoJet!</h2>
      <p style="margin:0 0 24px;">You're now subscribed to flight deal alerts from <strong>${airport}</strong>. We'll send you the best deals we find — no spam, just savings.</p>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:16px;">
        <a href="https://sogojet.com" style="display:inline-block;padding:14px 36px;background:${BRAND.terracotta};color:${BRAND.white};text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Explore Deals Now</a>
      </div>

      <p style="margin:0;font-size:13px;color:${BRAND.gray};text-align:center;">
        You can unsubscribe at any time by replying to any of our emails.
      </p>
    `;

    await resend.emails.send({
      from: fromHeader(),
      to,
      subject: 'Welcome to SoGoJet — Your Deal Alerts Are Live!',
      html: layout('Welcome to SoGoJet', body),
    });

    console.log(`[email] Welcome email sent to ${to}`);
  } catch (err) {
    console.error('[email] Failed to send welcome email:', err);
  }
}
