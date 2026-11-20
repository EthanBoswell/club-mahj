"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

// Clover's iframe draws the card fields, so the card number goes from the member's browser
// straight to Clover. We only ever receive a single-use token.
type CloverElement = { mount(selector: string): void; destroy?: () => void };
type CloverSdk = {
  elements(): { create(type: string, styles?: unknown): CloverElement };
  createToken(): Promise<{ token?: string; errors?: Record<string, string> }>;
};
declare global {
  interface Window { Clover?: new (key: string, opts: { merchantId: string }) => CloverSdk }
}

const fieldStyle = { minHeight: 44, padding: "8px 12px", border: "1.5px solid var(--line)", borderRadius: 10, background: "var(--paper)" };

export default function MembershipForm({
  publicKey, merchantId, sdkUrl, price,
}: { publicKey: string; merchantId: string; sdkUrl: string; price: string }) {
  const router = useRouter();
  const clover = useRef<CloverSdk | null>(null);
  const mounted = useRef(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function mountFields() {
    if (mounted.current || !window.Clover) return;
    mounted.current = true;
    clover.current = new window.Clover(publicKey, { merchantId });
    const elements = clover.current.elements();
    elements.create("CARD_NUMBER").mount("#card-number");
    elements.create("CARD_DATE").mount("#card-date");
    elements.create("CARD_CVV").mount("#card-cvv");
    elements.create("CARD_POSTAL_CODE").mount("#card-postal-code");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clover.current || busy) return;
    setError("");
    setBusy(true);
    try {
      const result = await clover.current.createToken();
      if (!result.token) {
        setError(Object.values(result.errors ?? {})[0] ?? "Please check your card details.");
        return;
      }
      const res = await fetch("/api/membership/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cloverToken: result.token, consent }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 14 }}>
      <Script src={sdkUrl} strategy="afterInteractive" onReady={mountFields} />
      <div id="card-number" style={fieldStyle} />
      <div className="row-2">
        <div id="card-date" style={fieldStyle} />
        <div id="card-cvv" style={fieldStyle} />
      </div>
      <div id="card-postal-code" style={fieldStyle} />
      <label className="small" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          I authorize Club Mahj to charge my card {price} today and then every month until I cancel. I can cancel any time
          before the next renewal. See the <a href="/cancellation">cancellation policy</a> and <a href="/terms">terms</a>.
        </span>
      </label>
      {error && <p className="notice notice-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={!consent || busy}>
        {busy ? "Processing…" : `Pay ${price} and start membership`}
      </button>
    </form>
  );
}
