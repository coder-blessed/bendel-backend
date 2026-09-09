import { env } from "../config/env.js";
/**
 * Sends an email using the Resend API with admin@bendelinsurancefootball.com as the verified sender.
 */
export async function sendEmailViaResend({ to, subject, html, text }) {
    const from = `${env.resend.fromName} <${env.resend.fromEmail}>`;
    if (!env.resend.apiKey) {
        console.warn(`[EmailService:DEV_MODE] RESEND_API_KEY is not set. Email not dispatched via network.\n` +
            `From: ${from}\nTo: ${to}\nSubject: ${subject}\n`);
        if (env.nodeEnv === "production") {
            return { success: false, error: "Email delivery is not configured." };
        }
        return { success: true, mocked: true, messageId: "mock-" + Date.now() };
    }
    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.resend.apiKey}`,
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject,
                html,
                text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            }),
        });
        const data = (await response.json());
        if (!response.ok) {
            console.error("[EmailService:ERROR] Resend API failed:", data);
            throw new Error(data?.message || "Failed to send email via Resend.");
        }
        console.log(`[EmailService] Email sent to ${to} (id: ${data?.id})`);
        return { success: true, id: data?.id };
    }
    catch (error) {
        console.error(`[EmailService] Error sending email to ${to}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown email error" };
    }
}
/**
 * Base email layout wrapper with Bendel Insurance FC branding
 */
function emailLayout(content, preheader = "Bendel Insurance Football Club") {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bendel Insurance FC</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1510; color: #ffffff; }
    .container { max-width: 600px; margin: 0 auto; background-color: #032e18; border-radius: 12px; overflow: hidden; border: 1px solid #16562f; }
    .header { background: linear-gradient(135deg, #021e10 0%, #032e18 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #f59e0b; }
    .logo-text { font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #ffffff; text-transform: uppercase; margin: 0; }
    .gold-sub { color: #f59e0b; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; }
    .body-content { padding: 36px 28px; color: #e2e8f0; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background-color: #f59e0b; color: #021e10 !important; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; font-size: 13px; letter-spacing: 1px; margin: 24px 0; }
    .footer { background-color: #02170c; padding: 24px; text-align: center; font-size: 12px; color: #8fa799; border-top: 1px solid #16562f; }
    .ticket-card { background: #073b20; border: 2px dashed #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .receipt-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .receipt-table th { text-align: left; padding: 10px; border-bottom: 1px solid #16562f; color: #f59e0b; font-size: 12px; text-transform: uppercase; }
    .receipt-table td { padding: 12px 10px; border-bottom: 1px solid #0f4625; color: #ffffff; font-size: 14px; }
    .badge { background: #f59e0b; color: #021e10; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
  </style>
</head>
<body style="background-color: #0b1510; padding: 20px 10px;">
  <span style="display:none;font-size:0px;line-height:0px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>
  <div class="container">
    <div class="header">
      <h1 class="logo-text">BENDEL INSURANCE FC</h1>
      <p class="gold-sub">The Benin Arsenal &bull; Established 1972</p>
    </div>
    <div class="body-content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;"><strong>Bendel Insurance Football Club</strong></p>
      <p style="margin: 0 0 8px 0;">Samuel Ogbemudia Stadium, Benin City, Edo State, Nigeria</p>
      <p style="margin: 0; color: #5a7767;">Official Communications &bull; admin@bendelinsurancefootball.com</p>
    </div>
  </div>
</body>
</html>
`;
}
/**
 * Send user registration email verification link
 */
export async function sendVerificationEmail(params) {
    const verifyUrl = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(params.token)}`;
    const greeting = params.firstName ? `Hello ${params.firstName},` : "Hello Supporter,";
    const content = `
    <h2 style="color: #ffffff; margin-top: 0; font-size: 22px; text-transform: uppercase;">Verify Your Fan Account</h2>
    <p>${greeting}</p>
    <p>Welcome to the official <strong>Bendel Insurance FC</strong> digital fan platform! Please verify your email address to complete your registration, access match tickets, secure official jerseys, and stay connected with the Benin Arsenal.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" class="btn" style="color: #021e10 !important;">Verify Email Address</a>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">If the button above does not work, copy and paste this link into your browser:</p>
    <p style="font-size: 12px; word-break: break-all; color: #f59e0b; background: #052614; padding: 10px; border-radius: 6px;">${verifyUrl}</p>

    <p style="font-size: 12px; color: #64748b; margin-top: 28px;">This verification link will expire in 24 hours. If you did not create an account on Bendel Insurance FC, please disregard this message.</p>
  `;
    return sendEmailViaResend({
        to: params.to,
        subject: "Verify your Bendel Insurance FC Account",
        html: emailLayout(content, "Verify your Bendel Insurance FC Fan Account"),
    });
}
/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params) {
    const resetUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(params.token)}`;
    const greeting = params.firstName ? `Hello ${params.firstName},` : "Hello Supporter,";
    const content = `
    <h2 style="color: #ffffff; margin-top: 0; font-size: 22px; text-transform: uppercase;">Password Reset Request</h2>
    <p>${greeting}</p>
    <p>We received a request to reset your password for your <strong>Bendel Insurance FC</strong> account. Click the button below to set a new password.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="btn" style="color: #021e10 !important;">Reset My Password</a>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">Or copy this link to your browser:</p>
    <p style="font-size: 12px; word-break: break-all; color: #f59e0b; background: #052614; padding: 10px; border-radius: 6px;">${resetUrl}</p>

    <p style="font-size: 12px; color: #64748b; margin-top: 28px;">This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
  `;
    return sendEmailViaResend({
        to: params.to,
        subject: "Reset your Bendel Insurance FC Password",
        html: emailLayout(content, "Password reset request for Bendel Insurance FC"),
    });
}
/**
 * Send football match ticket confirmation email
 */
export async function sendMatchTicketEmail(params) {
    const dateStr = params.eventDate
        ? new Date(params.eventDate).toLocaleDateString("en-NG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "Matchday - Check Fixture Guide";
    const venue = params.venue || "Samuel Ogbemudia Stadium, Benin City";
    const tier = params.seatTier || "VIP / Matchday Supporter";
    const qty = params.quantity || 1;
    const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge">E-TICKET CONFIRMATION</span>
      <h2 style="color: #f59e0b; margin: 12px 0 4px 0; font-size: 24px; text-transform: uppercase;">${params.matchName}</h2>
      <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Official NPFL / Cup Fixture</p>
    </div>

    <p>Dear <strong>${params.customerName}</strong>,</p>
    <p>Thank you for purchasing your matchday ticket for <strong>Bendel Insurance FC</strong>. Your e-ticket is ready and confirmed below:</p>

    <div class="ticket-card">
      <div style="border-bottom: 1px solid #16562f; padding-bottom: 12px; margin-bottom: 12px; display: flex; justify-content: space-between;">
        <span style="font-size: 11px; text-transform: uppercase; color: #f59e0b; font-weight: bold;">Ticket Code</span>
        <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #ffffff;">${params.ticketCode}</span>
      </div>

      <div style="margin: 10px 0;">
        <p style="margin: 4px 0; font-size: 13px; color: #8fa799;">Date & Time:</p>
        <p style="margin: 0; font-weight: bold; color: #ffffff;">${dateStr}</p>
      </div>

      <div style="margin: 10px 0;">
        <p style="margin: 4px 0; font-size: 13px; color: #8fa799;">Venue:</p>
        <p style="margin: 0; font-weight: bold; color: #ffffff;">${venue}</p>
      </div>

      <div style="margin: 10px 0;">
        <p style="margin: 4px 0; font-size: 13px; color: #8fa799;">Category / Tier:</p>
        <p style="margin: 0; font-weight: bold; color: #f59e0b;">${tier} (Qty: ${qty})</p>
      </div>

      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #16562f; text-align: center;">
        <p style="margin: 0 0 6px 0; font-size: 11px; color: #8fa799; text-transform: uppercase;">Present at the stadium entrance gate</p>
        <div style="background: #021e10; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 4px; color: #f59e0b; font-weight: bold;">
          ${params.ticketCode}
        </div>
      </div>
    </div>

    <h4 style="color: #ffffff; margin-top: 24px; text-transform: uppercase; font-size: 14px;">Matchday Instructions:</h4>
    <ul style="padding-left: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
      <li>Gates open 2 hours prior to kickoff.</li>
      <li>Have this email or screenshot of the ticket code ready on your mobile device.</li>
      <li>Wear your green and gold colours and bring the Arsenal spirit!</li>
    </ul>
  `;
    return sendEmailViaResend({
        to: params.to,
        subject: `Match Ticket: ${params.matchName} - Bendel Insurance FC`,
        html: emailLayout(content, `Match Ticket Confirmation for ${params.matchName}`),
    });
}
/**
 * Send jerseys and merchandise official store order receipt email
 */
export async function sendOrderReceiptEmail(params) {
    const qty = params.quantity || 1;
    const itemPrice = Number(params.amount);
    const delivery = Number(params.deliveryFee || 0);
    const grandTotal = Number(params.totalAmount || itemPrice + delivery);
    const formattedItemPrice = `₦${itemPrice.toLocaleString()}`;
    const formattedDelivery = delivery > 0 ? `₦${delivery.toLocaleString()}` : "Free (Pickup)";
    const formattedTotal = `₦${grandTotal.toLocaleString()}`;
    const fulfillmentDetails = params.deliveryMethod === "delivery"
        ? `<p style="margin: 4px 0; color: #ffffff;"><strong>Home Delivery:</strong> ${params.address || "Address specified on file"}</p>`
        : `<p style="margin: 4px 0; color: #ffffff;"><strong>Club Secretariat Pickup:</strong> Collect at the Official Club Secretariat, Samuel Ogbemudia Stadium, Benin City (Mon–Fri, 9am–5pm).</p>`;
    const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge">OFFICIAL STORE RECEIPT</span>
      <h2 style="color: #ffffff; margin: 12px 0 4px 0; font-size: 22px; text-transform: uppercase;">Thank You For Your Order!</h2>
      <p style="color: #f59e0b; margin: 0; font-size: 13px; font-family: monospace;">Order ID: ${params.orderId}</p>
    </div>

    <p>Dear <strong>${params.customerName}</strong>,</p>
    <p>Your order at the official <strong>Bendel Insurance FC Store</strong> has been received and confirmed. Here is your receipt summary:</p>

    <table class="receipt-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${params.itemName}</strong><br />
            <span style="font-size: 12px; color: #8fa799;">${params.itemCategory}</span>
          </td>
          <td style="text-align: center;">${qty}</td>
          <td style="text-align: right; font-weight: bold;">${formattedItemPrice}</td>
        </tr>
        <tr>
          <td colspan="2" style="color: #8fa799;">Delivery Fee (${params.deliveryMethod === "delivery" ? "Home Delivery" : "Pickup"})</td>
          <td style="text-align: right;">${formattedDelivery}</td>
        </tr>
        <tr style="border-top: 2px solid #f59e0b;">
          <td colspan="2" style="font-size: 16px; font-weight: bold; color: #f59e0b;">Total Paid</td>
          <td style="text-align: right; font-size: 18px; font-weight: bold; color: #f59e0b;">${formattedTotal}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #073b20; border-radius: 8px; padding: 18px; margin: 20px 0; font-size: 14px;">
      <h4 style="color: #f59e0b; margin: 0 0 8px 0; text-transform: uppercase; font-size: 13px;">Fulfillment Information:</h4>
      ${fulfillmentDetails}
      ${params.paymentReference ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #8fa799;">Payment Reference: <span style="font-family: monospace; color: #ffffff;">${params.paymentReference}</span></p>` : ""}
    </div>

    <p style="font-size: 13px; color: #cbd5e1;">For inquiries regarding your jersey or merch order, reach out to our team at <a href="mailto:admin@bendelinsurancefootball.com" style="color: #f59e0b;">admin@bendelinsurancefootball.com</a>.</p>
  `;
    return sendEmailViaResend({
        to: params.to,
        subject: `Order Receipt: ${params.itemName} - Bendel Insurance FC`,
        html: emailLayout(content, `Official store receipt for ${params.itemName}`),
    });
}
