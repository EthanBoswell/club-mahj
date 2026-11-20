import { MEMBERSHIP } from "./catalog";
import { CloverError } from "./clover";
import { hasAccess, type Membership, type MembershipStore } from "./memberships";
import type { Recurring } from "./recurring";

export type Deps = {
  store: MembershipStore;
  clover: Recurring;
  planId: string | undefined;
  now?: () => Date;
  uuid?: () => string;
};

export type SubscribeResult =
  | { ok: true; membership: Membership; renewalsSetUp: boolean }
  | { ok: false; code: "consent_required" | "not_configured" | "already_member" | "payment_failed" | "payment_error"; message: string };

/** Adds calendar months in UTC, clamping to the end of a shorter month (Jan 31 + 1 month = Feb 28). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** First billing date after `now`, given the first renewal date and monthly billing. */
export function nextBillingDate(firstRenewal: Date, now: Date): Date {
  let k = 0;
  let next = firstRenewal;
  while (next <= now && k < 600) next = addMonths(firstRenewal, ++k);
  return next;
}

/**
 * Charges the first month straight away (so we know it worked), then starts a monthly
 * subscription one month later for the renewals. The member's row is saved as soon as the
 * charge succeeds, so someone who has paid is never left without a record.
 */
export async function subscribeMember(
  deps: Deps,
  input: { userId: string; email: string; name?: string; token: string; clientIp: string; consent: boolean },
): Promise<SubscribeResult> {
  const now = (deps.now ?? (() => new Date()))();
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  if (!input.consent) return { ok: false, code: "consent_required", message: "Please agree to the monthly charge to continue." };
  if (!deps.planId) return { ok: false, code: "not_configured", message: "Membership billing is not set up yet." };

  const existing = await deps.store.get(input.userId);
  if (hasAccess(existing, now)) return { ok: false, code: "already_member", message: "You already have an active membership." };

  // A pending row keeps its idempotency key, so retrying after a timeout cannot charge twice.
  // Any other past state gets a fresh key: reusing one would just replay the old charge.
  let m: Membership = existing?.status === "pending"
    ? existing
    : {
        userId: input.userId, status: "pending", idempotencyKey: uuid(), cloverCustomerId: null,
        cloverSubscriptionId: null, startedAt: null, paidThrough: null, canceledAt: null, billingIssue: null,
      };
  await deps.store.save(m);

  let charge;
  try {
    const customer = await deps.clover.createCustomer({ email: input.email, name: input.name, source: input.token });
    m = { ...m, cloverCustomerId: customer.id };
    await deps.store.save(m);
    charge = await deps.clover.createCharge({
      amountCents: MEMBERSHIP.priceCents, customerId: customer.id, idempotencyKey: m.idempotencyKey, clientIp: input.clientIp,
    });
  } catch (e) {
    // A 4xx means Clover rejected the request outright, so a retry needs a new key.
    // Anything else (network, 5xx) might have gone through: keep the key so a retry is safe.
    if (e instanceof CloverError && e.status !== undefined && e.status >= 400 && e.status < 500) {
      await deps.store.save({ ...m, idempotencyKey: uuid() });
      return { ok: false, code: "payment_failed", message: "Your card could not be charged. Please check the details or try another card." };
    }
    return { ok: false, code: "payment_error", message: "We could not confirm your payment. Please wait a minute and try again." };
  }

  if (!charge.paid) {
    await deps.store.save({ ...m, idempotencyKey: uuid() });
    return { ok: false, code: "payment_failed", message: "Your card was declined. Please try another card." };
  }

  const firstRenewal = addMonths(now, 1);
  m = { ...m, status: "active", startedAt: now.toISOString(), paidThrough: firstRenewal.toISOString(), billingIssue: null };
  await deps.store.save(m);

  try {
    const sub = await deps.clover.createSubscription({ planId: deps.planId, customerId: m.cloverCustomerId!, startDate: firstRenewal.toISOString() });
    m = { ...m, cloverSubscriptionId: sub.id };
    await deps.store.save(m);
    return { ok: true, membership: m, renewalsSetUp: true };
  } catch {
    // They have paid for the first month, so keep them active but flag that renewals need attention.
    m = { ...m, billingIssue: "subscription_setup_failed" };
    await deps.store.save(m);
    return { ok: true, membership: m, renewalsSetUp: false };
  }
}

export type CancelResult =
  | { ok: true; membership: Membership }
  | { ok: false; code: "not_found" | "cancel_failed"; message: string };

/** Stops future billing. The member keeps access until the end of the month they already paid for. */
export async function cancelMembership(deps: Deps, input: { userId: string }): Promise<CancelResult> {
  const now = (deps.now ?? (() => new Date()))();
  const m = await deps.store.get(input.userId);
  if (!m || m.status !== "active") return { ok: false, code: "not_found", message: "There is no active membership to cancel." };

  if (m.cloverSubscriptionId) {
    try {
      await deps.clover.setSubscriptionActive(m.cloverSubscriptionId, false);
    } catch {
      // Do not mark it cancelled locally if billing was not actually stopped.
      return { ok: false, code: "cancel_failed", message: "We could not cancel your billing just now. You have not been cancelled; please try again." };
    }
  }

  // Renewals happen monthly from the first renewal date, so access runs to the next one after today.
  const paidThrough = m.paidThrough ? nextBillingDate(new Date(m.paidThrough), now) : now;
  const updated: Membership = { ...m, status: "canceled", canceledAt: now.toISOString(), paidThrough: paidThrough.toISOString() };
  await deps.store.save(updated);
  return { ok: true, membership: updated };
}

/** Refreshes a member's status from Clover: a subscription Clover has deactivated (for example after failed renewals) means the membership lapsed. */
export async function syncMembership(deps: Deps, userId: string): Promise<Membership | null> {
  const m = await deps.store.get(userId);
  if (!m || m.status !== "active" || !m.cloverSubscriptionId) return m;
  try {
    const sub = await deps.clover.getSubscription(m.cloverSubscriptionId);
    if (!sub.active) {
      const lapsed: Membership = { ...m, status: "lapsed", billingIssue: "renewal_failed" };
      await deps.store.save(lapsed);
      return lapsed;
    }
  } catch {
    // Clover is unreachable: keep what we know rather than locking a paying member out.
  }
  return m;
}
