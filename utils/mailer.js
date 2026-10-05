const nodemailer = require('nodemailer');

function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
}

/**
 * Send OTP Code to user email
 */
async function sendOtpEmail(email, otp) {
  const timeStr = new Date().toLocaleTimeString();
  const transporter = getTransporter();

  console.log(`\n┌──────────────────────────────────────────────────────────┐`);
  console.log(`│ 📧 OTP REQUEST LOG [${timeStr}]`);
  console.log(`├──────────────────────────────────────────────────────────┤`);
  console.log(`│ Target Email : ${email}`);
  console.log(`│ OTP Code     : ${otp}`);
  console.log(`│ SMTP Config  : ${transporter ? '✅ Active (' + process.env.SMTP_HOST + ')' : '⚠️ Not Configured (Console Log Only)'}`);
  console.log(`└──────────────────────────────────────────────────────────┘\n`);

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"OneStep Journey" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your Login Code — OneStep Journey',
        text: `Your OneStep Journey verification code is: ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #12131C; color: #E2E8F0; border-radius: 8px;">
            <h2 style="color: #6C63FF; margin-top: 0;">OneStep Journey</h2>
            <p style="font-size: 16px;">Here is your verification code to log in:</p>
            <div style="background-color: #1C1D2A; display: inline-block; padding: 12px 24px; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #4ECDC4; border-radius: 6px; margin: 16px 0;">
              ${otp}
            </div>
            <p style="font-size: 14px; color: #94A3B8;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      });
      console.log(`✅ [SMTP SUCCESS] Email sent to ${email} (MessageID: ${info.messageId})\n`);
    } catch (err) {
      console.error(`❌ [SMTP ERROR] Failed to send email to ${email}:`, err.message, '\n');
    }
  } else {
    console.log(`ℹ️ [NOTE] To send real emails to inbox, configure SMTP_HOST, SMTP_USER, SMTP_PASS in server/.env\n`);
  }
}

module.exports = { sendOtpEmail };
