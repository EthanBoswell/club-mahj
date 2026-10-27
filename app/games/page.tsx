import Link from "next/link";
import GameCard from "@/components/GameCard";
import DemoBanner from "@/components/DemoBanner";
import { getGames } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Games() {
  const games = await getGames();
  return (
    <>
      <DemoBanner />
      <div className="wrap page-head">
        <div className="row">
          <div>
            <span className="eyebrow">Open invites</span>
            <h1 style={{ margin: 0 }}><span className="gold-text">Find a game</span></h1>
            <p className="lede" style={{ marginTop: 10 }}>Anyone can browse. Members can grab a seat or post their own invite.</p>
          </div>
          <Link className="btn btn-primary" href="/games/new">I want to play: post an invite</Link>
        </div>
      </div>
      <div className="wrap" style={{ paddingBottom: 40 }}>
        {games.length === 0 ? (
          <div className="card"><p style={{ margin: 0 }} className="muted">No open games right now. Post the first invite and the table will fill.</p></div>
        ) : (
          <div className="grid grid-3">{games.map((g) => <GameCard key={g.id} game={g} />)}</div>
        )}
      </div>
    </>
  );
}
