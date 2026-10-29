// Football's fixed knowledge for positions (#22, spec/06-positions.md): where each place of a
// formation plays, and what the Premier League's own label for a player means. Both are facts
// about football and the feed, the same in every league, so they are constants here, not league
// rules. Neither guesses: a formation or a label not in these tables gives no position, and the
// sync reports it so a row can be added.

/** Our labels, without a side, in the order positions are listed. */
export const POSITIONS = ["GK", "CB", "FB", "WB", "CDM", "CM", "WM", "CAM", "W", "SS", "ST"] as const;
export type Position = (typeof POSITIONS)[number];

/** Where a position falls in POSITIONS, back to front; none goes last. */
export const positionRank = (position: Position | null) => (position === null ? POSITIONS.length : POSITIONS.indexOf(position));

/** Each formation the Premier League sent for a start in 2025/26 or 2026/27 (900 team sheets of
 *  450 matches, read 20 Oct 2026), by its label, drawn as its sheet draws it: lines from the keeper
 *  up, each from the side's right to its left (docs/pl-match-stats.md). The keeper's line is left
 *  out: it is always one GK. Wide in a back four is FB, in a back five WB; wide beside a back three
 *  is WB; wide in a flat midfield is WM; wide ahead of midfield is W. Just ahead of the defence one
 *  or two men are CDM and three CM; one man behind the forwards is CAM. A 4-2-3-1's two deepest
 *  are CDM and a 4-3-3's three are CM (spec/06). SS is never a place: the admin marks him. Where
 *  the rule leaves a choice, the labels of the men who started there decided it (docs/positions.md). */
export const FORMATION_PLACES: Readonly<Record<string, readonly (readonly Position[])[]>> = {
  "4-2-3-1": [["FB", "CB", "CB", "FB"], ["CDM", "CDM"], ["W", "CAM", "W"], ["ST"]],
  "4-3-3": [["FB", "CB", "CB", "FB"], ["CM", "CM", "CM"], ["W", "ST", "W"]],
  "4-1-4-1": [["FB", "CB", "CB", "FB"], ["CDM"], ["WM", "CM", "CM", "WM"], ["ST"]],
  "4-4-2": [["FB", "CB", "CB", "FB"], ["WM", "CM", "CM", "WM"], ["ST", "ST"]],
  "4-4-1-1": [["FB", "CB", "CB", "FB"], ["WM", "CM", "CM", "WM"], ["CAM"], ["ST"]],
  "4-3-2-1": [["FB", "CB", "CB", "FB"], ["CM", "CM", "CM"], ["CAM", "CAM"], ["ST"]],
  // Drawn as a 4-3-2-1, but its two are the five's wide men, W (docs/positions.md has who).
  "4-5-1": [["FB", "CB", "CB", "FB"], ["CM", "CM", "CM"], ["W", "W"], ["ST"]],
  "4-2-2-2": [["FB", "CB", "CB", "FB"], ["CDM", "CDM"], ["CAM", "CAM"], ["ST", "ST"]],
  "4-1-3-2": [["FB", "CB", "CB", "FB"], ["CDM"], ["W", "CAM", "W"], ["ST", "ST"]],
  "4-3-1-2": [["FB", "CB", "CB", "FB"], ["CM", "CM", "CM"], ["CAM"], ["ST", "ST"]],
  "4-1-2-1-2": [["FB", "CB", "CB", "FB"], ["CDM"], ["CM", "CM"], ["CAM"], ["ST", "ST"]],
  // The two behind the striker were more often wingers than anything else, so W rather than CAM.
  "3-4-2-1": [["CB", "CB", "CB"], ["WB", "CM", "CM", "WB"], ["W", "W"], ["ST"]],
  "3-4-3": [["CB", "CB", "CB"], ["WB", "CM", "CM", "WB"], ["W", "ST", "W"]],
  "3-4-1-2": [["CB", "CB", "CB"], ["WB", "CM", "CM", "WB"], ["CAM"], ["ST", "ST"]],
  "3-5-2": [["CB", "CB", "CB"], ["WB", "CM", "CDM", "CM", "WB"], ["ST", "ST"]],
  "3-5-1-1": [["CB", "CB", "CB"], ["WB", "CM", "CDM", "CM", "WB"], ["CAM"], ["ST"]],
  "3-1-4-2": [["CB", "CB", "CB"], ["CDM"], ["WB", "CM", "CM", "WB"], ["ST", "ST"]],
  "5-4-1": [["WB", "CB", "CB", "CB", "WB"], ["WM", "CM", "CM", "WM"], ["ST"]],
  "5-3-2": [["WB", "CB", "CB", "CB", "WB"], ["CM", "CM", "CM"], ["ST", "ST"]],
};

/** Where a starter at `line` and `place` of `formation` played; null for a formation the table
 *  does not know, or a place it does not draw, which the sync reports. */
export function placePosition(formation: string, line: number, place: number): Position | null {
  if (!Object.hasOwn(FORMATION_PLACES, formation)) return null;
  if (line === 0) return place === 0 ? "GK" : null;
  return FORMATION_PLACES[formation][line - 1]?.[place] ?? null;
}

/** The Premier League's roles, the part of its `positionInfo` after the sides ("Left/Right Full
 *  Back" is sides "Left/Right", role "Full Back"). A clear role maps straight across; a vague one
 *  gives every position it could mean (spec/06: "Defender" is CB and FB). An attacking midfielder
 *  is the one role whose side matters: CAM in the centre, W out wide, both when no side is named. */
const ROLE_POSITIONS: Readonly<Record<string, readonly Position[]>> = {
  Goalkeeper: ["GK"],
  "Central Defender": ["CB"],
  "Full Back": ["FB"],
  "Wing Back": ["WB"],
  "Defensive Midfielder": ["CDM"],
  "Central Midfielder": ["CM"],
  Winger: ["W"],
  "Second Striker": ["SS"],
  Striker: ["ST"],
  Defender: ["CB", "FB"],
  Midfielder: ["CDM", "CM", "WM", "CAM"],
  Forward: ["W", "SS", "ST"],
};
const ATTACKING_MIDFIELDER = "Attacking Midfielder";
const CENTRE = "Centre";
const SIDES = ["Left", CENTRE, "Right"];

/** The positions the Premier League's label for a player gives, or null for a label these tables
 *  do not know, which the sync reports. */
export function labelPositions(positionInfo: string): Position[] | null {
  const [first, ...rest] = positionInfo.trim().split(" ");
  const named = first.split("/");
  const hasSides = named.every((side) => SIDES.includes(side));
  const sides = hasSides ? named : SIDES;
  const role = (hasSides ? rest : [first, ...rest]).join(" ");
  if (role === ATTACKING_MIDFIELDER) {
    const centre: Position[] = sides.includes(CENTRE) ? ["CAM"] : [];
    const wide: Position[] = sides.some((side) => side !== CENTRE) ? ["W"] : [];
    return [...centre, ...wide];
  }
  return Object.hasOwn(ROLE_POSITIONS, role) ? [...ROLE_POSITIONS[role]] : null;
}
