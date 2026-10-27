import Link from "next/link";
import { redirect } from "next/navigation";
import { updateProfile } from "@/app/actions";
import { getGames, getLadder, getUser } from "@/lib/data";
import { fmtWhen } from "@/components/GameCard";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/signin?returnTo=/dashboard");
  const [games, ladder] = await Promise.all([getGames(), getLadder()]);
  const p = user.profile;
  const myGames = games.filter((g) => g.players.some((pl) => pl.user_id === user.id));
  const mine = ladder.find((r) => r.user_id === user.id);

  return (
    <section className="section">
      <div className="wrap">
        <span className="eyebrow">Member home</span>
        <h1><span className="gold-text">Hi, {p?.display_name ?? "member"}</span></h1>
        <div className="grid grid-3" style={{ margin: "24px 0" }}>
          <div className="tile tile-gold">
            <h3>Ladder</h3>
            {mine ? <p>Rank <strong>#{mine.rank}</strong> · {mine.wins}W {mine.losses}L</p> : <p className="muted">You are not on the ladder yet.</p>}
            <Link href="/ladder">{mine ? "Open ladder →" : "Join the ladder →"}</Link>
          </div>
          <div className="tile tile-pink">
            <h3>Your tables</h3>
            {myGames.length === 0 ? <p className="muted">No seats yet.</p> : (
              <ul className="small" style={{ paddingLeft: 18 }}>
                {myGames.map((g) => <li key={g.id}><Link href={`/games/${g.id}`}>{g.title}</Link> · {fmtWhen(g.starts_at)}</li>)}
              </ul>
            )}
            <Link href="/games">Find a game →</Link>
          </div>
          <div className="tile">
            <h3>Want to play?</h3>
            <p className="muted">Post an open invite and the club will see it.</p>
            <Link className="btn btn-primary btn-sm" href="/games/new">Post an invite</Link>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 640 }}>
          <h3>My profile</h3>
          <form className="stack" action={updateProfile}>
            <label>Display name
              <input name="display_name" required maxLength={40} defaultValue={p?.display_name ?? ""} />
            </label>
            <div className="row-2">
              <label>City<input name="city" defaultValue={p?.city ?? ""} /></label>
              <label>Level
                <select name="skill" defaultValue={p?.skill ?? "beginner"}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
            <label>Favorite style
              <select name="style" defaultValue={p?.style ?? "american"}>
                <option value="american">American (NMJL)</option>
                <option value="riichi">Riichi</option>
                <option value="hong_kong">Hong Kong</option>
                <option value="chinese_official">Chinese Official</option>
                <option value="any">Happy to play any</option>
              </select>
            </label>
            <label>About me
              <textarea name="bio" defaultValue={p?.bio ?? ""} placeholder="How long you have played, what you love about it…" />
            </label>
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            {saved && <div className="notice notice-info" role="status">Profile saved.</div>}
            <button className="btn btn-primary" type="submit">Save profile</button>
          </form>
        </div>
      </div>
    </section>
  );
}
