import { describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { claimFailedLetter } from "../../../convex/mail/waiverLetterWords";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import type { SquadWarning } from "../../../convex/squads/squads";
import { changeEveryRules, NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";
import { actingAs, ANN, BOB, COMMISSIONER } from "../../support/convex/leagues.harness";
import { nameOf, SQUAD, STARTER_POSITIONS } from "../../support/convex/lineupSquad.harness";
import { tradeLeague } from "../../support/convex/trades.harness";
import { SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// Each of the league's squad limits, held the same way everywhere a squad changes after the draft
// (#2127): a waiver claim that would break it is refused at the run (S08.18), while a trade (S08.19)
// and the commissioner's release and assign (S15.8) go through, warned. For each kind of limit,
// Ann's 4-4-2 squad of 15 Arsenal players sits within it, and taking Saka, another of Arsenal's
// midfielders, for the players named breaks it.

const ANNS_KEEPER = SQUAD.find((code) => STARTER_POSITIONS.get(code)?.includes("GK"))!;
const [OUTFIELD_1, OUTFIELD_2] = SQUAD.filter((code) => code !== ANNS_KEEPER);

/** Each limit kind: the league's squad rules, and Ann's players that go for Saka to break it. A
 *  claim brings one player in for at most one out, so it can't take a squad under its minimum. */
const cases: Record<SquadWarning["kind"], { squad: LeagueRules["squad"]; goes: number[]; claimable: boolean }> = {
  overMaximum: { squad: { size: { minimum: 1, maximum: SQUAD.length }, maxPerClub: null, minimumByArea: null }, goes: [], claimable: true },
  overClubMaximum: { squad: { size: null, maxPerClub: SQUAD.length, minimumByArea: null }, goes: [], claimable: true },
  underAreaMinimum: { squad: { size: null, maxPerClub: null, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } }, goes: [ANNS_KEEPER], claimable: true },
  underMinimum: { squad: { size: { minimum: SQUAD.length, maximum: SQUAD.length + 5 }, maxPerClub: null, minimumByArea: null }, goes: [OUTFIELD_1, OUTFIELD_2], claimable: false },
};
const kinds = Object.keys(cases) as SquadWarning["kind"][];

type League = Pick<WaiverLeague, "t" | "leagueId" | "annsTeam">;

/** The league's squad rules become `squad`, in force at once, and Ann's squad is within them. */
async function limitsAre(league: League, squad: LeagueRules["squad"]) {
  await changeEveryRules(league.t, league.leagueId, (rules) => ({ ...rules, squad }));
  expect(await annsWarnings(league)).toEqual([]);
}

/** The squad limits Ann's team breaks, as the Squads screen shows them. */
const annsWarnings = async ({ t, leagueId, annsTeam }: League) =>
  (await (await actingAs(t, COMMISSIONER)).query(api.squads.squads.squads, { leagueId })).find(({ teamId }) => teamId === annsTeam)!.warnings;

/** Ann's squad once `goes` have gone and Saka has come: what a change that went through leaves. */
const withSaka = (goes: readonly number[]) => [...SQUAD.filter((code) => !goes.includes(code)), SAKA].sort();

describe.each(kinds)("a squad pushed past its %s", (kind) => {
  const { squad, goes, claimable } = cases[kind];

  test.runIf(claimable)("by a waiver claim: refused at the run, the squad as it was, and its manager told why (S08.18)", async () => {
    const w = await waiverLeague();
    await limitsAre(w, squad);
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA, goes[0] ?? null);
    await w.runWaivers();

    expect(await w.stateOf(SAKA)).toEqual({ kind: "freeAgent" });
    expect((await w.squadCodes(w.annsTeam)).sort()).toEqual([...SQUAD].sort());
    const dropName = goes[0] === undefined ? null : nameOf(goes[0]);
    expect(await w.lettersTo(ANN)).toContainEqual(claimFailedLetter({ playerName: nameOf(SAKA), dropName, why: "limits" }));
  });

  test("by a trade: warned when offered, and it goes through (S08.19)", async () => {
    const w = await tradeLeague();
    await limitsAre(w, squad);
    const { offerId, warnings } = await w.offer(ANN, w.bobsTeam, goes, [SAKA]);
    expect(warnings.find(({ teamId }) => teamId === w.annsTeam)!.warnings).toContainEqual(expect.objectContaining({ kind }));
    await w.accept(BOB, offerId);
    await w.reviewEnds(offerId);

    expect((await w.squadCodes(w.annsTeam)).sort()).toEqual(withSaka(goes));
    expect(await annsWarnings(w)).toContainEqual(expect.objectContaining({ kind }));
  });

  test("by the commissioner's release and assign: each goes through, warned (S15.8)", async () => {
    const w = await waiverLeague();
    await limitsAre(w, squad);
    const commissioner = await actingAs(w.t, COMMISSIONER);
    for (const playerCode of goes) await commissioner.mutation(api.squads.squads.release, { leagueId: w.leagueId, playerCode });
    await commissioner.mutation(api.squads.squads.assign, { leagueId: w.leagueId, playerCode: SAKA, teamId: w.annsTeam });

    expect((await w.squadCodes(w.annsTeam)).sort()).toEqual(withSaka(goes));
    expect(await annsWarnings(w)).toContainEqual(expect.objectContaining({ kind }));
  });
});
