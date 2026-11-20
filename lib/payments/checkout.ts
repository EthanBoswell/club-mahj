import type { Product } from "./catalog";
import { CloverError, cloverConfig, createCheckoutSession } from "./clover";
import { getOrderStore } from "./orders";

/**
 * Starts a Clover Hosted Checkout and records a pending order. Returns where to send the browser:
 * Clover's payment page, or back to `backTo` with a message when payments are off or Clover fails.
 */
export async function startCheckout(input: {
  product: Product;
  quantity: number;
  user: { id: string; email: string } | null;
  origin: string;
  backTo: string;
}): Promise<string> {
  const { product, quantity, user, origin, backTo } = input;
  const store = getOrderStore();
  if (!cloverConfig() || !store) return `${origin}${backTo}?checkout=unavailable`;

  let session;
  try {
    session = await createCheckoutSession({
      lineItems: [{ name: product.name, note: product.note, price: product.priceCents, unitQty: quantity }],
      email: user?.email || undefined,
      successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      failureUrl: `${origin}/checkout/failed`,
    });
  } catch (e) {
    // Clover being down or rejecting the request should show a message, not an error page.
    if (e instanceof CloverError) return `${origin}${backTo}?checkout=error`;
    throw e;
  }

  await store.create({
    productId: product.id,
    quantity,
    amountCents: product.priceCents * quantity,
    cloverSessionId: session.checkoutSessionId,
    email: user?.email || null,
    userId: user?.id ?? null,
  });
  return session.href;
}
