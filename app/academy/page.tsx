import Link from "next/link";

export const metadata = {
  title: "Club Mahj Academy | Lessons, bootcamps and girls night in",
  description: "Learn mahjong with Club Mahj Academy: Mahjong 101-103, private lessons, a 4-hour bootcamp and Mahjong & Mingle.",
};

const courses = [
  { code: "101", price: 50 },
  { code: "102", price: 50 },
  { code: "103", price: 50 },
];

export default function AcademyPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Club Mahj Academy</span>
          <h1><span className="gold-text">Learn to play, your way</span></h1>
          <p className="lede">Courses, private lessons and group events for every level, from your first tile to table-ready.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <h2>Mahjong courses</h2>
          <p className="muted">Three separate 90-minute courses. Take one, or take them all.</p>
          <div className="grid grid-3">
            {courses.map((c) => (
              <div key={c.code} className="tile tile-pink">
                <h3>Mahjong {c.code}</h3>
                <p className="muted small">90 minutes</p>
                <p><strong>${c.price}</strong> per person</p>
              </div>
            ))}
          </div>
          <div className="tile tile-gold" style={{ marginTop: 20 }}>
            <span className="badge badge-jade">Best value</span>
            <h3>Mahj 101–103 package</h3>
            <p className="muted small">All three 90-minute courses</p>
            <p><strong>$125</strong> per person <span className="muted small">(save $25)</span></p>
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
              <p><strong>$60</strong> per course</p>
            </div>
            <div className="tile">
              <h3>Mahjong bootcamp</h3>
              <p className="muted small">4 hours</p>
              <p><strong>$100</strong> per person</p>
            </div>
            <div className="tile">
              <h3>Mahjong &amp; Mingle</h3>
              <p className="muted small">3-hour girls night in (can be daytime)</p>
              <p><strong>$75</strong> per person</p>
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
