import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { MAX_QUANTITY, getProduct } from "@/lib/payments/catalog";
import { startCheckout } from "@/lib/payments/checkout";

// Starts a Clover Hosted Checkout for one Academy product and sends the browser to Clover's
// payment page. The price always comes from the server-side catalog.
export async function POST(request: Request) {
  const form = await request.formData();
  const productId = String(form.get("productId") ?? "");
  const quantity = Number(form.get("quantity") ?? 1);

  // getProduct only knows Academy products, so the membership cannot be bought through here.
  const product = getProduct(productId);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const origin = (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const user = await getUser();
  const next = await startCheckout({ product, quantity, user: user && { id: user.id, email: user.email }, origin, backTo: "/academy" });
  return NextResponse.redirect(next, 303);
}
