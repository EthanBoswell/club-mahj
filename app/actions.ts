"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";

async function authed(returnTo: string) {
  if (!isConfigured) redirect(`${returnTo}?error=${encodeURIComponent("Preview mode: connect Supabase to turn this on.")}`);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
  return { supabase, user: data.user };
}

const fail = (path: string, message: string): never =>
  redirect(`${path}?error=${encodeURIComponent(message)}`);

// ---------- Games ----------
export async function createGame(formData: FormData) {
  const { supabase, user } = await authed("/games/new");
  const when = String(formData.get("starts_at") ?? "");
  const tz = Number(formData.get("tz_offset") ?? 0); // minutes, from the browser
  const startsAt = new Date(new Date(when + "Z").getTime() + tz * 60000);
  if (!when || isNaN(startsAt.getTime())) return fail("/games/new", "Pick a date and time.");

  const { data, error } = await supabase
    .from("games")
    .insert({
      host_id: user.id,
      title: String(formData.get("title")).trim(),
      style: String(formData.get("style")),
      skill: String(formData.get("skill")),
      starts_at: startsAt.toISOString(),
      location_name: String(formData.get("location_name")).trim(),
      city: String(formData.get("city") ?? "").trim() || null,
      seats: Number(formData.get("seats") ?? 4),
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) return fail("/games/new", error.message);
  revalidatePath("/games");
  redirect(`/games/${data.id}`);
}

export async function takeSeat(formData: FormData) {
  const id = String(formData.get("game_id"));
  const { supabase, user } = await authed(`/games/${id}`);
  const { error } = await supabase.from("game_players").insert({ game_id: id, user_id: user.id });
  if (error) return fail(`/games/${id}`, error.message);
  revalidatePath(`/games/${id}`);
  revalidatePath("/games");
  redirect(`/games/${id}`);
}

export async function leaveSeat(formData: FormData) {
  const id = String(formData.get("game_id"));
  const { supabase, user } = await authed(`/games/${id}`);
  await supabase.from("game_players").delete().eq("game_id", id).eq("user_id", user.id);
  revalidatePath(`/games/${id}`);
  revalidatePath("/games");
  redirect(`/games/${id}`);
}

export async function cancelGame(formData: FormData) {
  const id = String(formData.get("game_id"));
  const { supabase, user } = await authed(`/games/${id}`);
  await supabase.from("games").update({ status: "cancelled" }).eq("id", id).eq("host_id", user.id);
  revalidatePath("/games");
  redirect("/games");
}

// ---------- Ladder ----------
async function ladderRpc(fn: string, args?: Record<string, unknown>) {
  const { supabase } = await authed("/ladder");
  const { error } = await supabase.rpc(fn, args);
  revalidatePath("/ladder");
  revalidatePath("/dashboard");
  if (error) return fail("/ladder", error.message);
  redirect("/ladder");
}

export const joinLadder = async () => ladderRpc("join_ladder");
export const leaveLadder = async () => ladderRpc("leave_ladder");
export async function challenge(formData: FormData) {
  return ladderRpc("issue_challenge", { target: String(formData.get("target")), note: String(formData.get("note") ?? "") || null });
}
export async function respond(formData: FormData) {
  return ladderRpc("respond_challenge", { challenge: String(formData.get("id")), accept: formData.get("accept") === "yes" });
}
export async function cancelChallenge(formData: FormData) {
  return ladderRpc("cancel_challenge", { challenge: String(formData.get("id")) });
}
export async function reportResult(formData: FormData) {
  return ladderRpc("report_result", { challenge: String(formData.get("id")), winner: String(formData.get("winner")) });
}
export async function confirmResult(formData: FormData) {
  return ladderRpc("confirm_result", { challenge: String(formData.get("id")) });
}
export async function disputeResult(formData: FormData) {
  return ladderRpc("dispute_result", { challenge: String(formData.get("id")) });
}

// ---------- Profile ----------
export async function updateProfile(formData: FormData) {
  const { supabase, user } = await authed("/dashboard");
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: String(formData.get("display_name")).trim(),
      city: String(formData.get("city") ?? "").trim() || null,
      skill: String(formData.get("skill")),
      style: String(formData.get("style")),
      bio: String(formData.get("bio") ?? "").trim() || null,
    })
    .eq("id", user.id);
  if (error) return fail("/dashboard", error.message);
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=1");
}
