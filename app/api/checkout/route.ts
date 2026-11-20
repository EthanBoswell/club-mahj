import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { MAX_QUANTITY, getProduct } from "@/lib/payments/catalog";
import { cloverConfig, createCheckoutSession } from "@/lib/payments/clover";
import { getOrderStore } from "@/lib/payments/orders";

// Starts a Clover Hosted Checkout for one product, records a pending order, and sends the
// browser to Clover's payment page. The price always comes from the server-side catalog.
export async function POST(request: Request) {
  const form = await request.formData();
  const productId = String(form.get("productId") ?? "");
  const quantity = Number(form.get("quantity") ?? 1);

  const product = getProduct(productId);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const origin = (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const store = getOrderStore();
  if (!cloverConfig() || !store) {
    // Not configured (for example preview mode): send them back with a message instead of failing.
    return NextResponse.redirect(`${origin}/academy?checkout=unavailable`, 303);
  }

  const user = await getUser();
  const session = await createCheckoutSession({
    lineItems: [{ name: product.name, note: product.note, price: product.priceCents, unitQty: quantity }],
    email: user?.email || undefined,
    successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    failureUrl: `${origin}/checkout/failed`,
  });

  await store.create({
    productId: product.id,
    quantity,
    amountCents: product.priceCents * quantity,
    cloverSessionId: session.checkoutSessionId,
    email: user?.email || null,
    userId: user?.id ?? null,
  });

  return NextResponse.redirect(session.href, 303);
}
