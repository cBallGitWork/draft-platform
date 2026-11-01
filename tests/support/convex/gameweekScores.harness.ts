// The table's scores' shared setup (#29): a two-team league begun in gameweek 6, Ann fielding
// Hull and Bob Everton from the recorded Hull v Everton, the points each side makes, and the
// changes to a team's lineup or squad the tests make. How the match's records land is in
// gameweekScoresMatch.harness.ts; the site's scoring-set fixes in gameweekScoresFixes.harness.ts.

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { positionOfSlot, type Cell } from "../../../convex/lineup/pitch";
import type { MatchupSide, MatchupSlot } from "../../../convex/matchup/matchupShape";
import type { Position } from "../../../convex/positions/positionTables";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { firstLineup } from "../../../convex/lineup/firstLineup";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { inTenths } from "../../../convex/scoring/values";
import type { PlayerMatchRecord } from "../../../convex/stats/matchRecords";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { LEAGUE_AVERAGE } from "../../../convex/table/roundRobin";
import { squadGameweek, workedOutGameweek } from "../../../convex/gameweekScorer/gameweekScores";
import type { PlayerRows } from "../../../convex/gameweekScorer/squadInputs";
import { leagueReads } from "../../../convex/gameweekScorer/teamGameweek";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { actingAs, addManagers, adminCreatesLeague, MANAGERS, type TestConvex } from "./leagues.harness";
import { EVERTON, EVERTON_CLUB, GAMEWEEK, HULL, HULL_CITY, HULL_EVERTON } from "./matchStats.harness";
import { insertClubs } from "./footballRows.harness";
import { BELLOUMI, DEWSBURY_HALL, GELHARDT, PHILLIPS, TZOLAKIS } from "./teamPoints.harness";
import { fakeResend, signInDeployment } from "./signIn.harness";
import { recordedGw6 } from "../recorded/gw6.payloads";

export { GAMEWEEK };
export const [ANN, BOB, CAT] = MANAGERS;
/** Ann's and Bob's teams, as the league names a new team (convex/leagues/teams.ts). */
export const ANNS_TEAM = "Team 1";
export const BOBS_TEAM = "Team 2";

/** Hull v Everton's kickoff as this league replays it, not FPL's recorded KICKOFF in
 *  matchStats.harness: a week after signInDeployment's clock, so the league is made before
 *  gameweek 6 begins (a document can't be made earlier than the deployment's first). The records
 *  don't hang on it. */
export const LEAGUE_KICKOFF = Date.parse("2026-10-27T15:00:00Z");
export const LEAGUE_FULL_TIME_READ = LEAGUE_KICKOFF + 2 * HOUR_MS;
/** The league's deadline for gameweek 6: the first rules', before Hull v Everton's kickoff. */
export const DEADLINE = LEAGUE_KICKOFF - FIRST_RULES.deadline.minutesBeforeFirstKickoff * MINUTE_MS;

/** Who stands where. Hull's unused substitute keeper starts in goal, so their keeper, who played
 *  the 90 minutes, comes on for him once the match is over. */
export { PHILLIPS };
export const HULL_KEEPER = TZOLAKIS; // played 90
export const HULL_SCORER = GELHARDT; // Hull's midfielder, a goal at 64 minutes
/** Hull's one starter in attack, and the one forward on their bench. */
export const HULL_STRIKER = 169432;
export const HULL_BENCH_STRIKER = 631000;
const cell = (area: Cell["area"], lane: Cell["lane"]): Cell => ({ area, lane });
/** A starter and the cell he stands in, as a stored lineup holds him. */
type Starter = Cell & { playerCode: number };
export const HULL_STARTERS: Starter[] = [
  { playerCode: PHILLIPS, ...cell("goalkeeper", "centre") },
  { playerCode: 606930, ...cell("defence", "left") },
  { playerCode: 193278, ...cell("defence", "leftCentre") },
  { playerCode: 108416, ...cell("defence", "centre") },
  { playerCode: 232351, ...cell("defence", "rightCentre") },
  { playerCode: 146426, ...cell("defence", "right") },
  { playerCode: 243951, ...cell("midfield", "left") },
  { playerCode: 243413, ...cell("midfield", "leftCentre") },
  { playerCode: HULL_SCORER, ...cell("midfield", "rightCentre") },
  { playerCode: 101282, ...cell("midfield", "right") },
  { playerCode: HULL_STRIKER, ...cell("attack", "centre") },
];
/** Their keeper first, then Belloumi (on at 64, a goal), then the rest of Hull's bench. */
export const HULL_BENCH = [HULL_KEEPER, BELLOUMI, 496181, 608227, 445028, 160817, HULL_BENCH_STRIKER, 597462, 490094];

export const EVERTON_STARTERS: Starter[] = [
  { playerCode: 111234, ...cell("goalkeeper", "centre") },
  { playerCode: 17761, ...cell("defence", "left") },
  { playerCode: 480455, ...cell("defence", "leftCentre") },
  { playerCode: 106611, ...cell("defence", "rightCentre") },
  { playerCode: 154043, ...cell("defence", "right") },
  { playerCode: 609873, ...cell("midfield", "left") },
  { playerCode: 232928, ...cell("midfield", "leftCentre") },
  { playerCode: 242898, ...cell("midfield", "centre") },
  { playerCode: DEWSBURY_HALL, ...cell("midfield", "rightCentre") },
  { playerCode: 114283, ...cell("midfield", "right") },
  { playerCode: 586309, ...cell("attack", "centre") },
];
export const EVERTON_BENCH = [502697, 496661, 244860, 629068, 229600, 550615, 513466, 512462, 128295];

/** Each bench player's position, by where FPL lists him: keeper, defender, midfielder, forward;
 *  a starter plays his cell's slot (positionOfSlot). */
const playing = (position: Position, codes: number[]) => codes.map((code) => [code, position] as const);
const BENCH_POSITION = new Map<number, Position>([
  ...playing("GK", [HULL_KEEPER, 229600]),
  ...playing("CB", [496181, 160817, 597462, 512462]),
  ...playing("CM", [BELLOUMI, 608227, 445028, 490094, 502697, 496661, 244860, 629068, 550615, 513466, 128295]),
  ...playing("ST", [HULL_BENCH_STRIKER]),
]);

export interface ScoresLeague {
  t: TestConvex;
  leagueId: Id<"leagues">;
  annsTeam: Id<"teams">;
  bobsTeam: Id<"teams">;
  /** Cat's, with no squad or lineup, when the league has a third team. */
  catsTeam?: Id<"teams">;
}

/** A league made before gameweek 6 began, Ann's and Bob's teams playing each other in it, both
 *  squads held and Ann's lineup saved; Bob's too, unless `bobSaves` is false, when he holds the
 *  first lineup his squad's assignments stored (lineups.ts, #637), picked in the order each squad
 *  is listed here, starters then bench. With `catToo`, a third team, Cat's, with no squad and so
 *  nobody in its lineup, plays the league's average. */
export async function scoresLeague({ bobSaves = true, catToo = false } = {}): Promise<ScoresLeague> {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t);
  const [annsTeam, bobsTeam, catsTeam] = await addManagers(t, leagueId, catToo ? [ANN, BOB, CAT] : [ANN, BOB]);
  const elements = new Map(recordedGw6().fpl.bootstrap.elements.map((element) => [element.code, element]));
  await t.run(async (ctx) => {
    await ctx.db.insert("fixtures", { code: HULL_EVERTON, gameweek: GAMEWEEK, homeClubCode: HULL, awayClubCode: EVERTON, kickoff: LEAGUE_KICKOFF });
    const squads: [Id<"teams">, number, Starter[], number[]][] = [
      [annsTeam, HULL, HULL_STARTERS, HULL_BENCH],
      [bobsTeam, EVERTON, EVERTON_STARTERS, EVERTON_BENCH],
    ];
    for (const [teamId, clubCode, starters, bench] of squads) {
      const positionOf = new Map<number, Position>([
        ...starters.map(({ playerCode, area, lane }) => [playerCode, positionOfSlot({ area, lane })] as const),
        ...bench.map((code) => [code, BENCH_POSITION.get(code)!] as const),
      ]);
      for (const [code, position] of positionOf) {
        const name = elements.get(code)!.web_name;
        await ctx.db.insert("players", { code, name, fullName: name, clubCode });
        await ctx.db.insert("playerPositions", { code, starts: [], approved: [], set: [position], removed: [] });
        await ctx.db.insert("squadPlayers", { leagueId, teamId, playerCode: code });
      }
      const saves = teamId === annsTeam || bobSaves;
      const first = () => firstLineup([...positionOf.keys()], new Map([...positionOf].map(([code, position]) => [code, [position]])), FIRST_RULES);
      const lineup = saves ? { starters, bench } : { ...first(), firstLineup: true as const };
      await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek: GAMEWEEK, ...lineup });
    }
    // Gameweek 6 begun, as the football sync records it (deadlineRecorder.ts, playedFixtures.ts).
    await ctx.db.insert("passedDeadlines", { leagueId, gameweek: GAMEWEEK, deadline: DEADLINE, recordedAt: DEADLINE });
    await ctx.db.insert("playedFixtures", {
      leagueId,
      gameweek: GAMEWEEK,
      fixtures: [
        { team: annsTeam, opponent: bobsTeam },
        ...(catsTeam === undefined ? [] : [{ team: catsTeam, opponent: LEAGUE_AVERAGE as typeof LEAGUE_AVERAGE }]),
      ],
      byes: [],
      storedAt: DEADLINE,
    });
  });
  return { t, leagueId, annsTeam, bobsTeam, catsTeam };
}

/** Hull's and Everton's club rows, which scoresLeague doesn't hold, as the football sync holds them. */
export const holdHullAndEverton = ({ t }: ScoresLeague) => t.run((ctx) => insertClubs(ctx, [HULL_CITY, EVERTON_CLUB]));

export const readTable = ({ t, leagueId }: ScoresLeague) => actingAs(t, ANN).then((ann) => ann.query(api.table.leagueTable.ofLeague, { leagueId }));

/** The matchup `email` reads: their own team's in the current gameweek, unless `args` names others. */
export async function matchupAs({ t, leagueId }: ScoresLeague, email: string, args: { teamId?: Id<"teams">; gameweek?: number } = {}) {
  return (await actingAs(t, email)).query(api.matchup.matchup.ofTeam, { leagueId, now: Date.now(), ...args });
}

/** The scored game Ann's matchup shows: in `gameweek`, or the current one when none is named. */
export async function annsScoredGame(league: ScoresLeague, gameweek?: number) {
  const read = await matchupAs(league, ANN, gameweek === undefined ? {} : { gameweek });
  if (read?.kind !== "headToHead" || read.game.kind !== "scored") throw new Error(`Ann's matchup isn't scored: ${JSON.stringify(read)}`);
  return read.game;
}

/** A player's name, as the football sync holds it. */
export const nameOf = ({ t }: ScoresLeague, code: number) =>
  t.run(async (ctx) => (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique())!.name);

/** The football sync loses `code`'s player row (#810), any match records of his still held. */
export const losePlayer = ({ t }: ScoresLeague, code: number) =>
  t.run(async (ctx) => {
    const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique())!;
    await ctx.db.delete("players", player._id);
  });

/** A side's lineup on the matchup: a team's, never the league's average. */
export const lineupOf = (side: MatchupSide) => {
  if (side.kind !== "team" || side.lineup === null) throw new Error(`The side has no lineup: ${JSON.stringify(side)}`);
  return side.lineup;
};
/** One man's slot in a side's lineup, starter or bench. */
export const slotOf = (side: MatchupSide, playerCode: number): MatchupSlot =>
  [...lineupOf(side).starters, ...lineupOf(side).bench].find((slot) => slot.playerCode === playerCode)!;

/** A side's points worked out here, player by player, from the records: those who count, each at
 *  the cell he counts in. */
export function sideTotal(records: readonly PlayerMatchRecord[], counting: readonly Starter[]): number {
  const byCode = new Map(records.map((record) => [record.playerCode, record]));
  const points = counting.map(({ playerCode, area, lane }) => scoreMatch(byCode.get(playerCode)!.stats, FIRST_SCORING, { area, lane }).total!);
  return inTenths(points.reduce((sum, each) => sum + each, 0));
}

/** Hull's points once the match is over, their keeper on for Phillips, and Everton's: each the sum
 *  of its eleven's FPL lines in golden/hull-everton.scores.json, area by area. Pinned as well as
 *  worked out player by player (gameweekScores.test.ts), so a change in how a match scores shows. */
export const HULL_POINTS = 26;
export const EVERTON_POINTS = 38;
/** Everton's fifth midfielder, listed fifth of them: the 4-4-2 and the 5-4-1 have room for four. */
export const GREALISH = 114283;
/** Everton's centre back on the bench, the fifth defender his squad holds. */
export const EVERTON_BENCH_CENTRE_BACK = 512462;
/** Bob's points on his first lineup (#637, #836): his squad holds no second striker, so a 4-4-2
 *  leaves a slot empty, and the first preset it fills is the 4-3-3 (presets.ts's order), its wide
 *  men in the wide attacking-midfield slots a WM plays too (Craig, 1 Nov 2026; #1025). That is
 *  Everton's eleven, Grealish among them, and the bench centre back stays on the bench: Everton's 38
 *  (golden/hull-everton.scores.json); no auto-sub, as every starter played. */
export const BOBS_FIRST_POINTS = EVERTON_POINTS;

/** Hull's side once the match is over: their keeper in goal for Phillips. */
export const HULL_AFTER_SUB: Starter[] = HULL_STARTERS.map((starter) =>
  starter.playerCode === PHILLIPS ? { ...starter, playerCode: HULL_KEEPER } : starter,
);

/** Ann's saved lineup gives her starter `playerCode` the role `role`, as Tactics saves it. */
export const giveAnnsStarterRole = ({ t, annsTeam }: ScoresLeague, playerCode: number, role: string) =>
  t.run(async (ctx) => {
    const lineup = (await ctx.db.query("lineups").collect()).find((each) => each.teamId === annsTeam)!;
    const starters = lineup.starters.map((starter) => (starter.playerCode === playerCode ? { ...starter, role } : starter));
    await ctx.db.patch("lineups", lineup._id, { starters });
  });

/** `playerCode` leaves Ann's squad after her lineup was saved, which still names him (#597). */
export const leavesAnnsSquad = ({ t, leagueId }: ScoresLeague, playerCode: number) =>
  t.run(async (ctx) => {
    const owned = (await ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
      .unique())!;
    await ctx.db.delete("squadPlayers", owned._id);
  });

/** Ann's gameweek slot by slot two ways: from reads the size of her squad, as a player's card and
 *  the Squad tab read it (`squad`, #577), and from every match's, as the league's scorer does
 *  (`every`). */
export function annsSquadAndEvery({ t, leagueId, annsTeam }: ScoresLeague, gameweek = GAMEWEEK) {
  return t.run(async (ctx) => {
    const held = (await ctx.db.get("leagues", leagueId))!;
    const reads = await leagueReads(ctx, held, (await seasonRules(ctx, leagueId))!);
    const rowsOf = async (playerCode: number): Promise<PlayerRows> => {
      const records = await ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)).collect();
      const overrides = await ctx.db
        .query("pointsOverrides")
        .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
        .collect();
      return { records: new Map(records.map((row) => [row.fixtureCode, row])), overrides: new Map(overrides.map((row) => [row.fixtureCode, row.points])) };
    };
    const ofSquad = await squadGameweek(ctx, reads, gameweek, annsTeam, rowsOf);
    const ofEvery = await workedOutGameweek(ctx, reads, gameweek, [annsTeam]);
    return { squad: (await ofSquad.slotsOf(annsTeam)).team, every: (await ofEvery.slotsOf(annsTeam)).team };
  });
}
