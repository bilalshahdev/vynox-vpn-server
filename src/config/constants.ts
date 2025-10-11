// src/config/constants.ts

export const adminEmail = process.env.ADMIN_EMAIL || "vynox@admin.com";
export const adminPassword = process.env.ADMIN_PASSWORD || "ffffff";
export const limit = process.env.LIMIT || 50;

export const smtpHost = process.env.MAIL_HOST || "localhost";
export const smtpPort = Number(process.env.MAIL_PORT) || 587;
export const smtpUser = process.env.MAIL_USERNAME || "";
export const smtpPass = process.env.MAIL_PASSWORD || "";
export const smtpFrom = process.env.MAIL_FROM_ADDRESS || smtpUser;
export const smtpEncryption = process.env.MAIL_ENCRYPTION || "tls";

export const receiversEmails: string[] = process.env.RECEIVERS_EMAILS
  ? process.env.RECEIVERS_EMAILS.split(",").map((e) => e.trim())
  : ["vynox@admin.com"];
