import Link from "next/link";
import { SKILL_LABEL, STYLE_LABEL, type Game } from "@/lib/types";

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function GameCard({ game }: { game: Game }) {
  const taken = game.players.length;
  const left = game.seats - taken;
  return (
    <article className="tile tile-pink">
      <h3>{game.title}</h3>
      <div className="small muted">{fmtWhen(game.starts_at)} · {game.location_name}{game.city ? `, ${game.city}` : ""}</div>
      <div className="badges">
        <span className="badge">{STYLE_LABEL[game.style]}</span>
        <span className="badge badge-jade">{SKILL_LABEL[game.skill]}</span>
        <span className="badge badge-pink">{left > 0 ? `${left} seat${left > 1 ? "s" : ""} open` : "Table full"}</span>
      </div>
      <div className="seats" aria-label={`${taken} of ${game.seats} seats filled`}>
        {Array.from({ length: game.seats }).map((_, i) => (
          <span key={i} className={i < taken ? "seat" : "seat empty"} />
        ))}
      </div>
      <p className="small muted">Hosted by {game.host?.display_name ?? "a member"}</p>
      <Link className="btn btn-ghost btn-sm" href={`/games/${game.id}`}>View table</Link>
    </article>
  );
}
