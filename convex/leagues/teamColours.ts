import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";

// A team's colours (spec/12, Team colours): one, two or three from a set palette of 16, the first
// its header's and the second and third its stripe's (S12.26, S12.32). A new team starts on two
// at random (S12.33); its manager or the admin changes them (./teams.ts, setColours).

/** The palette, by name (Craig, 19 Nov 2026, on #2684: "16, adding claret, pink, teal, grey"). */
export const TEAM_COLOURS = [
  "red",
  "maroon",
  "claret",
  "orange",
  "yellow",
  "green",
  "darkGreen",
  "teal",
  "skyBlue",
  "royalBlue",
  "navy",
  "purple",
  "pink",
  "grey",
  "black",
  "white",
] as const;

export type TeamColour = (typeof TEAM_COLOURS)[number];

/** One colour of the palette, as the server stores and takes it. */
export const teamColour = v.union(...TEAM_COLOURS.map((colour) => v.literal(colour)));

/** A team's colours, first to third: three slots, the first required and the other two optional
 *  (Craig, 26 Nov 2026, on #2684). The same colour may fill more than one (S12.32: all red is a kit). */
export const teamColours = v.array(teamColour);

/** Two different colours for a new team (S12.33), its first one no other team in the league
 *  starts on while the palette has one free. */
export function startingColours(teams: Doc<"teams">[], random: () => number): Infer<typeof teamColours> {
  const taken = new Set(teams.map((team) => team.colours?.[0]));
  const free = TEAM_COLOURS.filter((colour) => !taken.has(colour));
  const pool = free.length > 0 ? free : [...TEAM_COLOURS];
  const first = pickOne(pool, random);
  return [first, pickOne(TEAM_COLOURS.filter((colour) => colour !== first), random)];
}

const pickOne = <Item>(items: readonly Item[], random: () => number): Item => items[Math.floor(random() * items.length)];
