// src/config/constants.ts

export const adminEmail = process.env.ADMIN_EMAIL || "vynox@admin.com";
export const adminPassword = process.env.ADMIN_PASSWORD || "ffffff";
export const limit = process.env.LIMIT || 50;
export const serverStatsPort = process.env.SERVER_STATS_PORT || 3001;

export const smtpHost = process.env.SMTP_HOST || "localhost";
export const smtpPort = Number(process.env.SMTP_PORT) || 587;
export const smtpUser = process.env.SMTP_USERNAME || "";
export const smtpPass = process.env.SMTP_PASSWORD || "";
export const smtpFrom = process.env.SMTP_FROM_ADDRESS || smtpUser;
export const smtpEncryption = process.env.SMTP_ENCRYPTION || "tls";

export const receiversEmails: string[] = process.env.RECEIVERS_EMAILS
  ? process.env.RECEIVERS_EMAILS.split(",").map((e) => e.trim())
  : ["vynox@admin.com"];
