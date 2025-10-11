// src/utils/sendServerDownEmail.ts

import nodemailer from "nodemailer";
import * as CF from "../config/constants";

export async function sendServerDownEmail(ip: string) {
  // Secure should be true if encryption is 'ssl'
  const isSecure = CF.smtpEncryption.toLowerCase() === "ssl";

  const transporter = nodemailer.createTransport({
    host: CF.smtpHost,
    port: CF.smtpPort,
    secure: isSecure,
    auth: {
      user: CF.smtpUser,
      pass: CF.smtpPass,
    },
  });

  const mailOptions = {
    from: `"Vynox Alerts" <${CF.smtpFrom}>`,
    to: CF.receiversEmails.join(","),
    subject: `🚨 Server Down Alert: ${ip}`,
    html: `
      <h2>Server Down Notification</h2>
      <p>The following server appears to be down:</p>
      <pre><strong>IP:</strong> ${ip}</pre>
      <p>Please investigate immediately.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}
