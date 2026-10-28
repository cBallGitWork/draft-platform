import { v } from "convex/values";

/** Who held a role before, or null when nobody did. */
export const replaced = v.union(v.string(), v.null());
/** A manager and their team, its name as it was then. */
export const managerOfTeam = { email: v.string(), teamId: v.id("teams"), teamName: v.string() };
