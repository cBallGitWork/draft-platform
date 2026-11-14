// Each man's match stats from a Sportmonks match (#1415, spec/07 `S07.4`, `S07.10`, `S07.11`, `S07.12`, spec/05
// `S05.16`): the recorded Celtic v Rangers (2-1: Kyogo 12' and 45+1', Tavernier's penalty 55',
// McCowan on for Kyogo 68') mapped to one record per man, and the stats no type sends worked out.

import { expect, test, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { sides } from "../../../../convex/football/sportmonks/sportmonks";
import { mapSportmonksMatch } from "../../../../convex/football/sportmonks/sportmonksMatch";
import {
  halfTimeReached,
  sportmonksPlayerStats,
  WORKED_OUT,
  withLastRead,
  type SportmonksMatchRead,
} from "../../../../convex/football/sportmonks/sportmonksPlayerStats";
import { SM_STATE, type RawFixture } from "../../../../convex/football/sportmonks/sportmonksRaw";
import { SM_EVENT_TYPE } from "../../../../convex/football/sportmonks/sportmonksCommentary";
import { freshConvex, silenceConsoleError } from "../../../support/convex/test.harness";
import { SM, sportmonksLiveRead } from "../../../support/recorded/sportmonks.payloads";
import { sync, ticks, useSportmonks } from "../../../support/convex/sportmonks.harness";
import { recordOf } from "../../../support/convex/teamPoints.harness";

useSportmonks();

/** The recorded Old Firm, at the state given, as the mapper reads it. */
function oldFirm(stateId: number = SM_STATE.fullTime, change: (raw: RawFixture) => void = () => {}): SportmonksMatchRead {
  const raw = sportmonksLiveRead().data[0];
  raw.state_id = stateId;
  change(raw);
  const { score, men, events } = mapSportmonksMatch(raw);
  const { home, away } = sides(raw);
  return { score, homeTeamId: home, awayTeamId: away, halfTime: halfTimeReached(stateId), men, events };
}

/** A man's whole record; his stats alone come from `recordOf`. */
const sportmonksRecordOf = (records: ReturnType<typeof sportmonksPlayerStats>, player: number) =>
  records.find((record) => record.playerCode === player)!;

/** McCowan came on with no `lineups.details` in the recording: give him some. */
const mcCowanSent = (raw: RawFixture) => {
  raw.lineups!.find((man) => man.player_id === SM.mcCowan)!.details = [{ type_id: 119, data: { value: 22 } }];
};

test("the recorded Scottish match maps to one record per named man, keyed on Sportmonks' ids", () => {
  const records = sportmonksPlayerStats(oldFirm());
  expect(records.map(({ playerCode, fixtureCode, clubCode, started, played }) => [playerCode, fixtureCode, clubCode, started, played])).toEqual([
    [SM.schmeichel, SM.oldFirm, SM.celtic, true, true],
    [SM.kyogo, SM.oldFirm, SM.celtic, true, true],
    [SM.mcCowan, SM.oldFirm, SM.celtic, false, true],
    [SM.tavernier, SM.oldFirm, SM.rangers, true, true],
  ]);
});

test("each statistic type becomes its catalogue stats, one type filling two where the catalogue has two; a type with none is not kept", () => {
  const records = sportmonksPlayerStats(oldFirm());
  expect(recordOf(records, SM.kyogo)).toMatchObject({ minutes: 67, goals_scored: 2, ontarget_scoring_att: 3 });
  expect(Object.keys(recordOf(records, SM.kyogo))).not.toContain("118");
  const tackler = sportmonksPlayerStats(oldFirm(SM_STATE.fullTime, (raw) => raw.lineups![0].details!.push({ type_id: 78, data: { value: 4 } })));
  expect(recordOf(tackler, SM.schmeichel)).toMatchObject({ tackles: 4, total_tackle: 4 });
});

test("appearance, start and subs come from the lineups and the substitution", () => {
  const records = sportmonksPlayerStats(oldFirm());
  const worked = (player: number) => {
    const stats = recordOf(records, player);
    return [stats[WORKED_OUT.appearances], stats[WORKED_OUT.started], stats[WORKED_OUT.subOn], stats[WORKED_OUT.subOff]];
  };
  expect(worked(SM.kyogo)).toEqual([1, 1, 0, 1]);
  expect(worked(SM.mcCowan)).toEqual([1, 0, 1, 0]);
  expect(worked(SM.tavernier)).toEqual([1, 1, 0, 0]);
});

test("an unused substitute is stored, marked as not having played, with no stats and no result", () => {
  const unused = (raw: RawFixture) => {
    raw.events = raw.events!.filter((event) => event.type_id !== SM_EVENT_TYPE.substitution);
  };
  const mcCowan = sportmonksRecordOf(sportmonksPlayerStats(oldFirm(SM_STATE.fullTime, unused)), SM.mcCowan);
  expect(mcCowan).toMatchObject({ started: false, played: false, stats: {} });
});

test("at full time the winners win, the losers lose, and the winning goal is the one that put Celtic ahead for good", () => {
  const records = sportmonksPlayerStats(oldFirm());
  const result = (player: number) => {
    const stats = recordOf(records, player);
    return [stats[WORKED_OUT.wins], stats[WORKED_OUT.draws], stats[WORKED_OUT.losses], stats[WORKED_OUT.winningGoal]];
  };
  expect(result(SM.kyogo)).toEqual([1, 0, 0, 1]);
  expect(result(SM.mcCowan)).toEqual([1, 0, 0, 0]);
  expect(result(SM.tavernier)).toEqual([0, 0, 1, 0]);
});

/** Goals at the minutes given, each "home-away" after it, scored by `scorer`. */
function goals(raw: RawFixture, list: { minute: number; extra?: number; result: string; scorer: number; type?: number }[]) {
  raw.events = [
    ...raw.events!.filter((event) => ![SM_EVENT_TYPE.goal, SM_EVENT_TYPE.penaltyGoal, SM_EVENT_TYPE.ownGoal].includes(event.type_id as 14)),
    ...list.map((goal, at) => ({ ...raw.events![1], id: 900 + at, type_id: goal.type ?? SM_EVENT_TYPE.goal, player_id: goal.scorer, minute: goal.minute, extra_minute: goal.extra ?? null, result: goal.result })),
  ];
  const [home, away] = list.at(-1)?.result.split("-").map(Number) ?? [0, 0];
  raw.scores = raw.scores!.map((score) => (score.description === "CURRENT" ? { ...score, score: { ...score.score, goals: score.score.participant === "home" ? home : away } } : score));
}

test("in a 3-1 that went 1-0, 2-0, 2-1, 3-1, the winning goal is the 1-0", () => {
  const read = oldFirm(SM_STATE.fullTime, (raw) =>
    goals(raw, [
      { minute: 10, result: "1-0", scorer: SM.schmeichel },
      { minute: 20, result: "2-0", scorer: SM.kyogo },
      { minute: 50, result: "2-1", scorer: SM.tavernier },
      { minute: 80, result: "3-1", scorer: SM.kyogo },
    ]),
  );
  const winner = sportmonksPlayerStats(read).filter((record) => record.stats[WORKED_OUT.winningGoal] === 1);
  expect(winner.map((record) => record.playerCode)).toEqual([SM.schmeichel]);
});

test("nobody has the winning goal when it was an own goal, or in a draw, where everyone who played draws", () => {
  const ownGoal = oldFirm(SM_STATE.fullTime, (raw) => goals(raw, [{ minute: 10, result: "1-0", scorer: SM.tavernier, type: SM_EVENT_TYPE.ownGoal }]));
  expect(sportmonksPlayerStats(ownGoal).map((record) => record.stats[WORKED_OUT.winningGoal])).toEqual([0, 0, 0, 0]);
  const draw = sportmonksPlayerStats(oldFirm(SM_STATE.fullTime, (raw) => goals(raw, [{ minute: 10, result: "1-0", scorer: SM.kyogo }, { minute: 50, result: "1-1", scorer: SM.tavernier }])));
  expect(draw.map((record) => [record.stats[WORKED_OUT.draws], record.stats[WORKED_OUT.winningGoal]])).toEqual([[1, 0], [1, 0], [1, 0], [1, 0]]);
});

test("before full time no result or winning goal is given", () => {
  const stats = recordOf(sportmonksPlayerStats(oldFirm(SM_STATE.secondHalf)), SM.kyogo);
  expect([WORKED_OUT.wins, WORKED_OUT.draws, WORKED_OUT.losses, WORKED_OUT.winningGoal].filter((stat) => stat in stats)).toEqual([]);
});

test("a goal at 44' counts against the half-time clean sheet and goals conceded; one at 46' does not", () => {
  const read = oldFirm(SM_STATE.fullTime, (raw) =>
    goals(raw, [
      { minute: 44, result: "0-1", scorer: SM.tavernier },
      { minute: 46, result: "1-1", scorer: SM.kyogo },
    ]),
  );
  const records = sportmonksPlayerStats(read);
  const halfTime = (player: number) => {
    const stats = recordOf(records, player);
    return [stats[WORKED_OUT.cleanSheetHalfTime], stats[WORKED_OUT.goalsConcededHalfTime]];
  };
  expect(halfTime(SM.schmeichel)).toEqual([0, 1]);
  expect(halfTime(SM.tavernier)).toEqual([1, 0]);
});

test("a goal in the first half's added time (45+1') is before half-time; the half-time stats are a starter's alone", () => {
  const records = sportmonksPlayerStats(oldFirm());
  expect(recordOf(records, SM.tavernier)).toMatchObject({ [WORKED_OUT.cleanSheetHalfTime]: 0, [WORKED_OUT.goalsConcededHalfTime]: 2 });
  expect(recordOf(records, SM.schmeichel)).toMatchObject({ [WORKED_OUT.cleanSheetHalfTime]: 1, [WORKED_OUT.goalsConcededHalfTime]: 0 });
  expect(WORKED_OUT.cleanSheetHalfTime in recordOf(records, SM.mcCowan)).toBe(false);
});

test("before half-time no half-time stats are given", () => {
  const stats = recordOf(sportmonksPlayerStats(oldFirm(SM_STATE.firstHalf)), SM.schmeichel);
  expect(WORKED_OUT.cleanSheetHalfTime in stats).toBe(false);
});

test("a match is complete at full time once every man who played has sent his stats", () => {
  expect(sportmonksPlayerStats(oldFirm(SM_STATE.fullTime, mcCowanSent)).map((record) => record.state)).toEqual(["complete", "complete", "complete", "complete"]);
  expect(sportmonksPlayerStats(oldFirm(SM_STATE.secondHalf, mcCowanSent))[0].state).toBe("provisional");
});

test("a starter missing from lineups.details keeps the match provisional, as does a sub who came on with none", () => {
  const noKeeper = oldFirm(SM_STATE.fullTime, (raw) => {
    mcCowanSent(raw);
    delete raw.lineups![0].details;
  });
  expect(sportmonksPlayerStats(noKeeper).map((record) => record.state)).toEqual(["provisional", "provisional", "provisional", "provisional"]);
  expect(sportmonksRecordOf(sportmonksPlayerStats(noKeeper), SM.schmeichel).arrived).toBe(false);
  expect(sportmonksPlayerStats(oldFirm())[0].state).toBe("provisional");
});

test("a man sent twice in one match is one man, the later row winning (S07.13)", () => {
  const twice = oldFirm(SM_STATE.fullTime, (raw) => {
    const kyogo = raw.lineups!.find((man) => man.player_id === SM.kyogo)!;
    raw.lineups!.push({ ...kyogo, details: [{ type_id: 119, data: { value: 70 } }] });
  });
  const records = sportmonksPlayerStats(twice);
  expect(records.map((record) => record.playerCode)).toEqual([SM.schmeichel, SM.kyogo, SM.mcCowan, SM.tavernier]);
  expect(recordOf(records, SM.kyogo).minutes).toBe(70);
});

/** The Old Firm's records at `stateId`, McCowan's stats sent, then each change made. */
const recordsWith = (stateId: number, change: (raw: RawFixture) => void = () => {}) =>
  sportmonksPlayerStats(oldFirm(stateId, (raw) => (mcCowanSent(raw), change(raw))));

/** Kyogo named in the lineups with no `lineups.details`. */
const kyogoUnsent = (raw: RawFixture) => delete raw.lineups!.find((man) => man.player_id === SM.kyogo)!.details;

test("a man who played with no row in a read keeps his last read, flagged as held, and the match stays provisional (S07.13)", () => {
  const last = recordsWith(SM_STATE.secondHalf);
  const noStats = recordsWith(SM_STATE.fullTime, kyogoUnsent);
  const kept = withLastRead(noStats, last);
  expect(sportmonksRecordOf(kept, SM.kyogo)).toMatchObject({ arrived: true, held: true, state: "provisional" });
  expect(recordOf(kept, SM.kyogo)).toMatchObject({ minutes: 67, goals_scored: 2, [WORKED_OUT.wins]: 1 });

  // Gone from the lineups altogether: his last read is kept whole, and the rest wait on him.
  const gone = recordsWith(SM_STATE.fullTime, (raw) => (raw.lineups = raw.lineups!.filter((man) => man.player_id !== SM.kyogo)));
  const held = withLastRead(gone, last);
  expect(held.map((record) => [record.playerCode, record.held ?? false, record.state])).toEqual([
    [SM.schmeichel, false, "provisional"],
    [SM.mcCowan, false, "provisional"],
    [SM.tavernier, false, "provisional"],
    [SM.kyogo, true, "provisional"],
  ]);
  expect(recordOf(held, SM.kyogo)).toEqual(recordOf(last, SM.kyogo));
});

test("a later read that fills a held man's row ends the hold; a man who never played or never sent anything has nothing to hold (S07.13)", () => {
  const last = recordsWith(SM_STATE.secondHalf);
  const kyogoHeld = withLastRead(recordsWith(SM_STATE.fullTime, kyogoUnsent), last);
  const filled = withLastRead(recordsWith(SM_STATE.fullTime), kyogoHeld);
  expect(filled.map((record) => [record.held ?? false, record.state])).toEqual(Array(4).fill([false, "complete"]));

  const unused = (raw: RawFixture) => (raw.events = raw.events!.filter((event) => event.type_id !== SM_EVENT_TYPE.substitution));
  const benched = recordsWith(SM_STATE.secondHalf, unused);
  const dropped = withLastRead(recordsWith(SM_STATE.fullTime, (raw) => (unused(raw), (raw.lineups = raw.lineups!.filter((man) => man.player_id !== SM.mcCowan)))), benched);
  expect(dropped.map((record) => record.playerCode)).toEqual([SM.schmeichel, SM.kyogo, SM.tavernier]);
  expect(dropped.every((record) => record.state === "complete")).toBe(true);

  const neverSent = sportmonksPlayerStats(oldFirm(SM_STATE.secondHalf));
  expect(sportmonksRecordOf(withLastRead(sportmonksPlayerStats(oldFirm()), neverSent), SM.mcCowan)).toMatchObject({ arrived: false, state: "provisional" });
  expect(sportmonksRecordOf(withLastRead(sportmonksPlayerStats(oldFirm()), neverSent), SM.mcCowan).held).toBeUndefined();
});

test("goals that don't come to the final score throw, naming the match", () => {
  const short = oldFirm(SM_STATE.fullTime, (raw) => {
    raw.events = raw.events!.filter((event) => event.id !== 504);
  });
  expect(() => sportmonksPlayerStats(short)).toThrow(`The goals Sportmonks sent for match ${SM.oldFirm} come to 2-0, its score to 2-1`);
});

test("the live tick stores each man's stats, and a match whose stats can't be worked out still has its score, failing on the row", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await sync(t);
  const read = sportmonksLiveRead();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(read)));
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});
  const held = await t.run((ctx) => ctx.db.query("sportmonksPlayerMatchStats").collect());
  expect(held.map(({ playerCode, played, state }) => [playerCode, played, state])).toEqual([
    [SM.schmeichel, true, "provisional"],
    [SM.kyogo, true, "provisional"],
    [SM.mcCowan, true, "provisional"],
    [SM.tavernier, true, "provisional"],
  ]);

  // A newer read replaces the match's records whole: a man it no longer names who never played
  // loses his row; one who played keeps his last read, held (S07.13).
  const records = held.map(({ _id, _creationTime, ...record }) => ({ ...record, played: record.playerCode !== SM.mcCowan }));
  await t.mutation(internal.football.sportmonks.sportmonksLive.writePlayerStats, { fixtureCode: SM.oldFirm, records });
  const named = records.filter((record) => record.playerCode !== SM.tavernier && record.playerCode !== SM.mcCowan);
  await t.mutation(internal.football.sportmonks.sportmonksLive.writePlayerStats, { fixtureCode: SM.oldFirm, records: named });
  const rewritten = await t.run((ctx) => ctx.db.query("sportmonksPlayerMatchStats").collect());
  expect(rewritten.map(({ playerCode, held }) => [playerCode, held ?? false])).toEqual([
    [SM.schmeichel, false],
    [SM.kyogo, false],
    [SM.tavernier, true],
  ]);

  const bad = sportmonksLiveRead();
  bad.data[0].events!.find((event) => event.id === 504)!.result = null;
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(bad)));
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});
  const [, row] = await ticks(t);
  expect(row.outcome).toEqual({
    ok: true,
    matches: [{ fixtureCode: SM.oldFirm, ok: false, error: `players' stats: Sportmonks sent goal 504 in match ${SM.oldFirm} with result null` }],
  });
});
