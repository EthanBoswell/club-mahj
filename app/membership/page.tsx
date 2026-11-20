import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { GRACE_DAYS, REMIND_DAYS, membershipState } from "@/lib/payments/membership-service";
import { MEMBERSHIP_PRODUCT, formatPrice } from "@/lib/payments/catalog";
import { cloverConfig } from "@/lib/payments/clover";
import { getMembershipStore } from "@/lib/payments/memberships";
import { getOrderStore } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership | Club Mahj" };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/signin?returnTo=/membership");

  const store = getMembershipStore();
  const enabled = Boolean(store && getOrderStore() && cloverConfig());
  const membership = store ? await store.get(user.id) : null;
  const state = membershipState(membership, new Date());
  const price = formatPrice(MEMBERSHIP_PRODUCT.priceCents);

  const renew = (label: string) => (
    <form action="/api/membership/renew" method="post">
      <button className="btn btn-primary" type="submit">{label}</button>
    </form>
  );

  return (
    <section className="page-head">
      <div className="narrow">
        <span className="eyebrow">Club Mahj membership</span>
        <h1><span className="gold-text">{price}/month</span></h1>
        {checkout === "error" && <p className="notice notice-error" role="alert">We could not start your payment just now. Please try again in a moment.</p>}

        {!enabled ? (
          <p className="notice notice-info">Online membership payments are not switched on yet. Please check back soon.</p>
        ) : (
          <div className="card" style={{ display: "grid", gap: 12 }}>
            {state.kind === "none" && (
              <>
                <p className="lede" style={{ margin: 0 }}>Member pricing on Club Mahj events, faster reservations, and private member-hosted tables.</p>
                <p className="muted small" style={{ margin: 0 }}>Pay {price} for a month. It does not renew by itself: we email you before it ends.</p>
                {renew(`Pay ${price} and join`)}
              </>
            )}
            {state.kind === "active" && (
              <>
                <h3 style={{ margin: 0 }}>You are a member</h3>
                <p style={{ margin: 0 }}>Your membership runs through <strong>{fmt(state.paidThrough)}</strong>.</p>
                <p className="muted small" style={{ margin: 0 }}>We will email you about {REMIND_DAYS} days before it ends. Renewing early adds a month to your current end date.</p>
                {renew(`Renew for ${price}`)}
              </>
            )}
            {state.kind === "grace" && (
              <>
                <h3 style={{ margin: 0 }}>Time to renew</h3>
                <p style={{ margin: 0 }}>Your month ended on {fmt(state.paidThrough)}. You keep member pricing until <strong>{fmt(state.accessUntil)}</strong> ({GRACE_DAYS} days after).</p>
                {renew(`Renew for ${price}`)}
              </>
            )}
            {state.kind === "expired" && (
              <>
                <h3 style={{ margin: 0 }}>Your membership has ended</h3>
                <p style={{ margin: 0 }}>It ended on {fmt(state.paidThrough)}. You can rejoin any time.</p>
                {renew(`Rejoin for ${price}`)}
              </>
            )}

            {membership && (
              <form action="/api/membership/reminders" method="post" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="enabled" defaultChecked={membership.remindersEnabled} />
                  Email me renewal reminders
                </label>
                <button className="btn btn-ghost btn-sm" type="submit">Save</button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
