// The mini beta's end-to-end setup (#36): a league of four, its players assigned rather than
// drafted, playing gameweek 6 as recorded, every step through the entry points the app and the
// crons call. Nothing here writes a table by hand.
//
// The world it plays in is the recorded gameweek 6, cut so it can finish: the only match both feeds
// recorded whole is Hull v Everton, and a gameweek is final only once every match held in it has
// locked, so FPL's fixture list is cut to that one match. Its 40 men fill most of four squads; four
// players from FPL's earlier recording (19 Oct 2026, the same season, so their ids agree) fill the
// rest, and that recording's clubs, which the gameweek 6 cut left out, give every player his club.
// Their clubs have no match held, so they blank. The clock starts the week before, so the league is
// made before gameweek 6 begins.

import { vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { positionOfSlot, type Cell } from "../../../convex/lineup/pitch";
import { RESEND_EMAILS_URL } from "../../../convex/outbound/email";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { MINUTE_MS } from "../../../convex/shared/time";
import { recordedFpl } from "../recorded/fpl.payloads";
import { FULL_STATS, MATCH, type Gw6Payloads } from "../recorded/gw6.payloads";
import { EVERTON_STARTERS, HULL_AFTER_SUB } from "./gameweekScores.harness";
import { actingAs, addManagers, adminCreatesLeague, ADMIN, COMMISSIONER, MANAGERS } from "./leagues.harness";
import { fakeFeeds, KICKOFF } from "./matchStats.harness";
import { RESEND_ACCEPTED, signInDeployment } from "./signIn.harness";
import type { TestConvex } from "./test.harness";

/** The league's four managers. */
const FOUR = MANAGERS.slice(0, 4);
export const [ANN, BOB, CAT, DAN] = FOUR;

/** The week before gameweek 6: the league is made, its squads assigned and its lineups saved. */
const SETUP_MORNING = Date.parse("2026-10-05T09:00:00Z");
/** The league's deadline for gameweek 6 under the first rules: before Hull v Everton, its one match. */
export const DEADLINE = KICKOFF - FIRST_RULES.deadline.minutesBeforeFirstKickoff * MINUTE_MS;

/** A starter and the cell he stands in, as a lineup is saved. */
type Starter = Cell & { playerCode: number };
const at = (playerCode: number, area: Cell["area"], lane: Cell["lane"]): Starter => ({ playerCode, area, lane });

/** From FPL's earlier recording: Arsenal's Saliba, Saka and Ødegaard, and Man City's Haaland. */
const SALIBA = 462424;
const SAKA = 223340;
const ODEGAARD = 184029;
const HAALAND = 223094;
const LENT = [SALIBA, SAKA, ODEGAARD, HAALAND];

/** Each manager's eleven, assigned whole: no bench, so no auto-sub moves a score. Ann fields
 *  Hull's starting eleven and Bob Everton's, in the cells golden/hull-everton.scores.json prices
 *  them at; Cat Hull's substitutes and Dan Everton's, each with two lent men to make eleven. */
export const ELEVENS: Record<string, Starter[]> = {
  [ANN]: HULL_AFTER_SUB,
  [BOB]: EVERTON_STARTERS,
  [CAT]: [
    at(FULL_STATS.phillips.code, "goalkeeper", "centre"), // unused
    at(496181, "defence", "leftCentre"),
    at(160817, "defence", "centre"),
    at(597462, "defence", "rightCentre"),
    at(SALIBA, "defence", "right"),
    at(FULL_STATS.belloumi.code, "midfield", "left"), // on at 64 minutes
    at(608227, "midfield", "leftCentre"),
    at(445028, "midfield", "centre"),
    at(490094, "midfield", "rightCentre"),
    at(631000, "attack", "leftCentre"),
    at(HAALAND, "attack", "rightCentre"),
  ],
  [DAN]: [
    at(229600, "goalkeeper", "centre"),
    at(512462, "defence", "centre"),
    at(513466, "defensiveMidfield", "leftCentre"),
    at(128295, "defensiveMidfield", "rightCentre"),
    at(502697, "midfield", "left"),
    at(496661, "midfield", "leftCentre"),
    at(244860, "midfield", "centre"),
    at(629068, "midfield", "rightCentre"),
    at(550615, "midfield", "right"),
    at(SAKA, "attackingMidfield", "leftCentre"),
    at(ODEGAARD, "attackingMidfield", "rightCentre"),
  ],
};

/** `payloads` as the league's world: FPL's clubs and the lent players added, its fixtures cut to
 *  Hull v Everton, and, `beforeKickoff`, that match as FPL lists one not yet started. */
export function leagueWorld(payloads: Gw6Payloads, { beforeKickoff = false } = {}): Gw6Payloads {
  const earlier = recordedFpl().bootstrap;
  Object.assign(payloads.fpl.bootstrap, { teams: earlier.teams });
  payloads.fpl.bootstrap.elements.push(...earlier.elements.filter((element) => LENT.includes(element.code)));
  payloads.fpl.fixtures = payloads.fpl.fixtures.filter((fixture) => fixture.code === MATCH.hullEverton.code);
  if (beforeKickoff) {
    for (const fixture of payloads.fpl.fixtures) {
      Object.assign(fixture, { started: false, finished: false, finished_provisional: false, minutes: 0, team_h_score: null, team_a_score: null });
    }
  }
  return payloads;
}

/** Every feed's read from `payloads`, and Resend taking every email the league sends. */
function worldFetch(payloads: Gw6Payloads) {
  const feeds = fakeFeeds(payloads);
  return vi.fn(async (url: string) => (url === RESEND_EMAILS_URL ? Response.json(RESEND_ACCEPTED) : feeds(url)));
}

/** The football sync at `time`, reading `payloads`, as its cron runs it. */
export async function footballSyncAt(t: TestConvex, time: number, payloads: Gw6Payloads) {
  vi.setSystemTime(time);
  vi.stubGlobal("fetch", worldFetch(payloads));
  await t.action(internal.football.footballSync.run, { trigger: "cron" });
  const [latest] = await t.query(internal.football.footballSync.latest, {});
  return latest;
}

/** The live tick at `time`, reading `payloads`, as its cron runs it. */
export async function liveTickAt(t: TestConvex, time: number, payloads: Gw6Payloads) {
  vi.setSystemTime(time);
  vi.stubGlobal("fetch", worldFetch(payloads));
  await t.action(internal.stats.liveStatsSync.tick, {});
  const [latest] = await t.query(internal.stats.liveStats.latest, {});
  return latest;
}

export interface MiniBeta {
  t: TestConvex;
  leagueId: Id<"leagues">;
  /** Each manager's team, by email. */
  teams: Map<string, Id<"teams">>;
  /** The gameweek each manager's save was from, in ELEVENS' order. */
  savedFrom: number[];
}

/** The week before gameweek 6, `payloads` read by the football sync: the admin makes a league of
 *  four, adds the four managers and gives each starter the position of his cell; the commissioner
 *  assigns each manager his eleven; and each manager saves his lineup. */
export async function miniBetaLeague(payloads: Gw6Payloads): Promise<MiniBeta> {
  const t = await signInDeployment(SETUP_MORNING);
  const synced = await footballSyncAt(t, SETUP_MORNING, payloads);
  if (!synced.outcome.ok) throw new Error(`the football sync failed: ${synced.outcome.error}`);
  const leagueId = await adminCreatesLeague(t);
  const teamIds = await addManagers(t, leagueId, FOUR);
  const teams = new Map(FOUR.map((email, index) => [email, teamIds[index]]));
  const admin = await actingAs(t, ADMIN);
  const commissioner = await actingAs(t, COMMISSIONER);
  for (const [email, eleven] of Object.entries(ELEVENS)) {
    const teamId = teams.get(email)!;
    for (const starter of eleven) {
      await admin.mutation(api.positions.playerPositions.setPosition, { code: starter.playerCode, position: positionOfSlot(starter) });
      await commissioner.mutation(api.squads.squads.assign, { leagueId, playerCode: starter.playerCode, teamId });
    }
  }
  const savedFrom = [];
  for (const [email, starters] of Object.entries(ELEVENS)) {
    savedFrom.push(await (await actingAs(t, email)).mutation(api.lineup.lineups.save, { leagueId, lineup: { starters, bench: [] } }));
  }
  return { t, leagueId, teams, savedFrom };
}

/** The league's table, as Ann's screen reads it. */
export const tableOf = ({ t, leagueId }: MiniBeta) => actingAs(t, ANN).then((ann) => ann.query(api.table.leagueTable.ofLeague, { leagueId }));
