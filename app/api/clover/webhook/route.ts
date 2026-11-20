import { NextResponse } from "next/server";
import { getOrderStore } from "@/lib/payments/orders";
import { parsePaymentEvent, verifyCloverSignature } from "@/lib/payments/webhook";

// Clover calls this after a Hosted Checkout payment. This is the only place an order is
// marked paid: the browser returning to the success page proves nothing.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyCloverSignature(rawBody, request.headers.get("clover-signature"), process.env.CLOVER_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parsePaymentEvent(json);
  // Anything that is not an approved payment is acknowledged and ignored, so Clover does not keep retrying.
  if (!event || event.type !== "PAYMENT" || event.status !== "APPROVED") return NextResponse.json({ ok: true });

  const store = getOrderStore();
  if (!store) return NextResponse.json({ error: "Orders are not configured" }, { status: 503 });

  const order = await store.findBySessionId(event.sessionId);
  if (!order) return NextResponse.json({ ok: true, ignored: "unknown session" });

  await store.markPaid(event.sessionId, event.paymentId);
  return NextResponse.json({ ok: true });
}
