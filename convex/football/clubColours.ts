import type { Infer } from "convex/values";
import type { clubColoursRecord, shirtPattern } from "../schema/football";

// Each club's shirt on the pitch (spec/12, My team: "The shirts are our own, drawn in club
// colours"; plate.md, Marks). The admin owns each club's colours on his dashboard (spec/15, The
// admin; the `clubColours` table, #838), and this file gives every club its first: FPL serves no
// colours, so these are set by hand, copied from epl-draft's `packages/core/src/football/clubs.ts`
// (31 Oct 2026), keyed here by FPL's season-stable club `code` rather than its short name,
// Arsenal's and Sunderland's reds a shade darker so a white number on them reads (4.5:1). A club
// with no colours held, such as one promoted with no row here, is drawn white until the admin
// sets them. Each shirt's pattern is spec/12's (Club colours): Newcastle, Brentford, Palace,
// Brighton and Sunderland start striped. Kept free of the server, as the screens draw from it.

/** A shirt's pattern (spec/12, Club colours: "plain or stripes now, more as a club needs one"). */
export type Pattern = Infer<typeof shirtPattern>;

/** A club's two colours (the shirt a fan would name first, and its trim) and its shirt's pattern. */
export type Colours = Infer<typeof clubColoursRecord>;

/** One club's colours as the `clubColours` table holds them. */
export type HeldColours = Colours & { code: number };

/** A club's FPL short name, besides its first colours. */
type SeedColours = Colours & { shortName: string };

/** Every club's first colours, by FPL's club `code`, as `tests/support/recorded/fpl-bootstrap-static.json`
 *  gives each: what the football sync seeds a club's row from (clubKits.ts). */
export const CLUB_COLOURS: Readonly<Record<number, SeedColours>> = {
  3: { shortName: "ARS", primary: "#E50107", secondary: "#FFFFFF", pattern: "plain" },
  7: { shortName: "AVL", primary: "#670E36", secondary: "#95BFE5", pattern: "plain" },
  91: { shortName: "BOU", primary: "#DA291C", secondary: "#000000", pattern: "plain" },
  94: { shortName: "BRE", primary: "#E30613", secondary: "#FFFFFF", pattern: "stripes" },
  36: { shortName: "BHA", primary: "#0057B8", secondary: "#FFFFFF", pattern: "stripes" },
  8: { shortName: "CHE", primary: "#034694", secondary: "#FFFFFF", pattern: "plain" },
  9: { shortName: "COV", primary: "#78D0F3", secondary: "#FFFFFF", pattern: "plain" },
  31: { shortName: "CRY", primary: "#1B458F", secondary: "#C4122E", pattern: "stripes" },
  11: { shortName: "EVE", primary: "#003399", secondary: "#FFFFFF", pattern: "plain" },
  54: { shortName: "FUL", primary: "#FFFFFF", secondary: "#000000", pattern: "plain" },
  88: { shortName: "HUL", primary: "#F5A12D", secondary: "#000000", pattern: "plain" },
  40: { shortName: "IPS", primary: "#3A64A3", secondary: "#FFFFFF", pattern: "plain" },
  2: { shortName: "LEE", primary: "#FFFFFF", secondary: "#1D428A", pattern: "plain" },
  14: { shortName: "LIV", primary: "#C8102E", secondary: "#00B2A9", pattern: "plain" },
  43: { shortName: "MCI", primary: "#6CABDD", secondary: "#1C2C5B", pattern: "plain" },
  1: { shortName: "MUN", primary: "#DA291C", secondary: "#FBE122", pattern: "plain" },
  4: { shortName: "NEW", primary: "#241F20", secondary: "#FFFFFF", pattern: "stripes" },
  17: { shortName: "NFO", primary: "#DD0000", secondary: "#FFFFFF", pattern: "plain" },
  6: { shortName: "TOT", primary: "#FFFFFF", secondary: "#132257", pattern: "plain" },
  56: { shortName: "SUN", primary: "#E8172B", secondary: "#FFFFFF", pattern: "stripes" },
};

/** A club with no colours held: white and white, plain, until the admin sets them (spec/15). */
export const UNSET_COLOURS: Colours = { primary: "#FFFFFF", secondary: "#FFFFFF", pattern: "plain" };

/** Each club's colours by its code: white for a club with none held or no club (null, #323). */
export type ColoursOf = (clubCode: number | null) => Colours;

/** The one read of a club's colours (#838), from the rows the `clubColours` table holds. */
export function coloursFrom(held: readonly HeldColours[]): ColoursOf {
  const byCode = new Map(held.map(({ code, primary, secondary, pattern }) => [code, { primary, secondary, pattern }]));
  return (clubCode) => (clubCode === null ? undefined : byCode.get(clubCode)) ?? UNSET_COLOURS;
}

/** Every club's first colours as held rows: what the table holds once the football sync has
 *  seeded it and before the admin changes any, and what the preview and the tests draw from. */
export const SEEDED_COLOURS: readonly HeldColours[] = Object.entries(CLUB_COLOURS).map(([code, { primary, secondary, pattern }]) => ({
  code: Number(code),
  primary,
  secondary,
  pattern,
}));

/** A colour as the admin may set it: `#rrggbb`, any colour (spec/15). */
export function isColour(colour: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(colour);
}

/** The two inks a shirt's number and outline can take: styles.css's `--color-ground` and
 *  `--color-fact` (tests/src/myTeam/tactics/pitch/shirts.test.tsx holds them equal). */
export const INKS = { dark: "#111214", light: "#ffffff" } as const;
export type Ink = keyof typeof INKS;

/** Whichever of the two inks reads better on a colour. */
export function inkOn(colour: string): Ink {
  return contrast(colour, INKS.dark) >= contrast(colour, INKS.light) ? "dark" : "light";
}

/** What one player's shirt is drawn in: its colour, its trim (the stripes' colour on a striped
 *  shirt), its pattern, and the ink of its number and outline. */
export type Kit = { shirt: string; trim: string; pattern: Pattern; ink: Ink };

/** A player's shirt: his club's first colour in its pattern, trimmed in its second; or, for a
 *  keeper, its second colour, plain, so he stands apart from his outfield players. Inked in
 *  whichever of the two inks reads better on the shirt's colour. */
export function kitOf(colours: Colours, goalkeeper: boolean): Kit {
  const [shirt, trim] = goalkeeper ? [colours.secondary, colours.primary] : [colours.primary, colours.secondary];
  const pattern = goalkeeper ? "plain" : colours.pattern;
  return { shirt, trim, pattern, ink: inkOn(shirt) };
}

/** WCAG 2's contrast ratio between two `#rrggbb` colours, 1 to 21. */
export function contrast(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].toSorted((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2's relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
