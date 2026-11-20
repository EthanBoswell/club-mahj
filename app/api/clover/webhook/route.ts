import { NextResponse } from "next/server";
import { MEMBERSHIP_PRODUCT } from "@/lib/payments/catalog";
import { getMembershipStore } from "@/lib/payments/memberships";
import { applyMembershipPayment } from "@/lib/payments/membership-service";
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

  const orders = getOrderStore();
  if (!orders) return NextResponse.json({ error: "Orders are not configured" }, { status: 503 });

  const found = await orders.findBySessionId(event.sessionId);
  if (!found) return NextResponse.json({ ok: true, ignored: "unknown session" });

  const order = (await orders.markPaid(event.sessionId, event.paymentId)) ?? found;

  // Only a membership payment has anything more to do: it adds a month. If that fails we answer
  // with an error so Clover retries.
  if (order.productId !== MEMBERSHIP_PRODUCT.id) return NextResponse.json({ ok: true });
  const members = getMembershipStore();
  if (!members) return NextResponse.json({ error: "Memberships are not configured" }, { status: 503 });
  try {
    await applyMembershipPayment({ store: members, orders }, order);
  } catch {
    return NextResponse.json({ error: "Could not apply the payment" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
