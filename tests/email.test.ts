import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

import { emailConfigured, sendEmail } from "@/lib/email/send";
import { renewalEmail } from "@/lib/email/templates";

const paidThrough = new Date("2026-04-10T12:00:00.000Z");
const accessUntil = new Date("2026-04-13T12:00:00.000Z");

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://club.example/");
  vi.stubEnv("SMTP_HOST", "smtp.example");
  vi.stubEnv("SMTP_USER", "user");
  vi.stubEnv("SMTP_PASS", "pass");
  vi.stubEnv("EMAIL_FROM", "Club Mahj <hello@club.example>");
  vi.stubEnv("SMTP_PORT", "");
  sendMail.mockReset().mockResolvedValue(undefined);
  createTransport.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("renewalEmail", () => {
  it("tells the member their end date, the price, and links to the membership page", () => {
    const e = renewalEmail({ kind: "upcoming", name: "Mae", paidThrough, accessUntil });
    expect(e.subject).toBe("Time to renew your Club Mahj membership");
    for (const body of [e.text, e.html]) {
      expect(body).toContain("April 10, 2026");
      expect(body).toContain("$50");
      expect(body).toContain("https://club.example/membership");
    }
    expect(e.text).toContain("Hi Mae,");
    expect(e.text).toContain("do not renew automatically");
  });

  it("says when member pricing ends in the grace email", () => {
    const e = renewalEmail({ kind: "grace", paidThrough, accessUntil });
    expect(e.subject).toBe("Your Club Mahj membership has ended");
    expect(e.text).toContain("April 13, 2026");
    expect(e.text.startsWith("Hi,")).toBe(true);
  });

  it("escapes a member's name in the html version", () => {
    const e = renewalEmail({ kind: "upcoming", name: '<b>"Mae"</b>', paidThrough, accessUntil });
    expect(e.html).not.toContain("<b>");
    expect(e.html).toContain("&lt;b&gt;");
  });

  it("mentions how to stop the reminders", () => {
    expect(renewalEmail({ kind: "upcoming", paidThrough, accessUntil }).text).toContain("turn these reminders off");
  });
});

describe("sendEmail", () => {
  const message = { to: "m@club.example", subject: "s", text: "t", html: "<p>t</p>" };

  it("sends through SMTP with the configured sender, defaulting to the submission port", async () => {
    await sendEmail(message);
    expect(createTransport).toHaveBeenCalledWith({ host: "smtp.example", port: 587, secure: false, auth: { user: "user", pass: "pass" } });
    expect(sendMail).toHaveBeenCalledWith({ from: "Club Mahj <hello@club.example>", ...message });
  });

  it("uses a secure connection on port 465", async () => {
    vi.stubEnv("SMTP_PORT", "465");
    await sendEmail(message);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true }));
  });

  it("refuses to send, without connecting, when email is not configured", async () => {
    vi.stubEnv("SMTP_PASS", "");
    expect(emailConfigured()).toBe(false);
    await expect(sendEmail(message)).rejects.toThrow("not configured");
    expect(createTransport).not.toHaveBeenCalled();
  });
});
