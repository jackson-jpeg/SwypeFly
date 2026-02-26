import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');

const FROM_EMAIL = 'alerts@sogojet.com';

export async function sendPriceAlertEmail(
  to: string,
  destinationName: string,
  currentPrice: number,
  targetPrice: number,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Price Alert: ${destinationName} is now $${currentPrice}!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Price Drop Alert</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          Great news! Flights to <strong>${destinationName}</strong> have dropped to
          <strong style="color: #16a34a;">$${currentPrice}</strong>
          — below your target of $${targetPrice}.
        </p>
        <a href="https://sogojet.com" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #4fc3f7; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600;">
          View Deal on SoGoJet
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          You received this because you set a price alert on SoGoJet. This alert has been deactivated.
        </p>
      </div>
    `,
  });
}
