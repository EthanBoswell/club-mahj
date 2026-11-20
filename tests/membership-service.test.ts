import { describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_PRODUCT } from "@/lib/payments/catalog";
import {
  GRACE_DAYS, REMIND_DAYS, addMonths, applyMembershipPayment, extendMembership, hasAccess, membershipState, runReminders, setReminders,
} from "@/lib/payments/membership-service";
import type { Order } from "@/lib/payments/orders";
import { NOW, day, fakeMembershipStore, member } from "./membership-helpers";
import { fakeStore } from "./helpers";

describe("addMonths", () => {
  it("adds calendar months, clamping to the end of a shorter month", () => {
    expect(addMonths(new Date("2026-03-10T12:00:00Z"), 1).toISOString()).toBe("2026-04-10T12:00:00.000Z");
    expect(addMonths(new Date("2026-12-15T00:00:00Z"), 1).toISOString()).toBe("2027-01-15T00:00:00.000Z");
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });
});

describe("membershipState / hasAccess", () => {
  it("is none without a membership", () => {
    expect(membershipState(null, NOW)).toEqual({ kind: "none" });
    expect(hasAccess(null, NOW)).toBe(false);
  });

  it("is active until the paid month ends", () => {
    expect(membershipState(member({ paidThrough: day(1) }), NOW).kind).toBe("active");
    expect(hasAccess(member({ paidThrough: day(1) }), NOW)).toBe(true);
  });

  it("keeps access through the grace period, then stops", () => {
    expect(membershipState(member({ paidThrough: day(-1) }), NOW).kind).toBe("grace");
    expect(hasAccess(member({ paidThrough: day(-(GRACE_DAYS - 0.5)) }), NOW)).toBe(true);
    expect(membershipState(member({ paidThrough: day(-GRACE_DAYS - 0.5) }), NOW).kind).toBe("expired");
    expect(hasAccess(member({ paidThrough: day(-GRACE_DAYS - 0.5) }), NOW)).toBe(false);
  });

  it("ends access exactly when the paid month runs out, not a moment later", () => {
    expect(membershipState(member({ paidThrough: NOW.toISOString() }), NOW).kind).toBe("grace");
  });
});

describe("extendMembership", () => {
  it("starts a new member's first month from today", () => {
    const m = extendMembership(null, "u1", NOW);
    expect(m).toMatchObject({ userId: "u1", startedAt: NOW.toISOString(), paidThrough: "2026-04-10T12:00:00.000Z", remindersEnabled: true });
  });

  it("stacks an early renewal onto the current end date, so no paid time is lost", () => {
    const m = extendMembership(member({ paidThrough: "2026-03-20T12:00:00.000Z" }), "u1", NOW);
    expect(m.paidThrough).toBe("2026-04-20T12:00:00.000Z");
  });

  it("keeps the monthly rhythm when renewing late but inside the grace period", () => {
    const m = extendMembership(member({ paidThrough: "2026-03-08T12:00:00.000Z" }), "u1", NOW);
    expect(m.paidThrough).toBe("2026-04-08T12:00:00.000Z");
  });

  it("starts a fresh month from today after the grace period has passed", () => {
    const m = extendMembership(member({ paidThrough: "2026-02-01T12:00:00.000Z", startedAt: "2025-06-01T00:00:00.000Z" }), "u1", NOW);
    expect(m.paidThrough).toBe("2026-04-10T12:00:00.000Z");
    expect(m.startedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("keeps the member's reminder choice and history", () => {
    const m = extendMembership(member({ remindersEnabled: false, upcomingRemindedFor: "x" }), "u1", NOW);
    expect(m).toMatchObject({ remindersEnabled: false, upcomingRemindedFor: "x" });
  });
});

const order = (over: Partial<Order> = {}): Order => ({
  id: "order-1", productId: MEMBERSHIP_PRODUCT.id, quantity: 1, amountCents: 5000, status: "paid", cloverSessionId: "s1",
  cloverPaymentId: "p1", email: null, userId: "u1", fulfilledAt: null, ...over,
});

describe("applyMembershipPayment", () => {
  const setup = (existing?: ReturnType<typeof member>) => {
    const orders = fakeStore();
    orders.orders.push(order());
    const store = fakeMembershipStore(existing ? [existing] : []);
    return { orders, store, deps: { store, orders, now: () => NOW } };
  };

  it("adds a month for a paid membership order", async () => {
    const { store, deps } = setup();
    expect(await applyMembershipPayment(deps, order())).toBe("applied");
    expect(store.rows.get("u1")?.paidThrough).toBe("2026-04-10T12:00:00.000Z");
  });

  it("adds the month only once, however many times the webhook arrives", async () => {
    const { store, deps } = setup();
    await applyMembershipPayment(deps, order());
    expect(await applyMembershipPayment(deps, order())).toBe("already_applied");
    expect(await applyMembershipPayment(deps, order())).toBe("already_applied");
    expect(store.rows.get("u1")?.paidThrough).toBe("2026-04-10T12:00:00.000Z");
  });

  it("only one of two simultaneous deliveries applies it", async () => {
    const { store, deps } = setup();
    const results = await Promise.all([applyMembershipPayment(deps, order()), applyMembershipPayment(deps, order())]);
    expect(results.sort()).toEqual(["already_applied", "applied"]);
    expect(store.saves).toHaveLength(1);
  });

  it("ignores orders that are not memberships, or have no member attached", async () => {
    const { store, deps } = setup();
    expect(await applyMembershipPayment(deps, order({ productId: "mahj-101" }))).toBe("ignored");
    expect(await applyMembershipPayment(deps, order({ userId: null }))).toBe("ignored");
    expect(store.saves).toHaveLength(0);
  });

  it("gives the claim back when saving fails, so a retry can finish the job", async () => {
    const { orders, store, deps } = setup();
    store.failSave = true;
    await expect(applyMembershipPayment(deps, order())).rejects.toThrow("db down");
    expect(orders.orders[0].fulfilledAt).toBeNull();

    store.failSave = false;
    expect(await applyMembershipPayment(deps, order())).toBe("applied");
    expect(store.rows.get("u1")?.paidThrough).toBe("2026-04-10T12:00:00.000Z");
  });
});

describe("setReminders", () => {
  it("turns reminders off and on for an existing member, and ignores non-members", async () => {
    const store = fakeMembershipStore([member()]);
    await setReminders(store, "u1", false);
    expect(store.rows.get("u1")?.remindersEnabled).toBe(false);
    await setReminders(store, "u1", true);
    expect(store.rows.get("u1")?.remindersEnabled).toBe(true);
    await setReminders(store, "nobody", true);
    expect(store.rows.has("nobody")).toBe(false);
  });
});

describe("runReminders", () => {
  const template = vi.fn(({ kind }: { kind: string }) => ({ subject: kind, text: kind, html: kind }));
  const run = async (store: ReturnType<typeof fakeMembershipStore>, send = vi.fn().mockResolvedValue(undefined)) => {
    const summary = await runReminders({ store, send, template, now: () => NOW });
    return { summary, send };
  };

  it("sends a 'renew soon' email once the month is within the reminder window", async () => {
    const store = fakeMembershipStore([member({ paidThrough: day(REMIND_DAYS - 1) })]);
    const { summary, send } = await run(store);
    expect(summary).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "u1@club.example", subject: "upcoming" }));
    expect(store.rows.get("u1")?.upcomingRemindedFor).toBe(day(REMIND_DAYS - 1));
  });

  it("does not email members who are not yet due", async () => {
    const { summary, send } = await run(fakeMembershipStore([member({ paidThrough: day(REMIND_DAYS + 2) })]));
    expect(summary).toMatchObject({ sent: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the 'renew soon' email only once per month", async () => {
    const store = fakeMembershipStore([member({ paidThrough: day(2) })]);
    await run(store);
    const { send } = await run(store);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends one 'just ended' email during the grace period, then nothing", async () => {
    const store = fakeMembershipStore([member({ paidThrough: day(-1) })]);
    const first = await run(store);
    expect(first.send).toHaveBeenCalledWith(expect.objectContaining({ subject: "grace" }));
    const second = await run(store);
    expect(second.send).not.toHaveBeenCalled();
  });

  it("stops emailing once the grace period is over", async () => {
    const { summary, send } = await run(fakeMembershipStore([member({ paidThrough: day(-GRACE_DAYS - 1) })]));
    expect(summary).toMatchObject({ sent: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("emails again for the next month after they renew", async () => {
    const store = fakeMembershipStore([member({ paidThrough: day(2), upcomingRemindedFor: day(-28) })]);
    const { send } = await run(store);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("respects a member who turned reminders off", async () => {
    const { summary, send } = await run(fakeMembershipStore([member({ paidThrough: day(2), remindersEnabled: false })]));
    expect(summary).toMatchObject({ sent: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("does not record a reminder that failed to send, so the next run retries it", async () => {
    const store = fakeMembershipStore([member({ paidThrough: day(2) })]);
    const { summary } = await run(store, vi.fn().mockRejectedValue(new Error("smtp down")));
    expect(summary).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(store.rows.get("u1")?.upcomingRemindedFor).toBeNull();
    const retry = await run(store);
    expect(retry.summary.sent).toBe(1);
  });

  it("carries on with the other members when one fails", async () => {
    const store = fakeMembershipStore([member({ userId: "a", paidThrough: day(2) }), member({ userId: "b", paidThrough: day(2) })]);
    const send = vi.fn().mockRejectedValueOnce(new Error("smtp down")).mockResolvedValue(undefined);
    const { summary } = await run(store, send);
    expect(summary).toEqual({ sent: 1, skipped: 0, failed: 1 });
  });

  it("skips members with no email address on file", async () => {
    const store = fakeMembershipStore([member({ paidThrough: day(2) })], { u1: null });
    const { summary, send } = await run(store);
    expect(summary).toMatchObject({ sent: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });
});
