import Link from "next/link";
import { getAnyProduct } from "@/lib/payments/catalog";
import { getOrderStore } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thank you | Club Mahj" };

export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const store = getOrderStore();
  const order = session_id && store ? await store.findBySessionId(session_id) : null;
  const product = order ? getAnyProduct(order.productId) : undefined;
  const confirmed = order?.status === "paid";

  return (
    <section className="page-head">
      <div className="narrow">
        <span className="eyebrow">{confirmed ? "Payment confirmed" : "Payment received"}</span>
        <h1><span className="gold-text">Thank you</span></h1>
        <p className="lede">
          {product ? `${product.name}${order && order.quantity > 1 ? ` x ${order.quantity}` : ""}. ` : ""}
          {confirmed
            ? "Your payment is confirmed. We will be in touch with the details."
            : "We are waiting for Clover to confirm your payment. This usually takes a few seconds; refresh this page to check."}
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/academy">Back to the Academy</Link>
        </div>
      </div>
    </section>
  );
}
