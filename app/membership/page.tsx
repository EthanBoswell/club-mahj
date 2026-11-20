import { redirect } from "next/navigation";
import MembershipForm from "@/components/MembershipForm";
import { getUser } from "@/lib/data";
import { MEMBERSHIP, formatPrice } from "@/lib/payments/catalog";
import { cloverConfig } from "@/lib/payments/clover";
import { membershipDeps } from "@/lib/payments/membership-deps";
import { hasAccess } from "@/lib/payments/memberships";
import { syncMembership } from "@/lib/payments/membership-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership | Club Mahj" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ canceled?: string; error?: string }> }) {
  const { canceled, error } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/signin?returnTo=/membership");

  const deps = membershipDeps();
  const cfg = cloverConfig();
  const publicKey = process.env.CLOVER_PUBLIC_KEY;
  const sdkUrl = process.env.CLOVER_SDK_URL ?? "https://checkout.sandbox.dev.clover.com/sdk.js";
  const membership = deps ? await syncMembership(deps, user.id) : null;
  const active = hasAccess(membership, new Date());
  const price = formatPrice(MEMBERSHIP.priceCents);

  return (
    <section className="page-head">
      <div className="narrow">
        <span className="eyebrow">Club Mahj membership</span>
        <h1><span className="gold-text">{price}/month</span></h1>
        {canceled && <p className="notice notice-info" role="status">Your membership is cancelled. You will not be billed again.</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}

        {!deps || !cfg || !publicKey ? (
          <p className="notice notice-info">Online membership sign-up is not switched on yet. Please check back soon.</p>
        ) : membership?.status === "active" ? (
          <div className="card">
            <h3>You are a member</h3>
            <p className="muted">Your membership renews monthly at {price}.</p>
            {membership.billingIssue && <p className="notice notice-error">There is a problem with your billing. Please contact us.</p>}
            <form action="/api/membership/cancel" method="post">
              <button className="btn btn-ghost" type="submit">Cancel membership</button>
            </form>
          </div>
        ) : active && membership?.paidThrough ? (
          <div className="card">
            <h3>Membership cancelled</h3>
            <p className="muted">You keep your member pricing until {fmt(membership.paidThrough)}. You will not be billed again.</p>
          </div>
        ) : (
          <>
            {membership?.status === "lapsed" && (
              <p className="notice notice-error">Your last renewal did not go through, so your membership has ended. You can rejoin below.</p>
            )}
            <p className="lede">Member pricing on Club Mahj events, faster reservations, and private member-hosted tables.</p>
            <MembershipForm publicKey={publicKey} merchantId={cfg.merchantId} sdkUrl={sdkUrl} price={price} />
          </>
        )}
      </div>
    </section>
  );
}
