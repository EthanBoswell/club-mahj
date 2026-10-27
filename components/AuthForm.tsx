"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/supabase/config";

export default function AuthForm({ mode, returnTo }: { mode: "join" | "signin"; returnTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = mode === "join";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!isConfigured) {
      setInfo("Preview mode: accounts turn on once Supabase is connected.");
      return;
    }
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    const supabase = createClient();
    setBusy(true);
    if (join) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
          data: {
            display_name: String(f.get("display_name")),
            city: String(f.get("city")),
            skill: String(f.get("skill")),
            style: String(f.get("style")),
          },
        },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) { router.push(returnTo); router.refresh(); }
      else setInfo("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message);
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {join && (
        <>
          <label>Name shown to the club
            <input name="display_name" required maxLength={40} placeholder="e.g. Renee T." autoComplete="name" />
          </label>
          <div className="row-2">
            <label>City
              <input name="city" placeholder="Charlotte" autoComplete="address-level2" />
            </label>
            <label>Your level
              <select name="skill" defaultValue="beginner">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          <label>Favorite style
            <select name="style" defaultValue="american">
              <option value="american">American (NMJL)</option>
              <option value="riichi">Riichi</option>
              <option value="hong_kong">Hong Kong</option>
              <option value="chinese_official">Chinese Official</option>
              <option value="any">Happy to play any</option>
            </select>
          </label>
        </>
      )}
      <label>Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>Password
        <input name="password" type="password" required minLength={8} autoComplete={join ? "new-password" : "current-password"} />
      </label>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {info && <div className="notice notice-info" role="status">{info}</div>}
      <button className="btn btn-primary" disabled={busy} type="submit">
        {busy ? "One moment…" : join ? "Create my membership" : "Sign in"}
      </button>
      <p className="small muted" style={{ margin: 0 }}>
        {join ? <>Already a member? <Link href="/signin">Sign in</Link></> : <>New here? <Link href="/join">Become a member</Link></>}
      </p>
    </form>
  );
}
