import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { MEMBERSHIP_PRODUCT } from "@/lib/payments/catalog";
import { startCheckout } from "@/lib/payments/checkout";

// Starts the checkout for one month of membership. The order is tied to the signed-in member, and
// the webhook adds the month once Clover confirms the payment.
export async function POST(request: Request) {
  const origin = (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/signin?returnTo=%2Fmembership`, 303);

  const next = await startCheckout({
    product: MEMBERSHIP_PRODUCT, quantity: 1, user: { id: user.id, email: user.email }, origin, backTo: "/membership",
  });
  return NextResponse.redirect(next, 303);
}
