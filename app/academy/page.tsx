import Link from "next/link";
import { formatPrice, getProduct } from "@/lib/payments/catalog";

export const metadata = {
  title: "Club Mahj Academy | Lessons, bootcamps and girls night in",
  description: "Learn mahjong with Club Mahj Academy: Mahjong 101-103, private lessons, a 4-hour bootcamp and Mahjong & Mingle.",
};

function BookButton({ id }: { id: string }) {
  return (
    <form action="/api/checkout" method="post">
      <input type="hidden" name="productId" value={id} />
      <button className="btn btn-primary btn-sm" type="submit">Book</button>
    </form>
  );
}

function Price({ id, unit = "per person" }: { id: string; unit?: string }) {
  return <p><strong>{formatPrice(getProduct(id)!.priceCents)}</strong> {unit}</p>;
}

export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const separate = getProduct("mahj-101")!.priceCents * 3;
  const saving = separate - getProduct("mahj-101-103-package")!.priceCents;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Club Mahj Academy</span>
          <h1><span className="gold-text">Learn to play, your way</span></h1>
          <p className="lede">Courses, private lessons and group events for every level, from your first tile to table-ready.</p>
          {checkout === "unavailable" && (
            <p className="notice notice-info" role="status">Online booking is not switched on yet. Please check back soon.</p>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <h2>Mahjong courses</h2>
          <p className="muted">Three separate 90-minute courses. Take one, or take them all.</p>
          <div className="grid grid-3">
            {["mahj-101", "mahj-102", "mahj-103"].map((id) => (
              <div key={id} className="tile tile-pink">
                <h3>{getProduct(id)!.name}</h3>
                <p className="muted small">90 minutes</p>
                <Price id={id} />
                <BookButton id={id} />
              </div>
            ))}
          </div>
          <div className="tile tile-gold" style={{ marginTop: 20 }}>
            <span className="badge badge-jade">Best value</span>
            <h3>Mahj 101–103 package</h3>
            <p className="muted small">All three 90-minute courses</p>
            <p>
              <strong>{formatPrice(getProduct("mahj-101-103-package")!.priceCents)}</strong> per person{" "}
              <span className="muted small">(save {formatPrice(saving)})</span>
            </p>
            <BookButton id="mahj-101-103-package" />
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>More ways to learn</h2>
          <div className="grid grid-3">
            <div className="tile">
              <h3>Private lessons</h3>
              <p className="muted small">One-on-one, for each course</p>
              <Price id="private-lesson" unit="per course" />
              <BookButton id="private-lesson" />
            </div>
            <div className="tile">
              <h3>Mahjong bootcamp</h3>
              <p className="muted small">4 hours</p>
              <Price id="bootcamp" />
              <BookButton id="bootcamp" />
            </div>
            <div className="tile">
              <h3>Mahjong &amp; Mingle</h3>
              <p className="muted small">3-hour girls night in (can be daytime)</p>
              <Price id="mahj-and-mingle" />
              <BookButton id="mahj-and-mingle" />
            </div>
          </div>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/join">Join Club Mahj</Link>
            <Link className="btn btn-ghost" href="/games">Find an open game</Link>
          </div>
        </div>
      </section>
    </>
  );
}
