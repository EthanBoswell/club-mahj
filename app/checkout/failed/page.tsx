import Link from "next/link";

export const metadata = { title: "Payment not completed | Club Mahj" };

export default function CheckoutFailed() {
  return (
    <section className="page-head">
      <div className="narrow">
        <span className="eyebrow">Payment not completed</span>
        <h1><span className="gold-text">That did not go through</span></h1>
        <p className="lede">Your card was not charged. You can try again, or use a different card.</p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/academy">Back to the Academy</Link>
        </div>
      </div>
    </section>
  );
}
