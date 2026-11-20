// Clover card-on-file, charge and subscription calls used for membership.
// Docs: https://docs.clover.com/dev/docs/save-a-card-for-future-transactions
//       https://docs.clover.com/dev/docs/recurring-apis-subscriptions
import { CloverError, cloverConfig } from "./clover";

// Customers and charges live on a different host from the checkout and recurring APIs.
export const sclBase = () => (process.env.CLOVER_SCL_BASE ?? "https://scl-sandbox.dev.clover.com").replace(/\/$/, "");

async function call<T>(kind: "api" | "scl", method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const cfg = cloverConfig();
  if (!cfg) throw new CloverError("Clover is not configured");
  const base = kind === "scl" ? sclBase() : cfg.baseUrl;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "User-Agent": "club-mahj/1.0",
      authorization: `Bearer ${cfg.token}`,
      "X-Clover-Merchant-Id": cfg.merchantId,
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (!res.ok) throw new CloverError(`Clover ${method} ${path.replace(/[A-Za-z0-9]{10,}/g, ":id")} failed (${res.status})`, res.status);
  return (await res.json()) as T;
}

/** Saves the card behind a single-use clv_ token as a card on file. */
export async function createCustomer(input: { email: string; name?: string; source: string }): Promise<{ id: string }> {
  const data = await call<{ id?: string }>("scl", "POST", "/v1/customers", {
    body: { email: input.email, ...(input.name ? { firstName: input.name } : {}), source: input.source },
  });
  if (!data.id) throw new CloverError("Clover customer response was missing an id");
  return { id: data.id };
}

/** Charges the customer's saved card. Amount is in cents. */
export async function createCharge(input: { amountCents: number; customerId: string; idempotencyKey: string; clientIp: string }): Promise<{ id: string; paid: boolean }> {
  const data = await call<{ id?: string; paid?: boolean; status?: string }>("scl", "POST", "/v1/charges", {
    headers: { "idempotency-key": input.idempotencyKey, "x-forwarded-for": input.clientIp },
    body: { amount: input.amountCents, currency: "usd", source: input.customerId },
  });
  return { id: data.id ?? "", paid: data.paid === true && data.status === "succeeded" };
}

export async function createSubscription(input: { planId: string; customerId: string; startDate: string }): Promise<{ id: string }> {
  const data = await call<{ id?: string }>("api", "POST", `/recurring/v1/plans/${encodeURIComponent(input.planId)}/subscriptions`, {
    body: { collectionMethod: "CHARGE_AUTOMATICALLY", customerId: input.customerId, startDate: input.startDate },
  });
  if (!data.id) throw new CloverError("Clover subscription response was missing an id");
  return { id: data.id };
}

export async function setSubscriptionActive(subscriptionId: string, active: boolean): Promise<void> {
  await call("api", "PUT", `/recurring/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { body: { active } });
}

export async function getSubscription(subscriptionId: string): Promise<{ active: boolean }> {
  const data = await call<{ active?: boolean }>("api", "GET", `/recurring/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return { active: data.active === true };
}

export type Recurring = {
  createCustomer: typeof createCustomer;
  createCharge: typeof createCharge;
  createSubscription: typeof createSubscription;
  setSubscriptionActive: typeof setSubscriptionActive;
  getSubscription: typeof getSubscription;
};

export const recurring: Recurring = { createCustomer, createCharge, createSubscription, setSubscriptionActive, getSubscription };
