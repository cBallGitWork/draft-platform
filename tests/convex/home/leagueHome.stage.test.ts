import { describe, expect, test } from "vitest";
import { DAY_MS } from "../../../convex/shared/time";
import { draftStarted } from "../../support/convex/draft.harness";
import { fullTimeRecords, lockMatch } from "../../support/convex/gameweekScoresMatch.harness";
import { GAMEWEEK, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { actingAs, ANN, COMMISSIONER, freshLeague } from "../../support/convex/leagues.harness";
import { leagueHomeOf } from "../../support/convex/screenReads.harness";

// Where league home says the season stands, for the deadline strip's first box (spec/12, S12.22;
// #2674): the draft and its start until the draft is over, then the season, then over once the last
// gameweek the league plays is final.

/** The stage as the commissioner reads it: he runs no team, so the scores league's own panels, whose
 *  clubs it doesn't hold, aren't read. */
const stageOf = async ({ t, leagueId }: Pick<ScoresLeague, "t" | "leagueId">) => (await leagueHomeOf(await actingAs(t, COMMISSIONER), leagueId, Date.now())).stage;

describe("S12.22 the stage league home reads", () => {
  test("before the draft, the draft with no start until the commissioner sets one, then its start", async () => {
    const league = await freshLeague({ managers: [ANN] });
    expect(await stageOf(league)).toEqual({ kind: "draft", startsAt: null });

    const startsAt = Date.now() + DAY_MS;
    await league.t.run(async (ctx) => {
      await ctx.db.insert("drafts", { leagueId: league.leagueId, startsAt });
    });
    expect(await stageOf(league)).toEqual({ kind: "draft", startsAt });
  });

  test("while the draft is live, the draft and when it started", async () => {
    const league = await freshLeague({ managers: [ANN] });
    await draftStarted(league.t, league.leagueId, league.teams, 15);
    const draft = await league.t.run((ctx) => ctx.db.query("drafts").unique());
    expect(await stageOf(league)).toEqual({ kind: "draft", startsAt: draft!.started!.at });
  });

  /** The scores league with its draft over and gameweek 6 the last it plays. */
  async function endingAtSix(): Promise<ScoresLeague> {
    const league = await scoresLeague();
    await draftStarted(league.t, league.leagueId, [league.annsTeam, league.bobsTeam]);
    await league.t.run(async (ctx) => {
      await ctx.db.patch("leagues", league.leagueId, { unusedGameweeks: Array.from({ length: 38 - GAMEWEEK }, (_, i) => GAMEWEEK + 1 + i) });
    });
    return league;
  }

  test("in its last gameweek, the season while a score may still move", async () => {
    const league = await endingAtSix();
    expect(await stageOf(league)).toEqual({ kind: "season" });
  });

  test("once its last gameweek is final, over", async () => {
    const league = await endingAtSix();
    await fullTimeRecords(league);
    await lockMatch(league);
    expect(await stageOf(league)).toEqual({ kind: "over" });
  });
});
