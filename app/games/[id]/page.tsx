import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelGame, leaveSeat, takeSeat } from "@/app/actions";
import { fmtWhen } from "@/components/GameCard";
import { getGame, getUser } from "@/lib/data";
import { SKILL_LABEL, STYLE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [game, user] = await Promise.all([getGame(id), getUser()]);
  if (!game) notFound();

  const taken = game.players.length;
  const isHost = user?.id === game.host_id;
  const seated = !!user && game.players.some((p) => p.user_id === user.id);
  const full = taken >= game.seats;

  return (
    <section className="section">
      <div className="narrow" style={{ width: "min(720px, 100% - 32px)" }}>
        <Link href="/games" className="small">← All games</Link>
        <h1 style={{ marginTop: 12 }}><span className="gold-text">{game.title}</span></h1>
        <p className="lede">{fmtWhen(game.starts_at)} · {game.location_name}{game.city ? `, ${game.city}` : ""}</p>
        <div className="badges">
          <span className="badge">{STYLE_LABEL[game.style]}</span>
          <span className="badge badge-jade">{SKILL_LABEL[game.skill]}</span>
          <span className="badge badge-pink">{full ? "Table full" : `${game.seats - taken} seat${game.seats - taken > 1 ? "s" : ""} open`}</span>
        </div>
        {game.notes && <div className="card" style={{ margin: "16px 0" }}><p style={{ margin: 0 }}>{game.notes}</p></div>}

        <div className="card" style={{ marginTop: 16 }}>
          <h3>At the table</h3>
          <ul className="ladder" style={{ marginBottom: 16 }}>
            {Array.from({ length: game.seats }).map((_, i) => {
              const p = game.players[i];
              return (
                <li key={i} className="rung" style={{ gridTemplateColumns: "44px 1fr auto" }}>
                  <span className="rank">{i + 1}</span>
                  <span className="name" style={p ? undefined : { color: "var(--muted)", fontWeight: 400 }}>
                    {p ? p.name : "Open seat"}
                  </span>
                  {p?.user_id === game.host_id && <span className="badge badge-pink">Host</span>}
                </li>
              );
            })}
          </ul>

          {error && <div className="notice notice-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="actions">
            {!user ? (
              <Link className="btn btn-primary" href={`/signin?returnTo=/games/${game.id}`}>Sign in to take a seat</Link>
            ) : seated ? (
              !isHost && (
                <form action={leaveSeat}>
                  <input type="hidden" name="game_id" value={game.id} />
                  <button className="btn btn-ghost" type="submit">Give up my seat</button>
                </form>
              )
            ) : (
              <form action={takeSeat}>
                <input type="hidden" name="game_id" value={game.id} />
                <button className="btn btn-primary" type="submit" disabled={full}>{full ? "Table full" : "Take a seat"}</button>
              </form>
            )}
            {isHost && (
              <form action={cancelGame}>
                <input type="hidden" name="game_id" value={game.id} />
                <button className="btn btn-danger" type="submit">Cancel this game</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
