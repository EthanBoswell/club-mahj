import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>
          <strong>Club Mahj</strong> · Bringing us together, one tile at a time
        </div>
        <div className="actions">
          <Link href="/academy">Academy</Link>
          <Link href="/games">Open games</Link>
          <Link href="/ladder">Ladder</Link>
          <Link href="/join">Join</Link>
        </div>
      </div>
    </footer>
  );
}
