import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { SCOUT_TRIP_MS } from "../../../convex/scouting/scouts";
import { JULY, seasonStartYear } from "../../../convex/shared/time";
import { STARS_READ_MOST, starsReadRefusals } from "../../../convex/stars/playerStars";
import { NO_DATA, UNSURE, type Stars } from "../../../convex/stars/starsShape";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeClaude } from "../../support/convex/scouts.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { elapse, expectRefused } from "../../support/convex/test.harness";
import { BLANK, NEWCOMER, SCORER, STEADY, UNUSED, holdStarsPlayers, refreshEveryone } from "../../support/convex/stars.harness";

// Players' stars as a screen reads them (#11, playerStars.ts): one player's, or many at once; and,
// now scouts exist, only for the manager's own squad, those his team held this season, and those
// his scouts reported on this season (spec/19, Role stars; #375).

const [ANN, BOB] = MANAGERS;
const STRIKER_ROLES = DEFAULT_ROLES.ST.map((role) => role.key);
const everyStrikerRole = (stars: Stars) => STRIKER_ROLES.map((role) => ({ area: "attack", role, stars }));

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  fakeClaude();
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = (await addManagers(t, leagueId, [ANN, BOB])) as [Id<"teams">];
  await holdStarsPlayers(t);
  await refreshEveryone(t);
});

const inAnnsSquad = (...codes: number[]) =>
  t.run(async (ctx) => {
    for (const playerCode of codes) await ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode });
  });
const ofPlayer = async (playerCode: number, email = ANN) =>
  (await actingAs(t, email)).query(api.stars.playerStars.ofPlayer, { leagueId, playerCode, now: Date.now() });
const ofPlayers = async (playerCodes: number[]) =>
  (await actingAs(t, ANN)).query(api.stars.playerStars.ofPlayers, { leagueId, playerCodes, now: Date.now() });

describe("a player shown", () => {
  beforeEach(() => inAnnsSquad(SCORER.code, NEWCOMER.code, UNUSED.code, STEADY.code));

  test("a player's stars for each role in each area he plays", async () => {
    expect(await ofPlayer(SCORER.code)).toEqual(everyStrikerRole(5));
    expect(await ofPlayer(NEWCOMER.code)).toEqual(everyStrikerRole(UNSURE));
  });

  test("one with no counted match shows “—” for every role his positions play", async () => {
    expect(await ofPlayer(UNUSED.code)).toEqual(everyStrikerRole(NO_DATA));
  });

  test("many players at once, in the order asked", async () => {
    expect(await ofPlayers([STEADY.code, SCORER.code])).toEqual([
      { playerCode: STEADY.code, stars: everyStrikerRole(3.5) },
      { playerCode: SCORER.code, stars: everyStrikerRole(5) },
    ]);
  });
});

test(`more than ${STARS_READ_MOST} at once is refused, never cut short`, async () => {
  const tooMany = Array.from({ length: STARS_READ_MOST + 1 }, (_, index) => 5000 + index);
  await expectRefused(ofPlayers(tooMany), starsReadRefusals.tooMany);
});

describe("who is shown whose stars (spec/19, Role stars)", () => {
  test("hidden for a player neither in his squad nor scouted, another team's or a free agent", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode: STEADY.code }));
    expect(await ofPlayer(SCORER.code)).toBeNull();
    expect(await ofPlayers([SCORER.code, STEADY.code])).toEqual([
      { playerCode: SCORER.code, stars: null },
      { playerCode: STEADY.code, stars: everyStrikerRole(3.5) },
    ]);
  });

  test("hidden, then shown once his scout's report is in, for him alone", async () => {
    await (await actingAs(t, ANN)).mutation(api.scouting.scouts.send, { leagueId, playerCode: SCORER.code });
    expect(await ofPlayer(SCORER.code)).toBeNull();
    await elapse(t, SCOUT_TRIP_MS);
    expect(await ofPlayer(SCORER.code)).toEqual(everyStrikerRole(5));
    expect(await ofPlayer(SCORER.code, BOB)).toBeNull();
  });

  test("a player his team let go this season stays shown", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.squads.squads.assign, { leagueId, playerCode: BLANK.code, teamId: annsTeam });
    await commissioner.mutation(api.squads.squads.release, { leagueId, playerCode: BLANK.code });
    expect(await ofPlayer(BLANK.code)).toEqual(everyStrikerRole(2.5));
  });

  test("a scouted player is hidden again once a new season starts", async () => {
    await (await actingAs(t, ANN)).mutation(api.scouting.scouts.send, { leagueId, playerCode: SCORER.code });
    await elapse(t, SCOUT_TRIP_MS);
    vi.setSystemTime(Date.UTC(seasonStartYear(Date.now()) + 1, JULY, 1));
    expect(await ofPlayer(SCORER.code)).toBeNull();
  });

  test("a commissioner who runs no team is shown none", async () => {
    expect(await ofPlayer(SCORER.code, COMMISSIONER)).toBeNull();
  });
});
