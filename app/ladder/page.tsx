import Link from "next/link";
import DemoBanner from "@/components/DemoBanner";
import {
  cancelChallenge, challenge, confirmResult, disputeResult, joinLadder, leaveLadder, reportResult, respond,
} from "@/app/actions";
import { getChallenges, getLadder, getUser } from "@/lib/data";
import type { Challenge } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPEN = ["pending", "accepted", "reported"];

function ChallengeCard({ c, me }: { c: Challenge; me: string }) {
  const iAmChallenger = c.challenger_id === me;
  const other = iAmChallenger ? c.challenged_name : c.challenger_name;
  return (
    <div className="tile challenge">
      <strong>{c.challenger_name} challenged {c.challenged_name}</strong>
      {c.message && <span className="muted small">“{c.message}”</span>}

      {c.status === "pending" && !iAmChallenger && (
        <div className="actions">
          <form action={respond}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="accept" value="yes" />
            <button className="btn btn-primary btn-sm">Accept</button></form>
          <form action={respond}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="accept" value="no" />
            <button className="btn btn-ghost btn-sm">Decline</button></form>
        </div>
      )}
      {c.status === "pending" && iAmChallenger && (
        <div className="actions">
          <span className="badge">Waiting on {other}</span>
          <form action={cancelChallenge}><input type="hidden" name="id" value={c.id} />
            <button className="btn btn-ghost btn-sm">Withdraw</button></form>
        </div>
      )}
      {c.status === "accepted" && (
        <>
          <p className="small muted" style={{ margin: 0 }}>Accepted. Play at any table, then report who finished ahead.</p>
          <div className="actions">
            {[{ id: c.challenger_id, n: c.challenger_name }, { id: c.challenged_id, n: c.challenged_name }].map((p) => (
              <form key={p.id} action={reportResult}>
                <input type="hidden" name="id" value={c.id} /><input type="hidden" name="winner" value={p.id} />
                <button className="btn btn-gold btn-sm">{p.n} won</button>
              </form>
            ))}
            {iAmChallenger && (
              <form action={cancelChallenge}><input type="hidden" name="id" value={c.id} />
                <button className="btn btn-ghost btn-sm">Withdraw</button></form>
            )}
          </div>
        </>
      )}
      {c.status === "reported" && (
        <>
          <p className="small" style={{ margin: 0 }}>
            Result reported: <strong>{c.winner_id === c.challenger_id ? c.challenger_name : c.challenged_name}</strong> won.
          </p>
          {c.reported_by !== me ? (
            <div className="actions">
              <form action={confirmResult}><input type="hidden" name="id" value={c.id} />
                <button className="btn btn-primary btn-sm">Confirm result</button></form>
              <form action={disputeResult}><input type="hidden" name="id" value={c.id} />
                <button className="btn btn-danger btn-sm">That's not right</button></form>
            </div>
          ) : (
            <span className="badge">Waiting for {other} to confirm</span>
          )}
        </>
      )}
    </div>
  );
}

export default async function Ladder({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [ladder, challenges, user] = await Promise.all([getLadder(), getChallenges(), getUser()]);
  const mine = user ? ladder.find((r) => r.user_id === user.id) : undefined;
  const myOpen = user ? challenges.filter((c) => OPEN.includes(c.status) && (c.challenger_id === user.id || c.challenged_id === user.id)) : [];
  const busyIds = new Set(challenges.filter((c) => OPEN.includes(c.status)).flatMap((c) => [c.challenger_id, c.challenged_id]));
  const recent = challenges.filter((c) => c.status === "completed").slice(0, 5);

  return (
    <>
      <DemoBanner />
      <div className="wrap page-head">
        <div className="row">
          <div>
            <span className="eyebrow">Club ladder</span>
            <h1 style={{ margin: 0 }}><span className="gold-text">The Ladder</span></h1>
            <p className="lede" style={{ marginTop: 10 }}>
              Join at the bottom. Challenge anyone up to 3 spots above you. Win, and you take their rank.
            </p>
          </div>
          {user && !mine && (
            <form action={joinLadder}><button className="btn btn-gold">Join the ladder</button></form>
          )}
          {!user && <Link className="btn btn-gold" href="/signin?returnTo=/ladder">Sign in to join</Link>}
        </div>
        {error && <div className="notice notice-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      </div>

      <div className="wrap grid" style={{ gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", alignItems: "start", paddingBottom: 40 }}>
        <div>
          {ladder.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>Nobody is on the ladder yet. Be rank #1.</p></div>
          ) : (
            <ol className="ladder">
              {ladder.map((r) => {
                const isMe = r.user_id === user?.id;
                const gap = mine ? mine.rank - r.rank : 0;
                const canChallenge = !!mine && gap >= 1 && gap <= 3 && !busyIds.has(mine.user_id) && !busyIds.has(r.user_id);
                return (
                  <li key={r.user_id} className={isMe ? "rung me" : "rung"}>
                    <span className="rank">{r.rank}</span>
                    <span className="name">{r.name}{isMe && <span className="badge badge-pink" style={{ marginLeft: 8 }}>You</span>}</span>
                    <span className="record">{r.wins}W · {r.losses}L</span>
                    <span className="actions">
                      {canChallenge && (
                        <form action={challenge}>
                          <input type="hidden" name="target" value={r.user_id} />
                          <button className="btn btn-primary btn-sm">Challenge</button>
                        </form>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {mine && myOpen.length === 0 && (
            <form action={leaveLadder} style={{ marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm">Leave the ladder</button>
            </form>
          )}
        </div>

        <aside className="challenge-list">
          {user && myOpen.length > 0 && (
            <>
              <h3 style={{ margin: 0 }}>Your challenge</h3>
              {myOpen.map((c) => <ChallengeCard key={c.id} c={c} me={user.id} />)}
            </>
          )}
          <div className="tile tile-gold">
            <h3>How it works</h3>
            <ol className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Challenge a player up to 3 spots above you.</li>
              <li>They accept, and you both sit at a table together.</li>
              <li>Report which of you finished ahead. The other confirms.</li>
              <li>If the challenger wins, they take the higher rank.</li>
            </ol>
          </div>
          {recent.length > 0 && (
            <div className="tile">
              <h3>Recent results</h3>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                {recent.map((c) => (
                  <li key={c.id}>{c.winner_id === c.challenger_id ? c.challenger_name : c.challenged_name} beat {c.winner_id === c.challenger_id ? c.challenged_name : c.challenger_name}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
