import { vi } from "vitest";
import { CloverError } from "@/lib/payments/clover";
import type { Deps } from "@/lib/payments/membership-service";
import type { Membership, MembershipStore } from "@/lib/payments/memberships";
import type { Recurring } from "@/lib/payments/recurring";

export const NOW = new Date("2026-03-10T12:00:00.000Z");

export function fakeMembershipStore(initial?: Membership): MembershipStore & { rows: Map<string, Membership>; saves: Membership[] } {
  const rows = new Map<string, Membership>();
  const saves: Membership[] = [];
  if (initial) rows.set(initial.userId, initial);
  return {
    rows,
    saves,
    async get(id) { return rows.get(id) ?? null; },
    async save(m) { rows.set(m.userId, { ...m }); saves.push({ ...m }); },
  };
}

export function fakeClover(over: Partial<Record<keyof Recurring, unknown>> = {}) {
  const mocks = {
    createCustomer: vi.fn().mockResolvedValue({ id: "cust-1" }),
    createCharge: vi.fn().mockResolvedValue({ id: "ch-1", paid: true }),
    createSubscription: vi.fn().mockResolvedValue({ id: "sub-1" }),
    setSubscriptionActive: vi.fn().mockResolvedValue(undefined),
    getSubscription: vi.fn().mockResolvedValue({ active: true }),
  };
  return { ...mocks, ...over } as unknown as Recurring & typeof mocks;
}

export function deps(store: MembershipStore, clover: Recurring, planId: string | null = "plan-1"): Deps {
  let n = 0;
  return { store, clover, planId: planId ?? undefined, now: () => NOW, uuid: () => `key-${++n}` };
}

export const member = (over: Partial<Membership> = {}): Membership => ({
  userId: "u1", status: "active", idempotencyKey: "key-0", cloverCustomerId: "cust-1", cloverSubscriptionId: "sub-1",
  startedAt: "2026-01-10T12:00:00.000Z", paidThrough: "2026-02-10T12:00:00.000Z", canceledAt: null, billingIssue: null, ...over,
});

export const input = { userId: "u1", email: "m@club.example", token: "clv_abc", clientIp: "1.2.3.4", consent: true };

export const clover4xx = () => new CloverError("rejected", 402);
export const clover5xx = () => new CloverError("down", 503);
