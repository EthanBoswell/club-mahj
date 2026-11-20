import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { cancelMembership } from "@/lib/payments/membership-service";
import { membershipDeps } from "@/lib/payments/membership-deps";

export async function POST(request: Request) {
  const origin = (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/signin?returnTo=%2Fmembership`, 303);

  const deps = membershipDeps();
  if (!deps) return NextResponse.redirect(`${origin}/membership`, 303);

  const result = await cancelMembership(deps, { userId: user.id });
  const query = result.ok ? "?canceled=1" : `?error=${encodeURIComponent(result.message)}`;
  return NextResponse.redirect(`${origin}/membership${query}`, 303);
}
