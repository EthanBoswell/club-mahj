import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { getMembershipStore } from "@/lib/payments/memberships";
import { setReminders } from "@/lib/payments/membership-service";

// Turns renewal reminder emails on or off for the signed-in member.
export async function POST(request: Request) {
  const origin = (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/signin?returnTo=%2Fmembership`, 303);

  const store = getMembershipStore();
  const form = await request.formData();
  if (store) await setReminders(store, user.id, form.get("enabled") === "on");
  return NextResponse.redirect(`${origin}/membership`, 303);
}
