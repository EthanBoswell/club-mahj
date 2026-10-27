import Link from "next/link";
import Image from "next/image";
import DemoBanner from "@/components/DemoBanner";
import GameCard from "@/components/GameCard";
import { getGames, getLadder } from "@/lib/data";

export default async function Home() {
  const [games, ladder] = await Promise.all([getGames(), getLadder()]);
  return (
    <>
      <DemoBanner />
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Membership is open</span>
            <p className="tagline">Bringing us together, one tile at a time</p>
            <h1><span className="gold-text">Club Mahj</span></h1>
            <p className="lede">
              A mahjong community that actually gets you to the table. Find a game tonight, put out your own invite,
              and climb the club ladder.
            </p>
            <div className="cta-row">
              <Link className="btn btn-primary" href="/join">Become a member</Link>
              <Link className="btn btn-ghost" href="/games">Find a game</Link>
            </div>
          </div>
          <div className="hero-art">
            <Image src="/img/club-mahj-banner.jpg" alt="Club Mahj tiles, peonies and a butterfly" width={480} height={384} priority />
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <span className="eyebrow">Three ways in</span>
          <h2>Join. Invite. Compete.</h2>
          <div className="grid grid-3" style={{ marginTop: 24 }}>
            <div className="tile tile-pink">
              <span className="glyph" aria-hidden>🀄</span>
              <h3>Become a member</h3>
              <p className="muted">Create your profile with your level and favorite style so hosts know who is joining their table.</p>
              <Link href="/join">Join Club Mahj →</Link>
            </div>
            <div className="tile">
              <span className="glyph" aria-hidden>📣</span>
              <h3>Put out an invite</h3>
              <p className="muted">Want to play? Post a game with a time and place. Everyone can see it and members grab a seat.</p>
              <Link href="/games">Browse open games →</Link>
            </div>
            <div className="tile tile-gold">
              <span className="glyph" aria-hidden>🏆</span>
              <h3>Climb the ladder</h3>
              <p className="muted">A country-club style ladder. Challenge players above you, report the result, and take their spot.</p>
              <Link href="/ladder">See the ladder →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="page-head" style={{ padding: "0 0 16px" }}>
            <div className="row">
              <div>
                <span className="eyebrow">Happening soon</span>
                <h2 style={{ margin: 0 }}>Open tables</h2>
              </div>
              <Link className="btn btn-ghost btn-sm" href="/games">All games</Link>
            </div>
          </div>
          {games.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>No games posted yet. Be the first to <Link href="/games/new">put out an invite</Link>.</p></div>
          ) : (
            <div className="grid grid-3">{games.slice(0, 3).map((g) => <GameCard key={g.id} game={g} />)}</div>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap grid grid-2" style={{ alignItems: "center" }}>
          <div>
            <span className="eyebrow">Club ladder</span>
            <h2>Who is on top?</h2>
            <p className="lede">Anyone can watch the standings. Members join at the bottom and work their way up, one challenge at a time.</p>
            <Link className="btn btn-gold" href="/ladder">Join the ladder</Link>
          </div>
          <ol className="ladder">
            {ladder.slice(0, 5).map((r) => (
              <li key={r.user_id} className="rung">
                <span className="rank">{r.rank}</span>
                <span className="name">{r.name}</span>
                <span className="record">{r.wins}W · {r.losses}L</span>
                <span />
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
