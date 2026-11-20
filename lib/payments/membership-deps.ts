import { cloverConfig } from "./clover";
import { getMembershipStore } from "./memberships";
import type { Deps } from "./membership-service";
import { recurring } from "./recurring";

/** Real dependencies for the membership routes, or null when Clover or Supabase is not configured. */
export function membershipDeps(): Deps | null {
  const store = getMembershipStore();
  if (!store || !cloverConfig()) return null;
  return { store, clover: recurring, planId: process.env.CLOVER_MEMBERSHIP_PLAN_ID };
}
