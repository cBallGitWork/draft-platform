import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { STARS_READ_MOST, starsReadRefusals } from "../../../convex/stars/playerStars";
import { NO_DATA, UNSURE, type Stars } from "../../../convex/stars/starsShape";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { NEWCOMER, SCORER, STEADY, UNUSED, holdStarsPlayers, refreshEveryone } from "../../support/convex/stars.harness";

// Players' stars as a screen reads them (#11, playerStars.ts): one player's, or many at once.

const [ANN] = MANAGERS;
const STRIKER_ROLES = DEFAULT_ROLES.ST.map((role) => role.key);
const everyStrikerRole = (stars: Stars) => STRIKER_ROLES.map((role) => ({ area: "attack", role, stars }));

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await addManagers(t, leagueId, [ANN]);
  await holdStarsPlayers(t);
  await refreshEveryone(t);
});

const ofPlayer = async (playerCode: number) => (await actingAs(t, ANN)).query(api.stars.playerStars.ofPlayer, { leagueId, playerCode });
const ofPlayers = async (playerCodes: number[]) => (await actingAs(t, ANN)).query(api.stars.playerStars.ofPlayers, { leagueId, playerCodes });

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

test(`more than ${STARS_READ_MOST} at once is refused, never cut short`, async () => {
  const tooMany = Array.from({ length: STARS_READ_MOST + 1 }, (_, index) => 5000 + index);
  await expectRefused(ofPlayers(tooMany), starsReadRefusals.tooMany);
});
