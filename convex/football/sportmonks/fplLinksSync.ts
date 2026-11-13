import { v, type Infer } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { takeAllOrThrow } from "../../shared/cappedRead";
import { sportmonksLineupMan, sportmonksLinkKind } from "../../schema";
import { linkAll, type Found, type HeldLinks, type LinkKind, type LinkRows } from "./fplLinks";
import { PREMIER_LEAGUE } from "./sportmonks";
import { SPORTMONKS_STAT_IDS } from "./sportmonksStats";

// The links to FPL's codes stored (#1421): after each six-hourly read of the Premier League, every
// club, man and match Sportmonks holds for it and has no link yet is linked by fplLinks.ts, and
// each one that links to nothing or to two is held unlinked, never dropped or guessed. The admin
// links those by hand, a link that stands. Until the admin dashboard has a picture with a place
// for them, the list and the hand link run from the CLI:
// `npx convex run football/sportmonks/fplLinksSync:unlinked`, and
// `npx convex run football/sportmonks/fplLinksSync:linkByHand '{"kind":"player","code":…,"fplCode":…}'`.

/** The most rows of each kind read whole: a season's 20 clubs, their squads' several hundred men
 *  and 380 matches, with room for clubs relegated and men gone. */
const CLUBS_MOST = 200;
const PLAYERS_MOST = 5000;
const MATCHES_MOST = 2000;
const LINKS_MOST = CLUBS_MOST + PLAYERS_MOST + MATCHES_MOST;

const kindCount = v.object({ linked: v.number(), unlinked: v.number() });
const linkCounts = v.object({ club: kindCount, player: kindCount, match: kindCount });

/** Links every Premier League club, man and match held with none yet, and says how many of each
 *  are linked and unlinked now. */
export const link = internalMutation({
  args: { ranAt: v.number() },
  returns: linkCounts,
  handler: async (ctx, { ranAt }) => {
    const rows = await heldLinks(ctx);
    const held = { club: new Map<number, number>(), player: new Map<number, number>(), match: new Map<number, number>() } satisfies HeldLinks;
    for (const row of rows) if (row.fplCode !== null) held[row.kind].set(row.code, row.fplCode);
    const found = linkAll(await sportmonksRows(ctx), await fplRows(ctx), held);
    const byKey = new Map(rows.map((row) => [keyOf(row.kind, row.code), row]));
    for (const kind of KINDS) for (const each of found[kind]) await write(ctx, kind, each, byKey.get(keyOf(kind, each.code)), ranAt);
    return countsOf(await heldLinks(ctx));
  },
});

const KINDS: readonly LinkKind[] = ["club", "player", "match"];
const keyOf = (kind: LinkKind, code: number) => `${kind}:${code}`;

function heldLinks(ctx: QueryCtx): Promise<Doc<"sportmonksFplLinks">[]> {
  return takeAllOrThrow(ctx.db.query("sportmonksFplLinks"), LINKS_MOST, `More than ${LINKS_MOST} links to FPL's codes are held`);
}

/** One row's link written: a new row, or a held unlinked one whose link or candidates changed. */
async function write(ctx: MutationCtx, kind: LinkKind, { code, fplCode, candidates }: Found, held: Doc<"sportmonksFplLinks"> | undefined, ranAt: number) {
  if (held === undefined) {
    await ctx.db.insert("sportmonksFplLinks", { kind, code, fplCode, candidates, since: ranAt });
    return;
  }
  if (held.fplCode === fplCode && held.candidates.join() === candidates.join()) return;
  await ctx.db.patch("sportmonksFplLinks", held._id, { fplCode, candidates });
}

/** How many of each kind are linked and unlinked. */
function countsOf(rows: readonly Doc<"sportmonksFplLinks">[]): Infer<typeof linkCounts> {
  const counts = { club: { linked: 0, unlinked: 0 }, player: { linked: 0, unlinked: 0 }, match: { linked: 0, unlinked: 0 } };
  for (const { kind, fplCode } of rows) counts[kind][fplCode === null ? "unlinked" : "linked"] += 1;
  return counts;
}

/** The Premier League's clubs, men and matches Sportmonks holds, none dropped. */
async function sportmonksRows(ctx: QueryCtx): Promise<LinkRows> {
  const tooMany = (what: string, most: number) => `More than ${most} Sportmonks Premier League ${what} are held`;
  const kept = <Row extends { droppedAt?: number }>(rows: Row[]) => rows.filter(({ droppedAt }) => droppedAt === undefined);
  const clubs = ctx.db.query("sportmonksClubs").withIndex("by_competition", (q) => q.eq("competition", PREMIER_LEAGUE));
  const players = ctx.db.query("sportmonksPlayers").withIndex("by_competition", (q) => q.eq("competition", PREMIER_LEAGUE));
  const matches = ctx.db.query("sportmonksFixtures").withIndex("by_competition", (q) => q.eq("competition", PREMIER_LEAGUE));
  return {
    clubs: kept(await takeAllOrThrow(clubs, CLUBS_MOST, tooMany("clubs", CLUBS_MOST))),
    players: kept(await takeAllOrThrow(players, PLAYERS_MOST, tooMany("players", PLAYERS_MOST))),
    matches: kept(await takeAllOrThrow(matches, MATCHES_MOST, tooMany("matches", MATCHES_MOST))),
  };
}

/** FPL's clubs, men and matches, none dropped. */
async function fplRows(ctx: QueryCtx): Promise<LinkRows> {
  const tooMany = (what: string, most: number) => `More than ${most} FPL ${what} are held`;
  const clubs = ctx.db.query("clubs").withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined));
  const players = ctx.db.query("players").withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined));
  const matches = ctx.db.query("fixtures").withIndex("by_droppedAt_and_kickoff", (q) => q.eq("droppedAt", undefined));
  return {
    clubs: await takeAllOrThrow(clubs, CLUBS_MOST, tooMany("clubs", CLUBS_MOST)),
    players: await takeAllOrThrow(players, PLAYERS_MOST, tooMany("players", PLAYERS_MOST)),
    matches: await takeAllOrThrow(matches, MATCHES_MOST, tooMany("matches", MATCHES_MOST)),
  };
}

/** One row's link, null for one the link run hasn't held yet. */
function linkOf(ctx: QueryCtx, kind: LinkKind, code: number) {
  return ctx.db
    .query("sportmonksFplLinks")
    .withIndex("by_kind_and_code", (q) => q.eq("kind", kind).eq("code", code))
    .unique();
}

/** The admin's link of one Sportmonks row to FPL's code for it, over whatever the link run found:
 *  his standing override. An FPL code another row of its kind holds is refused, as is a row or a
 *  code neither feed holds. */
export const linkByHand = internalMutation({
  args: { kind: sportmonksLinkKind, code: v.number(), fplCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { kind, code, fplCode }) => {
    const held = await linkOf(ctx, kind, code);
    if (held === null) throw new Error(`No Sportmonks ${kind} ${code} is held for linking`);
    if (!(await fplHolds(ctx, kind, fplCode))) throw new Error(`FPL holds no ${kind} with code ${fplCode}`);
    const other = await ctx.db
      .query("sportmonksFplLinks")
      .withIndex("by_kind_and_fplCode", (q) => q.eq("kind", kind).eq("fplCode", fplCode))
      .first();
    if (other !== null && other.code !== code) throw new Error(`FPL's ${kind} ${fplCode} is already Sportmonks' ${other.code}`);
    await ctx.db.patch("sportmonksFplLinks", held._id, { fplCode, candidates: [], byHand: true });
    return null;
  },
});

async function fplHolds(ctx: QueryCtx, kind: LinkKind, fplCode: number): Promise<boolean> {
  const table = ({ club: "clubs", player: "players", match: "fixtures" } as const)[kind];
  const row = await ctx.db
    .query(table)
    .withIndex("by_code", (q) => q.eq("code", fplCode))
    .first();
  return row !== null;
}

const unlinkedRow = v.object({
  kind: sportmonksLinkKind,
  code: v.number(),
  /** The FPL codes it might be: none when nothing fits. */
  candidates: v.array(v.number()),
  since: v.number(),
  /** A man's first Premier League minute: what put him on the list. */
  firstPlayedAt: v.optional(v.number()),
});

/** What the admin links by hand: every unlinked club and match, and every unlinked man once he has
 *  played a Premier League minute (Craig, 12 Nov 2026: "Once he plays"); the rest stay unlinked
 *  quietly. Clubs, then men, then matches, each oldest first. */
export const unlinked = internalQuery({
  args: {},
  returns: v.array(unlinkedRow),
  handler: async (ctx) => {
    const listed: Infer<typeof unlinkedRow>[] = [];
    for (const kind of KINDS) {
      const rows = ctx.db.query("sportmonksFplLinks").withIndex("by_kind_and_fplCode", (q) => q.eq("kind", kind).eq("fplCode", null));
      for (const { code, candidates, since } of await takeAllOrThrow(rows, LINKS_MOST, `More than ${LINKS_MOST} unlinked ${kind}s are held`)) {
        if (kind !== "player") {
          listed.push({ kind, code, candidates, since });
          continue;
        }
        const played = await firstMinuteOf(ctx, code);
        if (played !== null) listed.push({ kind, code, candidates, since, firstPlayedAt: played.at });
      }
    }
    return listed;
  },
});

function firstMinuteOf(ctx: QueryCtx, playerCode: number, competition = PREMIER_LEAGUE) {
  return ctx.db
    .query("sportmonksFirstMinutes")
    .withIndex("by_playerCode_and_competition", (q) => q.eq("playerCode", playerCode).eq("competition", competition))
    .unique();
}

type LineupMan = Infer<typeof sportmonksLineupMan>;

const hasPlayed = (man: LineupMan) => man.stats.some(({ typeId, value }) => typeId === SPORTMONKS_STAT_IDS.minutes && value > 0);

/** Each man a live read shows playing his first minute of a match's competition, noted at `at`:
 *  only those the held read of the match didn't already show playing are looked up. */
export async function noteFirstMinutes(ctx: MutationCtx, fixtureCode: number, men: readonly LineupMan[], heldMen: readonly LineupMan[], at: number) {
  const before = new Set(heldMen.filter(hasPlayed).map(({ playerId }) => playerId));
  const starting = men.filter((man) => hasPlayed(man) && !before.has(man.playerId));
  if (starting.length === 0) return;
  const match = await ctx.db
    .query("sportmonksFixtures")
    .withIndex("by_code", (q) => q.eq("code", fixtureCode))
    .first();
  const competition = match?.competition;
  if (competition === undefined) return;
  for (const { playerId } of starting) {
    if ((await firstMinuteOf(ctx, playerId, competition)) === null) await ctx.db.insert("sportmonksFirstMinutes", { playerCode: playerId, competition, at });
  }
}
