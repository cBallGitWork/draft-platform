import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { namedCodes } from "../lineup/lineup";
import { lineupsInGameweek } from "../lineup/lineups";
import { statusOf } from "../stats/matchStats";
import { rulesIn, type GameweekInputs, type LeagueReads } from "./teamGameweek";

// One team's gameweek inputs from reads the size of its squad rather than of every match: what a
// season of a player's card or the Squad tab can afford (#577). The league's scorer
// (gameweekScores.ts's squadGameweek) scores the team from them.

/** A player's rows scoring reads, each by match code: his records, and the league's overrides of
 *  his points. */
export interface PlayerRows {
  records: ReadonlyMap<number, Doc<"playerMatchStats">>;
  overrides: ReadonlyMap<number, number>;
}

/** One team's inputs for the gameweek, each match holding only the rows of the men its lineup
 *  names. That is all teamInGameweek reads of a match, so the team scores as from gameweekInputs. */
export async function squadInputs(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
  teamId: Id<"teams">,
  rowsOf: (code: number) => Promise<PlayerRows>,
): Promise<GameweekInputs> {
  const ruled = rulesIn(reads, gameweek);
  const lineups = await lineupsInGameweek(ctx, reads.leagueId, [teamId], gameweek);
  const lineup = lineups.get(teamId)!;
  const codes = namedCodes(lineup);
  const rows = await Promise.all(codes.map(async (code) => [code, await rowsOf(code)] as const));
  const inMatch = <Row>(fixtureCode: number, held: (row: PlayerRows) => ReadonlyMap<number, Row>) =>
    new Map(rows.flatMap(([code, row]) => (held(row).has(fixtureCode) ? [[code, held(row).get(fixtureCode)!] as const] : [])));
  const matches = await Promise.all(
    fixtures.map(async (fixture) => ({
      fixture,
      status: await statusOf(ctx, fixture.code),
      records: inMatch(fixture.code, (row) => row.records),
      overrides: inMatch(fixture.code, (row) => row.overrides),
    })),
  );
  return { ...ruled, matches, lineups };
}
