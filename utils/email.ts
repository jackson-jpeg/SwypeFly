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

export async function sendBookingConfirmationEmail(params: {
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
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured, skipping booking confirmation email');
    return;
  }

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
    currency,
  }).format(totalPaid);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const seatRow = seatDesignator
    ? `<tr>
        <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Seat</td>
        <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: 600; color: #1B1B2F;">${seatDesignator}</td>
      </tr>`
    : '';

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Booking Confirmed: ${originIata} → ${destinationCity} | ${bookingReference}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #F5ECD7;">
        <!-- Header -->
        <div style="background: #1B1B2F; padding: 24px 32px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 1px;">SoGoJet</h1>
        </div>

        <!-- Success Banner -->
        <div style="background: #7BAF8E; padding: 20px 32px; text-align: center;">
          <span style="font-size: 32px;">&#10003;</span>
          <h2 style="color: #ffffff; font-size: 20px; margin: 8px 0 0 0; font-weight: 700;">Booking Confirmed!</h2>
        </div>

        <!-- Boarding Pass Card -->
        <div style="margin: 24px 24px 0 24px; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e0d9c8;">
          <!-- Route Header -->
          <div style="padding: 24px 24px 16px 24px; text-align: center; border-bottom: 2px dashed #e0d9c8;">
            <div style="font-size: 28px; font-weight: 700; color: #1B1B2F; letter-spacing: 2px;">
              ${originIata} &nbsp;&#9992;&nbsp; ${destinationIata}
            </div>
            <div style="font-size: 16px; color: #666; margin-top: 4px;">${destinationCity}</div>
          </div>

          <!-- Details Table -->
          <div style="padding: 16px 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Passenger</td>
                <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: 600; color: #1B1B2F;">${passengerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Airline</td>
                <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: 600; color: #1B1B2F;">${airline}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Departure</td>
                <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: 600; color: #1B1B2F;">${formatDate(departureDate)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Return</td>
                <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: 600; color: #1B1B2F;">${formatDate(returnDate)}</td>
              </tr>
              ${seatRow}
            </table>
          </div>

          <!-- Booking Reference -->
          <div style="padding: 16px 24px; background: #f9f6ef; border-top: 2px dashed #e0d9c8; text-align: center;">
            <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Booking Reference</div>
            <div style="font-size: 26px; font-weight: 800; color: #1B1B2F; letter-spacing: 3px; font-family: 'Courier New', monospace;">${bookingReference}</div>
          </div>
        </div>

        <!-- Total Paid -->
        <div style="margin: 16px 24px 0 24px; background: #ffffff; border-radius: 12px; padding: 16px 24px; border: 1px solid #e0d9c8; text-align: center;">
          <div style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Total Paid</div>
          <div style="font-size: 28px; font-weight: 800; color: #7BAF8E; margin-top: 4px;">${formattedTotal}</div>
        </div>

        <!-- CTA Button -->
        <div style="padding: 24px 24px 8px 24px; text-align: center;">
          <a href="https://sogojet.com/trips" style="display: inline-block; padding: 14px 36px; background: #1B1B2F; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            View Your Trip
          </a>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px 24px 24px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Need help? Contact <a href="mailto:support@sogojet.com" style="color: #7BAF8E; text-decoration: none;">support@sogojet.com</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, airport: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Welcome to SoGoJet — Your Deal Alerts Are Live!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Welcome to SoGoJet! ✈️</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          You're now subscribed to weekly flight deal alerts from <strong>${airport}</strong>.
          We'll send you the best deals we find — no spam, just savings.
        </p>
        <a href="https://sogojet.com" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #4fc3f7; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Explore Deals Now
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          You can unsubscribe at any time by replying to any of our emails.
        </p>
      </div>
    `,
  });
}
