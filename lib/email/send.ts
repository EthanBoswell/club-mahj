import nodemailer from "nodemailer";

export type EmailMessage = { to: string; subject: string; text: string; html: string };

/** True when SMTP details are set. The same details can be used for Supabase's sign-up emails. */
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!emailConfigured()) throw new Error("Email is not configured");
  // A blank or non-numeric SMTP_PORT falls back to the standard submission port.
  const port = Number(process.env.SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.EMAIL_FROM, ...message });
}
