import { createClient } from "@supabase/supabase-js";

/**
 * A member's paid time. Membership is not an auto-renewing subscription: each month is paid
 * for with its own checkout, and we email a reminder before it runs out.
 */
export type Membership = {
  userId: string;
  startedAt: string;
  /** End of the month they have paid for. */
  paidThrough: string;
  remindersEnabled: boolean;
  /** The paidThrough value the "renew soon" email was last sent for, so it goes out once per month. */
  upcomingRemindedFor: string | null;
  /** The paidThrough value the "just ended" email was last sent for. */
  graceRemindedFor: string | null;
};

export type Contact = { email: string; name?: string };

export interface MembershipStore {
  get(userId: string): Promise<Membership | null>;
  /** Inserts or replaces the member's row. */
  save(membership: Membership): Promise<void>;
  list(): Promise<Membership[]>;
  contact(userId: string): Promise<Contact | null>;
}

type Row = {
  user_id: string; started_at: string; paid_through: string; reminders_enabled: boolean;
  upcoming_reminded_for: string | null; grace_reminded_for: string | null;
};

const toMembership = (r: Row): Membership => ({
  userId: r.user_id, startedAt: r.started_at, paidThrough: r.paid_through, remindersEnabled: r.reminders_enabled,
  upcomingRemindedFor: r.upcoming_reminded_for, graceRemindedFor: r.grace_reminded_for,
});

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
      return data ? toMembership(data as Row) : null;
    },
    async save(m) {
      const { error } = await db.from("memberships").upsert({
        user_id: m.userId, started_at: m.startedAt, paid_through: m.paidThrough, reminders_enabled: m.remindersEnabled,
        upcoming_reminded_for: m.upcomingRemindedFor, grace_reminded_for: m.graceRemindedFor, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`memberships save failed: ${error.message}`);
    },
    async list() {
      const { data, error } = await db.from("memberships").select();
      if (error) throw new Error(`memberships list failed: ${error.message}`);
      return ((data ?? []) as Row[]).map(toMembership);
    },
    async contact(userId) {
      const { data } = await db.auth.admin.getUserById(userId);
      const email = data?.user?.email;
      if (!email) return null;
      const { data: profile } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      return { email, name: (profile as { display_name?: string } | null)?.display_name };
    },
  };
}
