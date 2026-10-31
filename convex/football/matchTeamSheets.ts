import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type ActionCtx, type QueryCtx } from "../_generated/server";
import { recordSideRun, type SideMatchOutcome, type SideRunOutcome } from "../admin/sideRuns";
import { teamSheetMan } from "../schema";
import { logFailure } from "../shared/errors";
import { playerByCode } from "../shared/players";
import { byGameweek, dueMatch, type DueMatch } from "../shared/dueMatches";
import { LINEUPS_OUT_BEFORE_KICKOFF_MS } from "../shared/time";
import { codesByOpta, fixtureCodeIn } from "./feedIds";
import type { readFplPayloads } from "./fpl/fpl";
import { matchSlots } from "./premierLeague/plMatch";
import { readPlFixture, readPlFixtures } from "./premierLeague/premierLeague";

// Each match's team sheets before kickoff (#45; spec/10, The match page), read by the live tick
// (#28) and stored one row a match. Only the sheets are read: the gameweek's list for the match's
// id, then the match's own read; its points, commentary and team stats wait for kickoff. Each read
// replaces the held sheets, so a change made in the warm-up shows; a read naming nobody, or one
// that fails (on the team sheets feed's row), leaves them. A man FPL doesn't list is left out, as
// he is from kickoff, when the tick's row names him.

type TeamSheetMan = Infer<typeof teamSheetMan>;

/** A match whose sheets are due, with its kickoff, which the feeds page judges the sheets' lateness by. */
type DueSheets = DueMatch & { kickoff: number };

/** The matches whose sheets to read at `now`: kicking off within the hour, not yet kicked off. */
export async function dueSheetsAt(ctx: QueryCtx, now: number): Promise<DueSheets[]> {
  const upcoming = ctx.db
    .query("fixtures")
    .withIndex("by_kickoff", (q) => q.gt("kickoff", now).lte("kickoff", now + LINEUPS_OUT_BEFORE_KICKOFF_MS));
  const found: DueSheets[] = [];
  // Uncapped, as it stays small: matches kicking off within one hour, at most the ten a final day plays at once.
  for await (const { code, gameweek, kickoff, droppedAt } of upcoming) {
    if (droppedAt !== undefined || gameweek === null || kickoff === null) continue;
    found.push({ fixtureCode: code, gameweek, kickoff });
  }
  return found;
}

/** `dueSheetsAt`'s matches, for the tick. */
export const due = internalQuery({
  args: { now: v.number() },
  returns: v.array(dueMatch),
  handler: async (ctx, { now }): Promise<DueMatch[]> =>
    (await dueSheetsAt(ctx, now)).map(({ fixtureCode, gameweek }) => ({ fixtureCode, gameweek })),
});

/** Every due match's sheets read and stored, and the run recorded as the team sheets feed's row
 *  (#522); none while no match is due. The read never throws: a failure is logged and on the row,
 *  and the held sheets stand. `fpl` is the tick's read of FPL, shared with its live matches, for
 *  each man's FPL code. */
export async function syncTeamSheets(ctx: ActionCtx, now: number, fpl: typeof readFplPayloads): Promise<void> {
  const outcome = await readTeamSheets(ctx, now, fpl);
  if (outcome !== null) await recordSideRun(ctx, "teamSheets", now, outcome);
}

/** Each due match's sheets read and stored, and how each went; null while none is due. */
async function readTeamSheets(ctx: ActionCtx, now: number, fpl: typeof readFplPayloads): Promise<SideRunOutcome | null> {
  const matches: SideMatchOutcome[] = [];
  try {
    const due = await ctx.runQuery(internal.football.matchTeamSheets.due, { now });
    if (due.length === 0) return null;
    const codeByOpta = codesByOpta((await fpl()).bootstrap.elements);
    for (const [gameweek, codes] of byGameweek(due)) {
      let listed: Map<number | null, number>;
      try {
        listed = new Map((await readPlFixtures(gameweek)).map((each) => [fixtureCodeIn(each), each.id]));
      } catch (error: unknown) {
        const message = logFailure(`gameweek ${gameweek}'s team sheets failed`, error);
        matches.push(...codes.map((fixtureCode) => ({ fixtureCode, ok: false as const, error: message })));
        continue;
      }
      for (const fixtureCode of codes) {
        try {
          const id = listed.get(fixtureCode);
          if (id === undefined) throw new Error(`the Premier League lists no match ${fixtureCode} in gameweek ${gameweek}`);
          const { slots } = matchSlots(await readPlFixture(id), codeByOpta);
          const men = slots.map(({ playerCode, started }) => ({ playerCode, started }));
          if (men.length > 0) await ctx.runMutation(internal.football.matchTeamSheets.store, { fixtureCode, men });
          matches.push({ fixtureCode, ok: true });
        } catch (error: unknown) {
          matches.push({ fixtureCode, ok: false, error: logFailure(`match ${fixtureCode}'s team sheets failed`, error) });
        }
      }
    }
    return { ok: true, matches };
  } catch (error: unknown) {
    return { ok: false, error: logFailure("the team sheets before kickoff failed", error) };
  }
}

/** A match's held sheets; null before a read has named anyone. */
export function heldTeamSheetsOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"matchTeamSheets"> | null> {
  return ctx.db
    .query("matchTeamSheets")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** One read's sheets over the match's row. A man the football sync doesn't hold yet (a signing FPL
 *  has listed since its last run) is logged and left out until a later read, as the page names
 *  only held men. A read that changes nothing is not written, so a screen reading the row is not
 *  woken each minute. */
export const store = internalMutation({
  args: { fixtureCode: v.number(), men: v.array(teamSheetMan) },
  returns: v.null(),
  handler: async (ctx, { fixtureCode, men: named }) => {
    const men: TeamSheetMan[] = [];
    for (const man of named) {
      if ((await playerByCode(ctx, man.playerCode)) !== null) men.push(man);
      else logFailure(`match ${fixtureCode}'s team sheets`, `player ${man.playerCode} isn't held by the football sync yet`);
    }
    if (men.length === 0) return null;
    const held = await heldTeamSheetsOf(ctx, fixtureCode);
    if (held === null) await ctx.db.insert("matchTeamSheets", { fixtureCode, men });
    else if (!sameMen(held.men, men)) await ctx.db.patch("matchTeamSheets", held._id, { men });
    return null;
  },
});

/** The same men, in the same order, each starting or not as before. */
function sameMen(held: TeamSheetMan[], next: TeamSheetMan[]): boolean {
  return held.length === next.length && held.every((man, index) => man.playerCode === next[index].playerCode && man.started === next[index].started);
}
