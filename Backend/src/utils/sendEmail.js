const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generic email sender (for approval/rejection etc.)
const sendEmail = async ({ to, subject, text, html }) => {
  await transporter.sendMail({
    from: `"EaseService" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

// OTP email sender (for start/complete job)
const sendOTPEmail = async (toEmail, otp, action) => {
  const subject = action === "start" ? "Start Job OTP" : "Complete Job OTP";
  const html = `<p>Your OTP to ${action} the job is: <b>${otp}</b></p><p>This OTP is valid for 5 minutes.</p>`;
  await sendEmail({ to: toEmail, subject, html });
};

module.exports = { sendEmail, sendOTPEmail };