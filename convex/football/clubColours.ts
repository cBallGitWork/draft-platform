// Each club's shirt on the pitch (spec/12, My team: "The shirts are our own, drawn in club
// colours"; plate.md, Marks). FPL serves no colours, so these are set by hand: copied from
// epl-draft's `packages/core/src/football/clubs.ts` (31 Oct 2026), keyed here by FPL's
// season-stable club `code` rather than its short name, Arsenal's and Sunderland's reds a shade
// darker so a white number on them reads (4.5:1). A club promoted later needs its row; until
// then its shirt is drawn as it was before colours, white.

/** A club's two colours: the shirt a fan would name first, and its trim. */
type ClubColours = { primary: string; secondary: string };

/** By FPL's club `code`, as `tests/support/recorded/fpl-bootstrap-static.json` gives each. */
export const CLUB_COLOURS: Readonly<Record<number, ClubColours>> = {
  3: { primary: "#E50107", secondary: "#FFFFFF" }, // ARS
  7: { primary: "#670E36", secondary: "#95BFE5" }, // AVL
  91: { primary: "#DA291C", secondary: "#000000" }, // BOU
  94: { primary: "#E30613", secondary: "#FFFFFF" }, // BRE
  36: { primary: "#0057B8", secondary: "#FFFFFF" }, // BHA
  8: { primary: "#034694", secondary: "#FFFFFF" }, // CHE
  9: { primary: "#78D0F3", secondary: "#FFFFFF" }, // COV
  31: { primary: "#1B458F", secondary: "#C4122E" }, // CRY
  11: { primary: "#003399", secondary: "#FFFFFF" }, // EVE
  54: { primary: "#FFFFFF", secondary: "#000000" }, // FUL
  88: { primary: "#F5A12D", secondary: "#000000" }, // HUL
  40: { primary: "#3A64A3", secondary: "#FFFFFF" }, // IPS
  2: { primary: "#FFFFFF", secondary: "#1D428A" }, // LEE
  14: { primary: "#C8102E", secondary: "#00B2A9" }, // LIV
  43: { primary: "#6CABDD", secondary: "#1C2C5B" }, // MCI
  1: { primary: "#DA291C", secondary: "#FBE122" }, // MUN
  4: { primary: "#241F20", secondary: "#FFFFFF" }, // NEW
  17: { primary: "#DD0000", secondary: "#FFFFFF" }, // NFO
  6: { primary: "#FFFFFF", secondary: "#132257" }, // TOT
  56: { primary: "#E8172B", secondary: "#FFFFFF" }, // SUN
};

/** A club with no row: the white shirt the pitch drew before colours. */
const UNKNOWN_CLUB: ClubColours = { primary: "#FFFFFF", secondary: "#FFFFFF" };

/** The two inks a shirt's number and outline can take: styles.css's `--color-ground` and
 *  `--color-fact` (tests/src/myTeam/tactics/shirts.test.tsx holds them equal). */
export const INKS = { dark: "#08090b", light: "#ffffff" } as const;
export type Ink = keyof typeof INKS;

/** What one player's shirt is drawn in: its colour, and the ink of its number and outline. */
export type Kit = { shirt: string; ink: Ink };

/** A player's shirt: his club's first colour, or its second for a keeper, so he stands apart from
 *  his outfield players; inked in whichever of the two inks reads better on it. */
export function kitOf(clubCode: number, goalkeeper: boolean): Kit {
  const colours = CLUB_COLOURS[clubCode] ?? UNKNOWN_CLUB;
  const shirt = goalkeeper ? colours.secondary : colours.primary;
  return { shirt, ink: contrast(shirt, INKS.dark) >= contrast(shirt, INKS.light) ? "dark" : "light" };
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
