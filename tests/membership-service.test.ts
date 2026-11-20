import { describe, expect, it } from "vitest";
import { addMonths, cancelMembership, nextBillingDate, subscribeMember, syncMembership } from "@/lib/payments/membership-service";
import { hasAccess } from "@/lib/payments/memberships";
import { NOW, clover4xx, clover5xx, deps, fakeClover, fakeMembershipStore, input, member } from "./membership-helpers";

describe("addMonths / nextBillingDate", () => {
  it("adds calendar months", () => {
    expect(addMonths(new Date("2026-03-10T12:00:00Z"), 1).toISOString()).toBe("2026-04-10T12:00:00.000Z");
    expect(addMonths(new Date("2026-12-15T00:00:00Z"), 1).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("clamps to the end of a shorter month", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("finds the next renewal after today without drifting through short months", () => {
    // First renewal Jan 31, now mid-May: next is May 31, not May 28 or 30.
    expect(nextBillingDate(new Date("2026-01-31T00:00:00Z"), new Date("2026-05-15T00:00:00Z")).toISOString()).toBe("2026-05-31T00:00:00.000Z");
    expect(nextBillingDate(new Date("2026-04-10T00:00:00Z"), new Date("2026-03-10T00:00:00Z")).toISOString()).toBe("2026-04-10T00:00:00.000Z");
  });
});

describe("hasAccess", () => {
  it("is false with no membership, pending or lapsed", () => {
    expect(hasAccess(null, NOW)).toBe(false);
    expect(hasAccess(member({ status: "pending" }), NOW)).toBe(false);
    expect(hasAccess(member({ status: "lapsed" }), NOW)).toBe(false);
  });

  it("is true for active members", () => {
    expect(hasAccess(member(), NOW)).toBe(true);
  });

  it("keeps a cancelled member in until the paid month ends, then stops", () => {
    expect(hasAccess(member({ status: "canceled", paidThrough: "2026-03-20T00:00:00Z" }), NOW)).toBe(true);
    expect(hasAccess(member({ status: "canceled", paidThrough: "2026-03-01T00:00:00Z" }), NOW)).toBe(false);
    expect(hasAccess(member({ status: "canceled", paidThrough: null }), NOW)).toBe(false);
  });
});

describe("subscribeMember", () => {
  it("charges $50, then starts the subscription one month out, and records an active member", async () => {
    const store = fakeMembershipStore();
    const clover = fakeClover();
    const res = await subscribeMember(deps(store, clover), input);

    expect(res).toMatchObject({ ok: true, renewalsSetUp: true });
    expect(clover.createCustomer).toHaveBeenCalledWith({ email: "m@club.example", name: undefined, source: "clv_abc" });
    expect(clover.createCharge).toHaveBeenCalledWith({ amountCents: 5000, customerId: "cust-1", idempotencyKey: "key-1", clientIp: "1.2.3.4" });
    expect(clover.createSubscription).toHaveBeenCalledWith({ planId: "plan-1", customerId: "cust-1", startDate: "2026-04-10T12:00:00.000Z" });
    expect(store.rows.get("u1")).toMatchObject({
      status: "active", cloverCustomerId: "cust-1", cloverSubscriptionId: "sub-1",
      startedAt: NOW.toISOString(), paidThrough: "2026-04-10T12:00:00.000Z", billingIssue: null,
    });
  });

  it("never charges without consent", async () => {
    const clover = fakeClover();
    const res = await subscribeMember(deps(fakeMembershipStore(), clover), { ...input, consent: false });
    expect(res).toMatchObject({ ok: false, code: "consent_required" });
    expect(clover.createCustomer).not.toHaveBeenCalled();
    expect(clover.createCharge).not.toHaveBeenCalled();
  });

  it("does nothing when the plan is not configured", async () => {
    const clover = fakeClover();
    const res = await subscribeMember(deps(fakeMembershipStore(), clover, null), input);
    expect(res).toMatchObject({ ok: false, code: "not_configured" });
    expect(clover.createCharge).not.toHaveBeenCalled();
  });

  it("refuses to charge someone who is already a member, or cancelled but still covered", async () => {
    for (const existing of [member(), member({ status: "canceled", paidThrough: "2026-03-20T00:00:00Z" })]) {
      const clover = fakeClover();
      const res = await subscribeMember(deps(fakeMembershipStore(existing), clover), input);
      expect(res).toMatchObject({ ok: false, code: "already_member" });
      expect(clover.createCharge).not.toHaveBeenCalled();
    }
  });

  it("does not activate or subscribe when the card is declined, and rotates the idempotency key", async () => {
    const store = fakeMembershipStore();
    const clover = fakeClover();
    clover.createCharge.mockResolvedValue({ id: "", paid: false });
    const res = await subscribeMember(deps(store, clover), input);

    expect(res).toMatchObject({ ok: false, code: "payment_failed" });
    expect(clover.createSubscription).not.toHaveBeenCalled();
    expect(store.rows.get("u1")).toMatchObject({ status: "pending", idempotencyKey: "key-2" });
  });

  it("treats a 4xx from Clover as a failed payment and rotates the key", async () => {
    const store = fakeMembershipStore();
    const clover = fakeClover();
    clover.createCharge.mockRejectedValue(clover4xx());
    const res = await subscribeMember(deps(store, clover), input);
    expect(res).toMatchObject({ ok: false, code: "payment_failed" });
    expect(store.rows.get("u1")).toMatchObject({ status: "pending", idempotencyKey: "key-2" });
  });

  it("keeps the idempotency key after a 5xx, because the charge may have gone through", async () => {
    const store = fakeMembershipStore();
    const clover = fakeClover();
    clover.createCharge.mockRejectedValue(clover5xx());
    const res = await subscribeMember(deps(store, clover), input);
    expect(res).toMatchObject({ ok: false, code: "payment_error" });
    expect(clover.createSubscription).not.toHaveBeenCalled();
    expect(store.rows.get("u1")).toMatchObject({ status: "pending", idempotencyKey: "key-1" });
  });

  it("reuses the key of a pending attempt, so a retry cannot double charge", async () => {
    const store = fakeMembershipStore(member({ status: "pending", idempotencyKey: "key-existing", cloverSubscriptionId: null }));
    const clover = fakeClover();
    await subscribeMember(deps(store, clover), input);
    expect(clover.createCharge).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "key-existing" }));
  });

  it("gives a returning member (lapsed or expired) a fresh key and clears the old subscription", async () => {
    const store = fakeMembershipStore(member({ status: "lapsed", idempotencyKey: "old-key", cloverSubscriptionId: "old-sub" }));
    const clover = fakeClover();
    await subscribeMember(deps(store, clover), input);
    expect(clover.createCharge).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "key-1" }));
    expect(store.rows.get("u1")).toMatchObject({ status: "active", cloverSubscriptionId: "sub-1" });
  });

  it("keeps a paying member active, and flags it, when the subscription cannot be created", async () => {
    const store = fakeMembershipStore();
    const clover = fakeClover();
    clover.createSubscription.mockRejectedValue(clover5xx());
    const res = await subscribeMember(deps(store, clover), input);

    expect(res).toMatchObject({ ok: true, renewalsSetUp: false });
    expect(store.rows.get("u1")).toMatchObject({ status: "active", cloverSubscriptionId: null, billingIssue: "subscription_setup_failed" });
  });

  it("saves the active row before creating the subscription, so a crash cannot lose a paid member", async () => {
    const store = fakeMembershipStore();
    const clover = fakeClover();
    let savedActiveBeforeSubscription = false;
    clover.createSubscription.mockImplementation(async () => {
      savedActiveBeforeSubscription = store.rows.get("u1")?.status === "active";
      return { id: "sub-1" };
    });
    await subscribeMember(deps(store, clover), input);
    expect(savedActiveBeforeSubscription).toBe(true);
  });
});

describe("cancelMembership", () => {
  it("stops billing and keeps access until the next renewal date", async () => {
    // First renewal was Feb 10; renewals are the 10th of each month, so the paid month ends Apr 10.
    const store = fakeMembershipStore(member({ paidThrough: "2026-02-10T12:00:00.000Z" }));
    const clover = fakeClover();
    const res = await cancelMembership(deps(store, clover), { userId: "u1" });

    expect(res.ok).toBe(true);
    expect(clover.setSubscriptionActive).toHaveBeenCalledWith("sub-1", false);
    expect(store.rows.get("u1")).toMatchObject({ status: "canceled", canceledAt: NOW.toISOString(), paidThrough: "2026-04-10T12:00:00.000Z" });
    expect(hasAccess(store.rows.get("u1")!, NOW)).toBe(true);
  });

  it("does not mark the member cancelled if Clover fails to stop the billing", async () => {
    const store = fakeMembershipStore(member());
    const clover = fakeClover();
    clover.setSubscriptionActive.mockRejectedValue(clover5xx());
    const res = await cancelMembership(deps(store, clover), { userId: "u1" });

    expect(res).toMatchObject({ ok: false, code: "cancel_failed" });
    expect(store.rows.get("u1")?.status).toBe("active");
  });

  it("has nothing to cancel for non-members and already-cancelled members", async () => {
    for (const store of [fakeMembershipStore(), fakeMembershipStore(member({ status: "canceled" }))]) {
      const clover = fakeClover();
      expect(await cancelMembership(deps(store, clover), { userId: "u1" })).toMatchObject({ ok: false, code: "not_found" });
      expect(clover.setSubscriptionActive).not.toHaveBeenCalled();
    }
  });
});

describe("syncMembership", () => {
  it("marks the member lapsed when Clover has deactivated the subscription", async () => {
    const store = fakeMembershipStore(member());
    const clover = fakeClover();
    clover.getSubscription.mockResolvedValue({ active: false });
    const res = await syncMembership(deps(store, clover), "u1");
    expect(res).toMatchObject({ status: "lapsed", billingIssue: "renewal_failed" });
    expect(hasAccess(store.rows.get("u1")!, NOW)).toBe(false);
  });

  it("leaves an active member alone while the subscription is active", async () => {
    const store = fakeMembershipStore(member());
    expect((await syncMembership(deps(store, fakeClover()), "u1"))?.status).toBe("active");
    expect(store.saves).toHaveLength(0);
  });

  it("does not lock a member out when Clover cannot be reached", async () => {
    const store = fakeMembershipStore(member());
    const clover = fakeClover();
    clover.getSubscription.mockRejectedValue(clover5xx());
    expect((await syncMembership(deps(store, clover), "u1"))?.status).toBe("active");
  });

  it("does not call Clover for members who are not active", async () => {
    const clover = fakeClover();
    await syncMembership(deps(fakeMembershipStore(member({ status: "canceled" })), clover), "u1");
    await syncMembership(deps(fakeMembershipStore(), clover), "u1");
    expect(clover.getSubscription).not.toHaveBeenCalled();
  });
});
