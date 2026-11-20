import { createClient } from "@supabase/supabase-js";

export type MembershipStatus = "pending" | "active" | "canceled" | "lapsed";

export type Membership = {
  userId: string;
  status: MembershipStatus;
  idempotencyKey: string;
  cloverCustomerId: string | null;
  cloverSubscriptionId: string | null;
  startedAt: string | null;
  paidThrough: string | null;
  canceledAt: string | null;
  billingIssue: string | null;
};

export interface MembershipStore {
  get(userId: string): Promise<Membership | null>;
  /** Inserts or replaces the member's row. */
  save(membership: Membership): Promise<void>;
}

/**
 * Whether the member gets member pricing right now. Active members keep access while their
 * subscription is billing. A member who cancelled keeps access until the month they paid for ends.
 */
export function hasAccess(m: Membership | null, now: Date): boolean {
  if (!m) return false;
  if (m.status === "active") return true;
  return m.status === "canceled" && m.paidThrough !== null && new Date(m.paidThrough) > now;
}

type Row = {
  user_id: string; status: MembershipStatus; idempotency_key: string; clover_customer_id: string | null;
  clover_subscription_id: string | null; started_at: string | null; paid_through: string | null;
  canceled_at: string | null; billing_issue: string | null;
};

// Service-role client: bypasses row-level security, so keep this server-only.
export function getMembershipStore(): MembershipStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });

  return {
    async get(userId) {
      const { data, error } = await db.from("memberships").select().eq("user_id", userId).maybeSingle();
      if (error) throw new Error(`memberships lookup failed: ${error.message}`);
      const r = data as Row | null;
      return r && {
        userId: r.user_id, status: r.status, idempotencyKey: r.idempotency_key, cloverCustomerId: r.clover_customer_id,
        cloverSubscriptionId: r.clover_subscription_id, startedAt: r.started_at, paidThrough: r.paid_through,
        canceledAt: r.canceled_at, billingIssue: r.billing_issue,
      };
    },
    async save(m) {
      const { error } = await db.from("memberships").upsert({
        user_id: m.userId, status: m.status, idempotency_key: m.idempotencyKey, clover_customer_id: m.cloverCustomerId,
        clover_subscription_id: m.cloverSubscriptionId, started_at: m.startedAt, paid_through: m.paidThrough,
        canceled_at: m.canceledAt, billing_issue: m.billingIssue, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`memberships save failed: ${error.message}`);
    },
  };
}
