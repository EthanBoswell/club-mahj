import { createHmac, timingSafeEqual } from "node:crypto";

// Clover-Signature looks like "t=1642599079,v1=<hex>". The signature is
// HMAC-SHA256 over "<t>.<raw request body>" using the webhook signing secret.
export function verifyCloverSignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return i < 0 ? [kv.trim(), ""] : [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CloverPaymentEvent = {
  type: string;
  status: string;
  paymentId: string;
  sessionId: string;
};

// The docs list the fields (Type, Status, Id, MerchantId, Data) without showing the
// JSON key casing, so read them case-insensitively.
export function parsePaymentEvent(raw: unknown): CloverPaymentEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const lower = Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k.toLowerCase(), v]));
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const event = {
    type: str(lower.type).toUpperCase(),
    status: str(lower.status).toUpperCase(),
    paymentId: str(lower.id),
    sessionId: str(lower.data),
  };
  return event.type && event.sessionId ? event : null;
}
