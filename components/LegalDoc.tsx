import type { ReactNode } from "react";

export type LegalSection = { heading: string; body: ReactNode[] };

export default function LegalDoc({
  eyebrow, title, intro, sections,
}: { eyebrow: string; title: string; intro: string; sections: LegalSection[] }) {
  return (
    <>
      <section className="page-head">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <span className="eyebrow">{eyebrow}</span>
          <h1><span className="gold-text">{title}</span></h1>
          <p className="lede">{intro}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          {sections.map((s) => (
            <div key={s.heading} style={{ marginBottom: 28 }}>
              <h2>{s.heading}</h2>
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
