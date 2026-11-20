// Clover Hosted Checkout client. The member pays on Clover's own page, so card
// details never touch this site. Docs: https://docs.clover.com/dev/docs/creating-a-hosted-checkout-session
export type CheckoutLineItem = { name: string; note?: string; price: number; unitQty: number };

export type CreateCheckoutInput = {
  lineItems: CheckoutLineItem[];
  email?: string;
  successUrl: string;
  failureUrl: string;
};

export type CheckoutSession = { href: string; checkoutSessionId: string; expirationTime?: number };

export class CloverError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CloverError";
  }
}

export function cloverConfig() {
  const token = process.env.CLOVER_API_TOKEN;
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  // Defaults to the sandbox. Set CLOVER_API_BASE for production.
  const baseUrl = (process.env.CLOVER_API_BASE ?? "https://apisandbox.dev.clover.com").replace(/\/$/, "");
  if (!token || !merchantId) return null;
  return { token, merchantId, baseUrl };
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
  const cfg = cloverConfig();
  if (!cfg) throw new CloverError("Clover is not configured");

  // Clover requires a customer object; it may be empty.
  const customer = input.email ? { email: input.email } : {};
  const res = await fetch(`${cfg.baseUrl}/invoicingcheckoutservice/v1/checkouts`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${cfg.token}`,
      "X-Clover-Merchant-Id": cfg.merchantId,
    },
    body: JSON.stringify({
      customer,
      shoppingCart: { lineItems: input.lineItems },
      redirectUrls: { success: input.successUrl, failure: input.failureUrl },
    }),
  });

  if (!res.ok) throw new CloverError(`Clover checkout request failed (${res.status})`, res.status);
  const data = (await res.json()) as Partial<CheckoutSession>;
  if (!data.href || !data.checkoutSessionId) throw new CloverError("Clover checkout response was missing href or checkoutSessionId");
  return { href: data.href, checkoutSessionId: data.checkoutSessionId, expirationTime: data.expirationTime };
}
