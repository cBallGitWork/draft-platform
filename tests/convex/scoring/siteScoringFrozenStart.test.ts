import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { ADMIN, COMMISSIONER } from "../../support/convex/leagues.harness";
import { EDITED, fixAs, inGameweek, kickoffOf, t, useSiteScoringDeployment, viewAs } from "../../support/convex/siteScoring.harness";

// A gameweek keeps the scoring version in force at its first kickoff, even if that match is then
// postponed or abandoned and leaves the gameweek (#414; spec/14, Changes and corrections: a fix
// "still never touches a gameweek already played"). The first kickoff is recorded once it passes,
// before the football sync, the only writer of kickoffs, can move it, as a passed deadline is (#150).

useSiteScoringDeployment();

const GAMEWEEK = 9;
/** holdGameweeks codes each gameweek's one match with its number. */
const OPENER = { code: GAMEWEEK, gameweek: GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: kickoffOf(GAMEWEEK) };
/** Gameweek 9's second match, two hours after the opener. */
const SECOND = { code: 100, gameweek: GAMEWEEK, homeClubCode: 3, awayClubCode: 4, kickoff: kickoffOf(GAMEWEEK) + 2 * HOUR_MS };
/** The opener postponed, as the feed sends one: no gameweek, no kickoff. */
const OPENER_POSTPONED = { ...OPENER, gameweek: null, kickoff: null };

beforeEach(async () => {
  await holdGameweeks(t, { next: GAMEWEEK });
  await t.mutation(internal.football.footballSync.upsertFixtures, { rows: [SECOND] });
});

test("a fix made between a gameweek's kickoffs never reaches it, even once its first match is postponed", async () => {
  vi.setSystemTime(kickoffOf(GAMEWEEK) + 30 * MINUTE_MS);
  expect(await fixAs(ADMIN, EDITED)).toBe(GAMEWEEK + 1);

  await t.mutation(internal.football.footballSync.upsertFixtures, { rows: [OPENER_POSTPONED] });

  expect(await inGameweek(GAMEWEEK)).toEqual(FIRST_SCORING);
  expect(await inGameweek(GAMEWEEK + 1)).toEqual(EDITED);
  expect((await viewAs(COMMISSIONER)).changesFrom).toBe(GAMEWEEK + 1);
});

test("a first match postponed before it kicks off moves the gameweek's start: a fix made before the next match reaches it", async () => {
  vi.setSystemTime(kickoffOf(GAMEWEEK) - HOUR_MS);
  await t.mutation(internal.football.footballSync.upsertFixtures, { rows: [OPENER_POSTPONED] });
  vi.setSystemTime(kickoffOf(GAMEWEEK) + 30 * MINUTE_MS);

  expect(await fixAs(ADMIN, EDITED)).toBe(GAMEWEEK);
  expect(await inGameweek(GAMEWEEK)).toEqual(EDITED);
});
