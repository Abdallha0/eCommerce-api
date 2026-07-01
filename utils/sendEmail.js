const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * @param {object} options - { to, subject, html }
 */
const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"SEF Store" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

// Email templates
const otpEmailHtml = (otp) => `
  <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #eee;border-radius:8px;">
    <h2 style="color:#111;">Verify your email</h2>
    <p>Use the code below to complete your registration. It expires in <strong>10 minutes</strong>.</p>
    <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px 0;color:#4f46e5;">${otp}</div>
    <p style="color:#999;font-size:13px;">If you didn't request this, ignore this email.</p>
  </div>
`;

const orderConfirmationHtml = (order, user) => {
  const rows = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${(item.price * item.quantity).toFixed(2)} EGP</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;">
      <h2 style="color:#111;">Order Confirmed ✓</h2>
      <p>Hi ${user.username}, your order <strong>#${order._id}</strong> has been placed.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;text-align:left;">Product</th>
            <th style="padding:8px;text-align:center;">Qty</th>
            <th style="padding:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;max-width:300px;margin-left:auto;">
        <tr><td>Subtotal</td><td style="text-align:right;">${order.subtotal.toFixed(2)} EGP</td></tr>
        <tr><td>Shipping</td><td style="text-align:right;">${order.shippingFee.toFixed(2)} EGP</td></tr>
        <tr><td>Tax (14%)</td><td style="text-align:right;">${order.tax.toFixed(2)} EGP</td></tr>
        ${order.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right;color:green;">-${order.discount.toFixed(2)} EGP</td></tr>` : ''}
        <tr style="font-weight:bold;font-size:16px;border-top:2px solid #111;">
          <td>Total</td><td style="text-align:right;">${order.totalPrice.toFixed(2)} EGP</td>
        </tr>
      </table>
    </div>
  `;
};

const orderStatusHtml = (order, user) => `
  <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #eee;border-radius:8px;">
    <h2 style="color:#111;">Order Update</h2>
    <p>Hi ${user.username}, your order <strong>#${order._id}</strong> status has changed to:</p>
    <div style="font-size:24px;font-weight:bold;text-align:center;padding:16px;background:#f5f5f5;border-radius:6px;margin:16px 0;text-transform:uppercase;">${order.status}</div>
    <p style="color:#999;font-size:13px;">Thank you for shopping with SEF Store.</p>
  </div>
`;

const resetPasswordHtml = (otp) => `
  <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #eee;border-radius:8px;">
    <h2 style="color:#111;">Reset Your Password</h2>
    <p>Use the code below to reset your password. It expires in <strong>15 minutes</strong>.</p>
    <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px 0;color:#4f46e5;">${otp}</div>
    <p style="color:#999;font-size:13px;">If you didn't request this, ignore this email.</p>
  </div>
`;

module.exports = { sendEmail, otpEmailHtml, orderConfirmationHtml, orderStatusHtml, resetPasswordHtml };
