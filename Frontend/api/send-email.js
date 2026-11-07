import nodemailer from "nodemailer";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { to, subject, text, html, auth, from } = body || {};
  const smtpUser = auth?.user || process.env.SMTP_USER;
  const smtpPass = auth?.pass || process.env.SMTP_PASSWORD;

  if (!to || !smtpUser || !smtpPass) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters: 'to', 'auth.user', and 'auth.pass'",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Gmail port 587 requires STARTTLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });

    const info = await transporter.sendMail({
      from: from || `SAFAR <${smtpUser}>`,
      to,
      subject: subject || "Your SAFAR verification code",
      text,
      html,
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
    });
  } catch (error) {
    console.error("[Vercel Email Relay Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to send email via SMTP",
    });
  }
}
