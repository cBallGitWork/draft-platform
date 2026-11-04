import { v, type Infer } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { rankedPlayer } from "../schema";
import { adminOf, refuse } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { rankingProblems, readRankingFile, type RankingProblem } from "./rankingFile";

// The admin's ranking (spec/04, The queue and the ranking; #1093): a file he uploads from his own
// research, one ranking for the whole platform, which auto-pick takes from when a manager's queue
// is out. Each upload replaces the last whole. Players join and leave the game all season, and a
// draft can be held mid-season (Craig, 4 Nov 2026, on #1093), so:
// - a code for a player who has left the game is skipped, and listed as skipped, never a bad line;
// - a player who joins after the upload is unranked, and auto-pick falls back for him as for any
//   player the file leaves out (spec/04: last season's points);
// - nothing here asks what part of the season it is.
// The admin dashboard's panel for it is a follow-up, waiting on an approved picture (Craig,
// 4 Nov 2026, on #1093: "Server now, panel later").

/** The most lines a file may rank: the game's players, about 800 a season with those who come and
 *  go, with room. Each line reads its player, and Convex caps the reads one mutation makes, so a
 *  longer file is refused whole, never cut. */
export const RANKING_LINES_MOST = 2000;

/** Why a whole file is refused, before any line is checked, in the words the admin is shown. */
export const rankingRefusals = {
  empty: "The file ranks no players, so the ranking already uploaded stays.",
  tooLong: `The file ranks more than ${RANKING_LINES_MOST} players, the most it can, so the ranking already uploaded stays.`,
};

export type RankedPlayer = Infer<typeof rankedPlayer>;

const lineProblem = v.object({ line: v.number(), words: v.string() });
const skippedLine = v.object({ line: v.number(), code: v.number() });

/** The admin's ranking, best first, or null while none is uploaded. */
export async function draftRanking(ctx: QueryCtx): Promise<{ players: RankedPlayer[]; uploadedAt: number } | null> {
  const row = await ctx.db.query("draftRanking").unique();
  return row && { players: row.players, uploadedAt: row.uploadedAt };
}

/** The admin uploads his ranking, the file's text whole. Stored only if every line is good, in
 *  place of the one before; otherwise nothing is stored, the one before stays, and every bad line
 *  is listed with why. A line naming a player who has left the game is skipped, and listed. */
export const upload = mutation({
  args: { file: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), ranked: v.number(), skipped: v.array(skippedLine) }),
    v.object({ ok: v.literal(false), problems: v.array(lineProblem) }),
  ),
  handler: async (ctx, { file }) => {
    await adminOf(ctx);
    const { ranked, problems } = readRankingFile(file);
    if (ranked.length + problems.length === 0) refuse(rankingRefusals.empty);
    if (ranked.length > RANKING_LINES_MOST) refuse(rankingRefusals.tooLong);
    const all: RankingProblem[] = [...problems];
    const skipped: Infer<typeof skippedLine>[] = [];
    const players: RankedPlayer[] = [];
    for (const { line, code, rank } of ranked) {
      const player = await playerByCode(ctx, code);
      if (player === null) all.push({ line, words: rankingProblems.unknownCode(code) });
      else if (player.droppedAt !== undefined) skipped.push({ line, code });
      else players.push({ code, rank });
    }
    if (all.length > 0) return { ok: false as const, problems: all.sort((a, b) => a.line - b.line) };
    players.sort((a, b) => a.rank - b.rank);
    const row = { players, uploadedAt: Date.now() };
    const held = await ctx.db.query("draftRanking").unique();
    if (held) await ctx.db.replace("draftRanking", held._id, row);
    else await ctx.db.insert("draftRanking", row);
    return { ok: true as const, ranked: players.length, skipped };
  },
});

/** The ranking as the admin uploaded it, best first, and when; null while none is. For the admin. */
export const view = query({
  args: {},
  returns: v.union(v.null(), v.object({ players: v.array(rankedPlayer), uploadedAt: v.number() })),
  handler: async (ctx) => {
    await adminOf(ctx);
    return draftRanking(ctx);
  },
});
