// Each club's shirt on the pitch (spec/12, My team: "The shirts are our own, drawn in club
// colours"; plate.md, Marks). FPL serves no colours, so these are set by hand: copied from
// epl-draft's `packages/core/src/football/clubs.ts` (31 Oct 2026), keyed here by FPL's
// season-stable club `code` rather than its short name, Arsenal's and Sunderland's reds a shade
// darker so a white number on them reads (4.5:1). A club promoted later needs its row; until
// then its shirt is drawn as it was before colours, white.

/** A club's FPL short name, and its two colours: the shirt a fan would name first, and its trim. */
type ClubColours = { shortName: string; primary: string; secondary: string };

/** By FPL's club `code`, as `tests/support/recorded/fpl-bootstrap-static.json` gives each. */
export const CLUB_COLOURS: Readonly<Record<number, ClubColours>> = {
  3: { shortName: "ARS", primary: "#E50107", secondary: "#FFFFFF" },
  7: { shortName: "AVL", primary: "#670E36", secondary: "#95BFE5" },
  91: { shortName: "BOU", primary: "#DA291C", secondary: "#000000" },
  94: { shortName: "BRE", primary: "#E30613", secondary: "#FFFFFF" },
  36: { shortName: "BHA", primary: "#0057B8", secondary: "#FFFFFF" },
  8: { shortName: "CHE", primary: "#034694", secondary: "#FFFFFF" },
  9: { shortName: "COV", primary: "#78D0F3", secondary: "#FFFFFF" },
  31: { shortName: "CRY", primary: "#1B458F", secondary: "#C4122E" },
  11: { shortName: "EVE", primary: "#003399", secondary: "#FFFFFF" },
  54: { shortName: "FUL", primary: "#FFFFFF", secondary: "#000000" },
  88: { shortName: "HUL", primary: "#F5A12D", secondary: "#000000" },
  40: { shortName: "IPS", primary: "#3A64A3", secondary: "#FFFFFF" },
  2: { shortName: "LEE", primary: "#FFFFFF", secondary: "#1D428A" },
  14: { shortName: "LIV", primary: "#C8102E", secondary: "#00B2A9" },
  43: { shortName: "MCI", primary: "#6CABDD", secondary: "#1C2C5B" },
  1: { shortName: "MUN", primary: "#DA291C", secondary: "#FBE122" },
  4: { shortName: "NEW", primary: "#241F20", secondary: "#FFFFFF" },
  17: { shortName: "NFO", primary: "#DD0000", secondary: "#FFFFFF" },
  6: { shortName: "TOT", primary: "#FFFFFF", secondary: "#132257" },
  56: { shortName: "SUN", primary: "#E8172B", secondary: "#FFFFFF" },
};

/** A club with no row: the white shirt the pitch drew before colours. */
const UNKNOWN_CLUB: Omit<ClubColours, "shortName"> = { primary: "#FFFFFF", secondary: "#FFFFFF" };

/** The two inks a shirt's number and outline can take: styles.css's `--color-ground` and
 *  `--color-fact` (tests/src/myTeam/tactics/shirts.test.tsx holds them equal). */
export const INKS = { dark: "#111214", light: "#ffffff" } as const;
export type Ink = keyof typeof INKS;

/** What one player's shirt is drawn in: its colour, and the ink of its number and outline. */
export type Kit = { shirt: string; ink: Ink };

/** A player's shirt: his club's first colour, or its second for a keeper, so he stands apart from
 *  his outfield players; inked in whichever of the two inks reads better on it. A player with no
 *  club held (null, #323) wears the shirt of a club with no colours. */
export function kitOf(clubCode: number | null, goalkeeper: boolean): Kit {
  const colours = (clubCode === null ? undefined : CLUB_COLOURS[clubCode]) ?? UNKNOWN_CLUB;
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
