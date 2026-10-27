import { createClient } from "./supabase/server";
import { isConfigured } from "./supabase/config";
import type { Challenge, Game, LadderRow } from "./types";

const day = 86400000;
const inDays = (d: number, h = 18) => {
  const t = new Date(Date.now() + d * day);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

const DEMO_GAMES: Game[] = [
  { id: "demo-1", host_id: "d1", title: "Sunday Social: American Mahj", style: "american", skill: "any", starts_at: inDays(3, 14), location_name: "Common Market, Plaza Midwood", city: "Charlotte", seats: 4, notes: "Cards provided. Bring a snack to share!", status: "open", host: { display_name: "Renee" }, players: [{ user_id: "d1", name: "Renee" }, { user_id: "d2", name: "Tasha" }] },
  { id: "demo-2", host_id: "d3", title: "Beginners Welcome Table", style: "american", skill: "beginner", starts_at: inDays(5, 18), location_name: "Private home, South End", city: "Charlotte", seats: 4, notes: "Learning night. Patient players only.", status: "open", host: { display_name: "Monique" }, players: [{ user_id: "d3", name: "Monique" }] },
  { id: "demo-3", host_id: "d4", title: "Riichi Practice Night", style: "riichi", skill: "intermediate", starts_at: inDays(7, 19), location_name: "Tryon Tea House", city: "Charlotte", seats: 4, notes: null, status: "open", host: { display_name: "Kiara" }, players: [{ user_id: "d4", name: "Kiara" }, { user_id: "d5", name: "Dana" }, { user_id: "d6", name: "Jo" }, { user_id: "d7", name: "Simone" }] },
];

const DEMO_LADDER: LadderRow[] = [
  { user_id: "d4", name: "Kiara W.", rank: 1, wins: 14, losses: 3 },
  { user_id: "d1", name: "Renee T.", rank: 2, wins: 11, losses: 5 },
  { user_id: "d6", name: "Jo M.", rank: 3, wins: 9, losses: 6 },
  { user_id: "d2", name: "Tasha B.", rank: 4, wins: 7, losses: 7 },
  { user_id: "d3", name: "Monique R.", rank: 5, wins: 4, losses: 6 },
  { user_id: "d5", name: "Dana P.", rank: 6, wins: 2, losses: 5 },
  { user_id: "d7", name: "Simone L.", rank: 7, wins: 1, losses: 4 },
];

export async function getUser() {
  if (!isConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  return { id: data.user.id, email: data.user.email ?? "", profile };
}

type GameRow = Omit<Game, "players" | "host"> & {
  host: { display_name: string } | { display_name: string }[] | null;
  game_players: { user_id: string; profiles: { display_name: string } | { display_name: string }[] | null }[];
};
const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v);

function toGame(g: GameRow): Game {
  return {
    ...g,
    host: one(g.host),
    players: (g.game_players ?? []).map((p) => ({ user_id: p.user_id, name: one(p.profiles)?.display_name ?? "Member" })),
  };
}

const GAME_SELECT = "*, host:profiles!games_host_id_fkey(display_name), game_players(user_id, profiles(display_name))";

export async function getGames(): Promise<Game[]> {
  if (!isConfigured) return DEMO_GAMES;
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("status", "open")
    .gte("starts_at", new Date(Date.now() - 3 * 3600000).toISOString())
    .order("starts_at");
  return ((data ?? []) as unknown as GameRow[]).map(toGame);
}

export async function getGame(id: string): Promise<Game | null> {
  if (!isConfigured) return DEMO_GAMES.find((g) => g.id === id) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("games").select(GAME_SELECT).eq("id", id).single();
  return data ? toGame(data as unknown as GameRow) : null;
}

export async function getLadder(): Promise<LadderRow[]> {
  if (!isConfigured) return DEMO_LADDER;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ladder_entries")
    .select("user_id, rank, wins, losses, profiles(display_name)")
    .order("rank");
  return (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    rank: r.rank,
    wins: r.wins,
    losses: r.losses,
    name: one(r.profiles)?.display_name ?? "Member",
  }));
}

export async function getChallenges(): Promise<Challenge[]> {
  if (!isConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("ladder_challenges")
    .select("*, a:profiles!ladder_challenges_challenger_id_fkey(display_name), b:profiles!ladder_challenges_challenged_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((c: any) => ({
    ...c,
    challenger_name: one(c.a)?.display_name ?? "Member",
    challenged_name: one(c.b)?.display_name ?? "Member",
  }));
}
