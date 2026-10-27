export type Skill = "beginner" | "intermediate" | "advanced";
export type Style = "american" | "riichi" | "hong_kong" | "chinese_official" | "any";

export const STYLE_LABEL: Record<string, string> = {
  american: "American (NMJL)",
  riichi: "Riichi",
  hong_kong: "Hong Kong",
  chinese_official: "Chinese Official",
  any: "Any style",
};
export const SKILL_LABEL: Record<string, string> = {
  any: "All levels",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export type Profile = { id: string; display_name: string; city: string | null; skill: string; style: string; bio: string | null };

export type Game = {
  id: string;
  host_id: string;
  title: string;
  style: string;
  skill: string;
  starts_at: string;
  location_name: string;
  city: string | null;
  seats: number;
  notes: string | null;
  status: string;
  host?: { display_name: string } | null;
  players: { user_id: string; name: string }[];
};

export type LadderRow = { user_id: string; name: string; rank: number; wins: number; losses: number };

export type Challenge = {
  id: string;
  challenger_id: string;
  challenged_id: string;
  challenger_name: string;
  challenged_name: string;
  status: string;
  winner_id: string | null;
  reported_by: string | null;
  message: string | null;
  created_at: string;
  completed_at: string | null;
};
