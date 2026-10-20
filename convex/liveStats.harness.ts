// The live poller's tests' shared setup: Hull v Everton, recorded finished, replayed as if live.
// No live match has been recorded yet, so each stage is cut from the finished one: a man's every
// stat grows with his share of his minutes on the pitch, and his goals, assists and yellow cards
// land at the minutes the fixture's events give them. The last stage is the recording itself, at
// full time. Friday's recording (#37, fixture 128999) is to replace it: docs/pl-match-stats.md.
// For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import type { Infer } from "convex/values";
import { vi } from "vitest";
import { internal } from "./_generated/api";
import { codesByOpta, namedMen } from "./feedIds";
import { fakeFeeds, heldMatch, KICKOFF, mergedHullEverton } from "./matchStats.harness";
import type { RawPlFixture } from "./premierLeague";
import { MATCH, recordedGw6, type Gw6Payloads } from "./recorded/gw6.payloads";
import type { matchStatsState } from "./schema";
import type { TestConvex } from "./test.harness";
import { MINUTE_MS } from "./time";

/** A match in play's `status`: a guess until a live match is recorded; anything but full time reads the same. */
const IN_PLAY = "L";
const SECS_PER_MINUTE = MINUTE_MS / 1000;
/** Opta's per-man flags, sent from kickoff; and those sent once he is on. */
const FROM_KICKOFF = new Set(["formation_place", "game_started"]);
const ONCE_ON = new Set(["appearances", "total_sub_on"]);

/** One of the fixture's events, as the recording holds them (the read's `events`, not typed in `premierLeague.ts`). */
interface RecordedEvent {
  type: string;
  description?: string;
  phase: string;
  personId?: number;
  assistId?: number;
  clock: { secs: number };
}

/** Each event-timed stat under both feeds' names, and whose event it is. */
const EVENT_STATS: { fpl: string; pl: string; counts: (event: RecordedEvent, man: number) => boolean }[] = [
  { fpl: "goals_scored", pl: "goals", counts: (event, man) => event.type === "G" && event.personId === man },
  { fpl: "assists", pl: "goal_assist", counts: (event, man) => event.type === "G" && event.assistId === man },
  { fpl: "yellow_cards", pl: "yellow_card", counts: (event, man) => event.type === "B" && event.description === "Y" && event.personId === man },
];

const hullEverton = (payloads: Gw6Payloads) => payloads.pl.fixtures.find((each) => each.id === MATCH.hullEverton.pl)!;

/** Hull v Everton's events, and the seconds of play before each: the second half's clock restarts
 *  at 45 minutes, whatever the first ran to. */
function matchEvents(payloads: Gw6Payloads) {
  const events = (hullEverton(payloads) as RawPlFixture & { events: RecordedEvent[] }).events;
  const halfEnd = (phase: string) => events.find((event) => event.type === "PE" && event.phase === phase)!;
  const secondHalfStart = events.find((event) => event.type === "PS" && event.phase === "2")!.clock.secs;
  const secsOf = (event: RecordedEvent) =>
    event.phase === "1" ? event.clock.secs : halfEnd("1").clock.secs + event.clock.secs - secondHalfStart;
  return { events, secsOf, endSecs: secsOf(halfEnd("2")) };
}

/** The match's playing minutes, both halves' stoppage time in: its last stage before full time. */
export const REPLAY_MINUTES = Math.ceil(matchEvents(recordedGw6()).endSecs / SECS_PER_MINUTE);

/** How one man stands some minutes into play: his share of his minutes on the pitch, and a stat's value then. */
interface ManAt {
  share: number;
  value: (stat: string, final: number) => number;
}

/** Each named man, by the Premier League's id, as he stands `minute` minutes into play. */
function menAt(payloads: Gw6Payloads, minute: number): Map<number, ManAt> {
  const { events, secsOf, endSecs } = matchEvents(payloads);
  const now = minute * SECS_PER_MINUTE;
  const starters = new Set(hullEverton(payloads).teamLists!.flatMap((list) => list!.lineup.map((man) => man.id)));
  const men = new Map<number, ManAt>();
  for (const { id } of namedMen(hullEverton(payloads))) {
    const substitution = (description: string) =>
      events.find((event) => event.type === "S" && event.description === description && event.personId === id);
    const cameOn = substitution("ON");
    const wentOff = substitution("OFF");
    const on = starters.has(id) ? 0 : cameOn === undefined ? undefined : secsOf(cameOn);
    const off = wentOff === undefined ? endSecs : secsOf(wentOff);
    const share = on === undefined ? 0 : Math.min(1, Math.max(0, (now - on) / (off - on)));
    const value = (stat: string, final: number) => {
      const timed = EVENT_STATS.find((each) => each.fpl === stat || each.pl === stat);
      if (timed === undefined) return Math.floor(final * share);
      return Math.min(final, events.filter((event) => timed.counts(event, id) && secsOf(event) <= now).length);
    };
    men.set(id, { share, value });
  }
  return men;
}

/** Gameweek 6 as both feeds would send it `minute` minutes into Hull v Everton's play. */
export function stagedGw6(minute: number): Gw6Payloads {
  const payloads = recordedGw6();
  const men = menAt(payloads, minute);
  for (const fixture of [...payloads.pl.round.content, ...payloads.pl.fixtures]) {
    if (fixture.id === MATCH.hullEverton.pl) fixture.status = IN_PLAY;
  }
  for (const { fixture, player, payload } of payloads.pl.playerStats) {
    const man = men.get(player);
    if (fixture !== MATCH.hullEverton.pl || man === undefined) continue;
    payload.stats = payload.stats
      .map((metric) => {
        if (FROM_KICKOFF.has(metric.name)) return metric;
        if (ONCE_ON.has(metric.name)) return { ...metric, value: man.share > 0 ? metric.value : 0 };
        return { ...metric, value: man.value(metric.name, metric.value) };
      })
      .filter((metric) => FROM_KICKOFF.has(metric.name) || metric.value !== 0);
  }
  const codeByOpta = codesByOpta(payloads.fpl.bootstrap.elements);
  const plIdByCode = new Map(namedMen(hullEverton(payloads)).map((man) => [codeByOpta.get(man.altIds!.opta)!, man.id]));
  const plIdByFplId = new Map(payloads.fpl.bootstrap.elements.map((each) => [each.id, plIdByCode.get(each.code)]));
  for (const element of payloads.fpl.live.elements) {
    const plId = plIdByFplId.get(element.id);
    const man = plId === undefined ? undefined : men.get(plId);
    if (man === undefined) continue;
    for (const [stat, final] of Object.entries(element.stats)) element.stats[stat] = stagedTotal(man, stat, final);
    for (const block of element.explain) {
      block.stats = block.stats
        .map((stat) => ({ ...stat, value: man.value(stat.identifier, stat.value) }))
        .filter((stat) => stat.identifier === "minutes" || stat.value !== 0);
    }
  }
  return payloads;
}

/** A gameweek total as it stands: a count grows, a decimal string ("0.62") too, and a flag is set once he is on. */
function stagedTotal(man: ManAt, stat: string, final: number | string | boolean): number | string | boolean {
  if (typeof final === "boolean") return final && man.share > 0;
  if (typeof final === "number") return man.value(stat, final);
  const decimals = final.split(".")[1]?.length ?? 0;
  return (Number(final) * man.share).toFixed(decimals);
}

/** When the tick for a stage runs: a minute of play a minute of the clock, half-time left out. */
export const stageTime = (minute: number) => KICKOFF + minute * MINUTE_MS;

/** One tick at `time` against `payloads`, its fake fetch, and the newest tick row then. */
export async function tickAt(t: TestConvex, time: number, payloads: Gw6Payloads, refuse?: string) {
  vi.setSystemTime(time);
  const fetch = fakeFeeds(payloads, refuse);
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.liveStatsSync.tick, {});
  const [latest] = await t.query(internal.liveStats.latestTicks, {});
  return { fetch, latest };
}

/** Hull v Everton's held records by player code, without Convex's own fields. */
export async function heldRecords(t: TestConvex) {
  const { records } = await heldMatch(t);
  return new Map([...records].map(([code, { _id, _creationTime, ...record }]) => [code, record]));
}

/** Hull v Everton's records as the merge gives them from `payloads`, held in `state`. */
export function recordsIn(payloads: Gw6Payloads, state: Infer<typeof matchStatsState>) {
  return new Map(mergedHullEverton(payloads).map((record) => [record.playerCode, { ...record, state }]));
}
