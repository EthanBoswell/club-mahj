import { MEMBERSHIP_PRODUCT } from "./catalog";
import type { Membership, MembershipStore } from "./memberships";
import type { Order, OrderStore } from "./orders";

/** Days after the paid month ends that a member keeps member pricing while they renew. */
export const GRACE_DAYS = 3;
/** How many days before the month ends the "renew soon" email goes out. */
export const REMIND_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

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

export type MembershipState =
  | { kind: "none" }
  | { kind: "active"; paidThrough: Date }
  | { kind: "grace"; paidThrough: Date; accessUntil: Date }
  | { kind: "expired"; paidThrough: Date };

export function membershipState(m: Membership | null, now: Date): MembershipState {
  if (!m) return { kind: "none" };
  const paidThrough = new Date(m.paidThrough);
  const accessUntil = new Date(paidThrough.getTime() + GRACE_DAYS * DAY_MS);
  if (now < paidThrough) return { kind: "active", paidThrough };
  if (now < accessUntil) return { kind: "grace", paidThrough, accessUntil };
  return { kind: "expired", paidThrough };
}

/** Whether the member gets member pricing right now. */
export function hasAccess(m: Membership | null, now: Date): boolean {
  const kind = membershipState(m, now).kind;
  return kind === "active" || kind === "grace";
}

/**
 * Adds paid time. Renewing early stacks onto the current end date, and renewing during the
 * grace period keeps the monthly rhythm. Renewing after that starts a fresh month from today.
 */
export function extendMembership(existing: Membership | null, userId: string, now: Date, months = 1): Membership {
  const continues = existing && new Date(existing.paidThrough).getTime() + GRACE_DAYS * DAY_MS > now.getTime();
  const base = continues ? new Date(existing!.paidThrough) : now;
  return {
    userId,
    startedAt: existing?.startedAt ?? now.toISOString(),
    paidThrough: addMonths(base, months).toISOString(),
    remindersEnabled: existing?.remindersEnabled ?? true,
    upcomingRemindedFor: existing?.upcomingRemindedFor ?? null,
    graceRemindedFor: existing?.graceRemindedFor ?? null,
  };
}

export type ApplyResult = "applied" | "already_applied" | "ignored";

/**
 * Called when a paid order comes in. For a membership order, adds the month. The claim makes this
 * safe if Clover delivers the same webhook twice, and it is given back if saving fails so a
 * retry can finish the job.
 */
export async function applyMembershipPayment(
  deps: { store: MembershipStore; orders: OrderStore; now?: () => Date },
  order: Order,
): Promise<ApplyResult> {
  if (order.productId !== MEMBERSHIP_PRODUCT.id || !order.userId) return "ignored";
  if (!(await deps.orders.claimFulfillment(order.id))) return "already_applied";
  try {
    const now = (deps.now ?? (() => new Date()))();
    const existing = await deps.store.get(order.userId);
    await deps.store.save(extendMembership(existing, order.userId, now));
    return "applied";
  } catch (e) {
    await deps.orders.releaseFulfillment(order.id);
    throw e;
  }
}

export async function setReminders(store: MembershipStore, userId: string, enabled: boolean): Promise<void> {
  const m = await store.get(userId);
  if (m) await store.save({ ...m, remindersEnabled: enabled });
}

export type ReminderKind = "upcoming" | "grace";
export type Mailer = (message: { to: string; subject: string; text: string; html: string }) => Promise<void>;
export type ReminderTemplate = (input: { kind: ReminderKind; name?: string; paidThrough: Date; accessUntil: Date }) => { subject: string; text: string; html: string };

export type ReminderSummary = { sent: number; skipped: number; failed: number };

/**
 * Emails members who are close to running out, or have just run out. Each member gets at most one
 * "renew soon" and one "just ended" email per month. A failed send is not recorded, so the next run
 * tries again, and one member's failure never stops the others.
 */
export async function runReminders(
  deps: { store: MembershipStore; send: Mailer; template: ReminderTemplate; now?: () => Date },
): Promise<ReminderSummary> {
  const now = (deps.now ?? (() => new Date()))();
  const summary: ReminderSummary = { sent: 0, skipped: 0, failed: 0 };

  for (const m of await deps.store.list()) {
    const state = membershipState(m, now);
    const paidThrough = new Date(m.paidThrough);
    const kind: ReminderKind | null =
      state.kind === "active" && now.getTime() >= paidThrough.getTime() - REMIND_DAYS * DAY_MS && m.upcomingRemindedFor !== m.paidThrough ? "upcoming"
      : state.kind === "grace" && m.graceRemindedFor !== m.paidThrough ? "grace"
      : null;

    if (!kind || !m.remindersEnabled) { summary.skipped++; continue; }

    try {
      const contact = await deps.store.contact(m.userId);
      if (!contact) { summary.skipped++; continue; }
      const accessUntil = new Date(paidThrough.getTime() + GRACE_DAYS * DAY_MS);
      const email = deps.template({ kind, name: contact.name, paidThrough, accessUntil });
      await deps.send({ to: contact.email, ...email });
      await deps.store.save(kind === "upcoming" ? { ...m, upcomingRemindedFor: m.paidThrough } : { ...m, graceRemindedFor: m.paidThrough });
      summary.sent++;
    } catch {
      summary.failed++;
    }
  }
  return summary;
}
