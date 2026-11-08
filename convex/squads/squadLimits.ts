import { v, type Infer } from "convex/values";
import { AREAS, areasOf, type Area } from "../lineup/pitch";
import { areaShape } from "../lineup/pitchShape";
import type { Position } from "../positions/positionTables";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { clubRecord } from "../schema/football";
import { minimumsFilled } from "./areaMinimums";

// The Squad tab's Rules view (#1006; spec/12, My team's tabs: "your squad against the league's
// limits"): one row per limit, each naming the players it counts (Craig, 6 Nov 2026). A club row
// shows only when the league sets a club maximum, and an area row only when it sets that area's
// minimum. A player who plays two areas fills whichever minimum helps the squad (spec/03, Squad
// make-up; areaMinimums.ts), and is named there once. Pure: no I/O.

/** How many of his club's next matches a squad row holds (the picture's Next 3; teamSquad.ts). */
export const NEXT_MATCHES_SHOWN = 3;

export const squadLimit = v.union(
  v.object({
    kind: v.literal("size"),
    /** Every player held, by code: the players the football sync no longer holds count too, in
     *  `count`, but have no name to show. */
    players: v.array(v.number()),
    count: v.number(),
    minimum: v.number(),
    maximum: v.number(),
  }),
  v.object({ kind: v.literal("area"), area: areaShape, players: v.array(v.number()), minimum: v.number() }),
  v.object({ kind: v.literal("club"), club: clubRecord, players: v.array(v.number()), maximum: v.number() }),
);
export type SquadLimit = Infer<typeof squadLimit>;
type Club = Infer<typeof clubRecord>;

/** A held player as the limits read him. */
export type LimitPlayer = { code: number; positions: readonly Position[]; club: Club };

/** The squad's rows against the league's squad rules, in the view's order: its size, then each
 *  area back to front, then each club, most players first. None with no rules. */
export function squadLimits(players: readonly LimitPlayer[], unheld: number, squad: LeagueRules["squad"] | null): SquadLimit[] {
  if (squad === null) return [];
  const { size, minimumByArea, maxPerClub } = squad;
  const codes = players.map(({ code }) => code);
  return [
    ...(size === null ? [] : [{ kind: "size" as const, players: codes, count: players.length + unheld, ...size }]),
    ...(minimumByArea === null ? [] : areaLimits(players, minimumByArea)),
    ...(maxPerClub === null ? [] : clubLimits(players, maxPerClub)),
  ];
}

/** One row for each area with a minimum: who fills it, and each player who fills none named under
 *  the first area with a row he plays, his main position's first. */
function areaLimits(players: readonly LimitPlayer[], minimums: Readonly<Record<Area, number>>): SquadLimit[] {
  const filled = minimumsFilled(
    players.map(({ positions }) => areasOf(positions)),
    minimums,
  );
  const named = players.map(({ positions }, index) => filled[index] ?? [...areasOf(positions.slice(0, 1)), ...areasOf(positions)].find((area) => minimums[area] > 0) ?? null);
  return AREAS.filter((area) => minimums[area] > 0).map((area) => ({
    kind: "area" as const,
    area,
    players: players.filter((_, index) => named[index] === area).map(({ code }) => code),
    minimum: minimums[area],
  }));
}

/** One row for each club the squad holds a player from, most players first, then by club code. */
function clubLimits(players: readonly LimitPlayer[], maximum: number): SquadLimit[] {
  const byClub = new Map<number, { club: Club; players: number[] }>();
  for (const { code, club } of players) {
    const held = byClub.get(club.code) ?? { club, players: [] };
    byClub.set(club.code, { club, players: [...held.players, code] });
  }
  return [...byClub.values()]
    .sort((one, other) => other.players.length - one.players.length || one.club.shortName.localeCompare(other.club.shortName))
    .map(({ club, players: codes }) => ({ kind: "club" as const, club, players: codes, maximum }));
}
