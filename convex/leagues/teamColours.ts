import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { inkOn, type Ink } from "../football/clubColours";

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

/** Each palette colour as drawn, `#rrggbb`. */
export const TEAM_COLOUR_VALUES: Record<TeamColour, string> = {
  red: "#d71920",
  maroon: "#6b0f1a",
  claret: "#8b1e3f",
  orange: "#f36c21",
  yellow: "#fdd116",
  green: "#1e9e4a",
  darkGreen: "#0b5d2e",
  teal: "#00827f",
  skyBlue: "#6cabdd",
  royalBlue: "#1c4fa1",
  navy: "#132257",
  purple: "#5b2d8e",
  pink: "#f49ac1",
  grey: "#8a8d91",
  black: "#1a1a1a",
  white: "#ffffff",
};

/** How a team's page wears its colours (S12.25, S12.32): its header in the first, inked in
 *  whichever ink reads on it, over a stripe of the second and third side by side, or of the first
 *  alone when it holds one. Nothing for a team with none, whose header stays the plate's. */
export type TeamPaint = { header: string; ink: Ink; stripe: string[] };

export function teamPaintOf(colours: readonly TeamColour[] | undefined): TeamPaint | undefined {
  const [first, ...trim] = (colours ?? []).map((colour) => TEAM_COLOUR_VALUES[colour]);
  if (first === undefined) return undefined;
  return { header: first, ink: inkOn(first), stripe: trim.length > 0 ? trim : [first] };
}

const pickOne =<Item>(items: readonly Item[], random: () => number): Item => items[Math.floor(random() * items.length)];
