import { expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { codesByOpta, fixtureCodeIn } from "../../../convex/football/feedIds";
import { plCommentaryUrl, plFixtureUrl } from "../../../convex/football/football";
import {
  COMMENTARY_BEHIND_MINUTES,
  commentaryContext,
  EMPTY_STREAM,
  readCommentary,
  type CommentaryRead,
} from "../../../convex/football/matchCommentary";
import type { RawPlCommentary, RawPlFixture } from "../../../convex/football/premierLeague/premierLeague";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { actingAs } from "../../support/convex/leagues.harness";
import { expectRefused, fakeFetch, freshConvex, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";
import {
  LIVE_COMMENTARY,
  LIVE_MATCH,
  recordedLiveCommentary,
  recordedLiveFplPlayers,
  recordedLiveSheets,
} from "../../support/recorded/live.payloads";
import live from "../../support/recorded/pl-live-match.json";

// Ipswich v Nott'm Forest's commentary, recorded live on 23 Oct 2026, replayed read by read into
// the store the live tick writes (#43): each read replaces the match's lines, a stalled stream is
// recorded as delayed, and a screen reads the lines back. The tick's own part, on Hull v Everton,
// is in tests/convex/stats/liveStats.commentary.test.ts.

const IPSWICH_FOREST = fixtureCodeIn(recordedLiveSheets())!;
const CLUBS = { home: "IPS", away: "NFO" };
/** Ipswich v Forest's lines the replay follows, by feed id. */
const LINE = { firstGoal: 2878012, droppedFoul: 2878263 } as const;
const MANAGER = "manager@example.com";

type Read = keyof typeof LIVE_COMMENTARY;

/** The match as the read's own `fixture` gives it (untyped in premierLeague.ts): the list's entry. */
function listedAt(read: RawPlCommentary): RawPlFixture {
  return (read as RawPlCommentary & { fixture: RawPlFixture }).fixture;
}

/** One recorded read served and written; `change` alters the read first. */
async function readAt(read: Read, change: (raw: RawPlCommentary) => void = () => {}): Promise<CommentaryRead> {
  const raw = recordedLiveCommentary(read);
  change(raw);
  vi.stubGlobal(
    "fetch",
    fakeFetch(
      new Map<string, unknown>([
        [plFixtureUrl(LIVE_MATCH), recordedLiveSheets()],
        [plCommentaryUrl(LIVE_MATCH), raw],
      ]),
    ),
  );
  const fplPlayers = recordedLiveFplPlayers();
  const context = commentaryContext({ elements: fplPlayers, teams: [], events: [] }, codesByOpta(fplPlayers));
  return readCommentary(IPSWICH_FOREST, listedAt(raw), CLUBS, context);
}

async function store(t: TestConvex, at: number, read: CommentaryRead) {
  await t.mutation(internal.football.matchCommentary.store, { fixtureCode: IPSWICH_FOREST, readAt: at, ...read });
}

async function shown(t: TestConvex) {
  return (await actingAs(t, MANAGER)).query(api.football.matchCommentary.ofMatch, { fixtureCode: IPSWICH_FOREST });
}

function textOf(lines: { sourceId: number; text: string }[], sourceId: number) {
  return lines.find((line) => line.sourceId === sourceId)?.text;
}

/** When a read was made, from the recording. */
function polledAt(read: Read): number {
  return Date.parse(live.commentary[read].polledAt);
}

test("replayed read by read, the match's lines are replaced whole, kick-off to full time", async () => {
  const t = freshConvex();

  await store(t, polledAt("goal"), await readAt("goal"));
  const atGoal = (await shown(t))!;
  expect(atGoal.delayed).toBe(false);
  expect(atGoal.lines.at(-1)?.text).toBe("Lineups out");
  expect(atGoal.lines.at(-2)?.text).toBe("KO IPS v NFO");
  expect(textOf(atGoal.lines, LINE.firstGoal)).toBe("13' GOAL N.Williams");

  await store(t, polledAt("withVanished"), await readAt("withVanished"));
  expect(textOf((await shown(t))!.lines, LINE.droppedFoul)).toBeDefined();

  await store(t, polledAt("final"), await readAt("final"));
  const atFullTime = (await shown(t))!;
  expect(atFullTime).toMatchObject({ delayed: false });
  // Each league scores its own way, so the stored full-time line carries the score alone.
  expect(atFullTime.lines[0]?.text).toBe("FT IPS 1–1 NFO");
  expect(textOf(atFullTime.lines, LINE.firstGoal)).toBe("13' GOAL N.Williams, assist Muñoz");
  expect(textOf(atFullTime.lines, LINE.droppedFoul)).toBeUndefined();
  expect(atFullTime.lines).toEqual((await readAt("final")).lines);
});

test("a stream stalled while the clock runs on is delayed from that read, and keeps up again once it catches up", async () => {
  const t = freshConvex();
  await store(t, polledAt("withVanished"), await readAt("withVanished"));
  const stalledAt = polledAt("withVanished") + (COMMENTARY_BEHIND_MINUTES + 1) * MINUTE_MS;

  const stalled = await readAt("withVanished", (raw) => {
    listedAt(raw).clock!.secs += ((COMMENTARY_BEHIND_MINUTES + 1) * MINUTE_MS) / SECOND_MS;
  });
  await store(t, stalledAt, stalled);

  expect(stalled.delayed).toBe(`the stream is over ${COMMENTARY_BEHIND_MINUTES} minutes behind the clock`);
  expect(await shown(t)).toEqual({ lines: (await readAt("withVanished")).lines, delayed: true });
  const row = await t.run((ctx) => ctx.db.query("matchCommentary").unique());
  expect(row?.delayed).toEqual({ reason: stalled.delayed, since: stalledAt });

  await store(t, polledAt("final"), await readAt("final"));
  expect((await shown(t))!.delayed).toBe(false);
});

test("a stream no further behind than the allowance is not delayed", async () => {
  const read = await readAt("withVanished", (raw) => {
    listedAt(raw).clock!.secs += (COMMENTARY_BEHIND_MINUTES * MINUTE_MS) / SECOND_MS;
  });

  expect(read.delayed).toBeNull();
});

test("at half-time the stream is not judged behind, however long the break", async () => {
  const read = await readAt("withVanished", (raw) => {
    Object.assign(listedAt(raw), { phase: "H" });
    listedAt(raw).clock!.secs += (2 * COMMENTARY_BEHIND_MINUTES * MINUTE_MS) / SECOND_MS;
  });

  expect(read.delayed).toBeNull();
});

test("a line of a type with no wording is left out, the rest are kept, and the commentary says it is delayed", async () => {
  const t = freshConvex();
  const read = await readAt("final", (raw) => {
    raw.events.content.splice(1, 0, { id: 1, type: "brand new type", text: "Something new." });
  });
  await store(t, polledAt("final"), read);

  expect(read.delayed).toBe('1 lines of a type with no wording ("brand new type")');
  expect(await shown(t)).toEqual({ lines: (await readAt("final")).lines, delayed: true });
});

test("a read with no lines keeps the held ones and is delayed, logged, and a delay keeps the time it began", async () => {
  const errors = silenceConsoleError();
  const t = freshConvex();
  await store(t, polledAt("goal"), await readAt("goal"));
  const held = (await shown(t))!.lines;

  await store(t, polledAt("goal") + MINUTE_MS, { lines: [], delayed: null });
  await store(t, polledAt("goal") + 2 * MINUTE_MS, { lines: [], delayed: null });

  expect(await shown(t)).toEqual({ lines: held, delayed: true });
  const row = await t.run((ctx) => ctx.db.query("matchCommentary").unique());
  expect(row?.delayed).toEqual({ reason: EMPTY_STREAM, since: polledAt("goal") + MINUTE_MS });
  expect(errors).toHaveBeenCalledWith(`match ${IPSWICH_FOREST}'s commentary is delayed: ${EMPTY_STREAM}`);
});

test("a read that failed keeps the held lines, delayed with why", async () => {
  const t = freshConvex();
  await store(t, polledAt("goal"), await readAt("goal"));
  const held = (await shown(t))!.lines;

  await store(t, polledAt("goal") + MINUTE_MS, { lines: null, delayed: "the stream answered 503" });

  expect(await shown(t)).toEqual({ lines: held, delayed: true });
});

test("before its first read a match has no commentary, and it is for signed-in people only", async () => {
  const t = freshConvex();

  expect(await shown(t)).toBeNull();
  await expectRefused(t.query(api.football.matchCommentary.ofMatch, { fixtureCode: IPSWICH_FOREST }), refusals.signedOut);
});
