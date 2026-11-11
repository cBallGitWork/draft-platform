import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { usedGameweeksOf } from "../gameweeks/usedGameweeks";
import { saveGameweekOf } from "../lineup/lineups";
import { clubRecord } from "../schema";
import { gameweekFixtures } from "../shared/fixtures";
import type { Clubs } from "../shared/players";

// The Squad tab's Schedule view (#1006; spec/12, My team's tabs: "his next 6 fixtures"): the next
// 6 gameweeks, from the one a lineup is being set for, because lineups are set per gameweek (Craig,
// 6 Nov 2026). A blank week's cell is empty and a double week's holds both matches. Only gameweeks
// the league plays are shown, so they skip one it unticked and stop at its last (spec/13,
// Gameweeks; #1561).

/** How many gameweeks the view holds. */
export const SCHEDULE_GAMEWEEKS = 6;

export const scheduledMatch = v.object({
  gameweek: v.number(),
  /** Null while the match has no kickoff time held. */
  kickoff: v.union(v.number(), v.null()),
  opponent: clubRecord,
  home: v.boolean(),
});
export type ScheduledMatch = Infer<typeof scheduledMatch>;

/** The gameweeks shown, the next six the league plays from the one being set, and each of these clubs' matches in them by club
 *  code, kickoff order, those with no kickoff time last. No gameweeks once the season is over or
 *  while the league has no rules to date a deadline by. */
export async function squadSchedule(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  now: number,
  clubCodes: ReadonlySet<number>,
  clubs: Clubs,
): Promise<{ gameweeks: number[]; byClub: Map<number, ScheduledMatch[]> }> {
  const byClub = new Map<number, ScheduledMatch[]>();
  const save = await saveGameweekOf(ctx, leagueId, now);
  const league = await ctx.db.get("leagues", leagueId);
  if (save.kind !== "open" || league === null) return { gameweeks: [], byClub };
  const gameweeks = usedGameweeksOf(league)
    .filter((gameweek) => gameweek >= save.gameweek)
    .slice(0, SCHEDULE_GAMEWEEKS);
  for (const gameweek of gameweeks) {
    for (const fixture of await gameweekFixtures(ctx, gameweek, "the Squad tab's schedule would be cut short")) {
      for (const [clubCode, opponentCode, home] of sidesOf(fixture)) {
        if (!clubCodes.has(clubCode)) continue;
        byClub.set(clubCode, [...(byClub.get(clubCode) ?? []), { gameweek, kickoff: fixture.kickoff, opponent: await clubs(opponentCode), home }]);
      }
    }
  }
  for (const matches of byClub.values()) matches.sort((one, other) => one.gameweek - other.gameweek || (one.kickoff ?? Infinity) - (other.kickoff ?? Infinity));
  return { gameweeks, byClub };
}

/** A match from each side: the club, its opponent, and whether it is at home. */
export const sidesOf = ({ homeClubCode, awayClubCode }: Doc<"fixtures">): [number, number, boolean][] => [
  [homeClubCode, awayClubCode, true],
  [awayClubCode, homeClubCode, false],
];
