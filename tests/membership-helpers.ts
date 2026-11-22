import type { Contact, Membership, MembershipStore } from "@/lib/payments/memberships";

export const NOW = new Date("2026-03-10T12:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
export { day };

export const member = (over: Partial<Membership> = {}): Membership => ({
  userId: "u1", startedAt: "2026-01-10T12:00:00.000Z", paidThrough: day(20), remindersEnabled: true,
  upcomingRemindedFor: null, graceRemindedFor: null, ...over,
});

export function fakeMembershipStore(initial: Membership[] = [], contacts: Record<string, Contact | null> = {}) {
  const rows = new Map<string, Membership>(initial.map((m) => [m.userId, m]));
  const saves: Membership[] = [];
  const store: MembershipStore & { rows: Map<string, Membership>; saves: Membership[]; failSave?: boolean } = {
    rows,
    saves,
    async get(id) { return rows.get(id) ?? null; },
    async save(m) {
      if (store.failSave) throw new Error("db down");
      rows.set(m.userId, { ...m });
      saves.push({ ...m });
    },
    async list() { return [...rows.values()]; },
    async contact(id) { return id in contacts ? contacts[id] : { email: `${id}@club.example`, name: "Mae" }; },
  };
  return store;
}
