import Link from "next/link";
import { getUser } from "@/lib/data";

export default async function Nav() {
  const user = await getUser();
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          <span className="tile-mark" aria-hidden>發</span>
          Club Mahj
        </Link>
        <nav className="nav" aria-label="Main">
          <Link className="link" href="/games">Open Games</Link>
          <Link className="link" href="/ladder">Ladder</Link>
          {user ? (
            <>
              <Link className="link" href="/dashboard">My Club</Link>
              <form action="/auth/signout" method="post" className="inline-form">
                <button className="btn btn-ghost btn-sm" type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link className="link" href="/signin">Sign in</Link>
              <Link className="btn btn-primary btn-sm" href="/join">Become a member</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
