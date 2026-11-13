import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { claimRefusals } from "../../../convex/waivers/waiverClaims";
import { CLAIMS_PER_TEAM_MOST, WAIVER_MS } from "../../../convex/waivers/waiverLimits";
import { playerLeaves } from "../../support/convex/draftLists.harness";
import { setUsed } from "../../support/convex/leagueRules.harness";
import { actingAs, addManager, COMMISSIONER, MANAGERS, ANN, BOB } from "../../support/convex/leagues.harness";
import { nameOf, passNextDeadline } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANNS_FIRST_DROP, ANNS_SECOND_DROP, NEXT, PALMER, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// A manager's waiver claims (#1198, spec/08 Waivers and free agency): as many as he likes, ranked,
// each naming who he drops with a full squad, that drop happening only if the claim succeeds; none
// put in from the deadline until the gameweek's last match is over, when a run is skipped too; a
// manager sees only his own pending claims, the commissioner everyone's.

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

describe("a manager's claims", () => {
  test("as many as he likes, ranked: when his first fails his next is tried, and a drop happens only for the claim that succeeds", async () => {
    await w.onWaivers([SAKA, PALMER]);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.claim(ANN, PALMER, ANNS_SECOND_DROP);
    await w.claim(BOB, SAKA);
    await w.runWaivers();

    // Level in the table, the reverse of the draft order puts Bob first: he takes Saka.
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "owned", teamId: w.annsTeam });
    const annsSquad = await w.squadCodes(w.annsTeam);
    expect(annsSquad).toContain(ANNS_FIRST_DROP);
    expect(annsSquad).not.toContain(ANNS_SECOND_DROP);
    expect(await w.stateOf(ANNS_SECOND_DROP)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() + WAIVER_MS });
    expect(await w.pending(ANN)).toEqual([]);
  });

  test("are put in only for a player on waivers, dropping only his own player, once each", async () => {
    await w.onWaivers([SAKA]);
    await expectRefused(w.claim(ANN, PALMER), claimRefusals.notOnWaivers(nameOf(PALMER)));
    await expectRefused(w.claim(BOB, SAKA, ANNS_FIRST_DROP), claimRefusals.dropNotYours(nameOf(ANNS_FIRST_DROP)));
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await expectRefused(w.claim(ANN, SAKA, ANNS_FIRST_DROP), claimRefusals.twice);
    await w.claim(ANN, SAKA, ANNS_SECOND_DROP);
  });

  test(`are refused while his team has ${CLAIMS_PER_TEAM_MOST} in, until he withdraws one (S08.16)`, async () => {
    await w.onWaivers([SAKA, PALMER]);
    // Ann's team holds one short of the ceiling.
    await w.t.run(async (ctx) => {
      for (let rank = 0; rank < CLAIMS_PER_TEAM_MOST - 1; rank++) {
        await ctx.db.insert("waiverClaims", { leagueId: w.leagueId, teamId: w.annsTeam, playerCode: SAKA, dropCode: 900_000 + rank, rank, by: ANN });
      }
    });
    const palmerClaim = await w.claim(ANN, PALMER);
    await expectRefused(w.claim(ANN, SAKA), claimRefusals.tooMany);
    // The ceiling is each team's own: Bob still claims.
    await w.claim(BOB, SAKA);
    await (await actingAs(w.t, ANN)).mutation(api.waivers.waiverClaims.withdraw, { leagueId: w.leagueId, claimId: palmerClaim });
    await w.claim(ANN, SAKA);
  });

  test("aren't put in for a player who has left the Premier League", async () => {
    await w.onWaivers([PALMER]);
    await playerLeaves(w.t, PALMER);
    await expectRefused(w.claim(ANN, PALMER), claimRefusals.playerGone(nameOf(PALMER)));
  });

  test("are withdrawn and ranked again by their manager alone", async () => {
    await w.onWaivers([SAKA, PALMER]);
    const sakaClaim = await w.claim(ANN, SAKA);
    const palmerClaim = await w.claim(ANN, PALMER);
    const ann = await actingAs(w.t, ANN);
    const leagueId = w.leagueId;
    await ann.mutation(api.waivers.waiverClaims.rank, { leagueId, claimIds: [palmerClaim, sakaClaim] });
    expect((await w.pending(ANN)).map(({ claim }) => claim.playerCode)).toEqual([PALMER, SAKA]);
    await expectRefused(ann.mutation(api.waivers.waiverClaims.rank, { leagueId, claimIds: [palmerClaim] }), claimRefusals.claimsChanged);
    await expectRefused((await actingAs(w.t, BOB)).mutation(api.waivers.waiverClaims.withdraw, { leagueId, claimId: sakaClaim }), claimRefusals.notYours);

    await ann.mutation(api.waivers.waiverClaims.withdraw, { leagueId, claimId: palmerClaim });
    expect((await w.pending(ANN)).map(({ claim }) => claim.playerCode)).toEqual([SAKA]);
  });

  test("change who they drop, keeping their rank (Craig, 6 Nov 2026, on #1200), by their manager alone", async () => {
    await w.onWaivers([SAKA, PALMER]);
    const sakaClaim = await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.claim(ANN, PALMER, ANNS_FIRST_DROP);
    const ann = await actingAs(w.t, ANN);
    const changeDrop = (dropCode: number | null, by = ann) => by.mutation(api.waivers.waiverClaims.changeDrop, { leagueId: w.leagueId, claimId: sakaClaim, dropCode });
    await changeDrop(ANNS_SECOND_DROP);

    expect((await w.pending(ANN)).map(({ claim, drop }) => [claim.playerCode, drop?.playerCode])).toEqual([
      [SAKA, ANNS_SECOND_DROP],
      [PALMER, ANNS_FIRST_DROP],
    ]);
    await changeDrop(null);
    expect((await w.pending(ANN))[0].drop).toBeNull();
    await expectRefused(changeDrop(PALMER), claimRefusals.dropNotYours(nameOf(PALMER)));
    await expectRefused(changeDrop(ANNS_SECOND_DROP, await actingAs(w.t, BOB)), claimRefusals.notYours);
    await w.claim(ANN, SAKA, ANNS_SECOND_DROP);
    await expectRefused(changeDrop(ANNS_SECOND_DROP), claimRefusals.twice);
  });

  test("are counted for My team's Transactions tab: the caller's own, and none for someone running no team", async () => {
    await w.onWaivers([SAKA, PALMER]);
    await w.claim(ANN, SAKA);
    await w.claim(ANN, PALMER);
    await w.claim(BOB, SAKA);
    const countOf = async (email: string) => (await actingAs(w.t, email)).query(api.waivers.waiverClaims.countMine, { leagueId: w.leagueId });

    expect([await countOf(ANN), await countOf(BOB), await countOf(COMMISSIONER)]).toEqual([2, 1, 0]);
  });

  test("list each player with his positions, club and points, and the run that can first take him", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA);
    const [pending] = await w.pending(ANN);

    expect(pending.claim).toMatchObject({ positions: expect.any(Array), club: { shortName: expect.any(String) } });
    expect(pending.run?.at).toBeGreaterThanOrEqual(Date.now());
  });

  test("name a run still to come: once the run that could first take him has gone by, the next (#1467)", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA);
    const first = (await w.pending(ANN))[0].run!.at;

    expect((await w.pending(ANN, first + MINUTE_MS))[0].run!.at).toBeGreaterThan(first);
  });

  test("whose first run may fall in a gameweek's lock wait on its last match, so one run's claims share it (#1467)", async () => {
    const ofLeague = async (now: number) => (await actingAs(w.t, ANN)).query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, now });
    const nextDeadline = (await ofLeague(Date.now())).windowShuts!.at;
    // Wednesday's and Thursday's runs both fall after NEXT's deadline; Palmer can't be taken until Thursday's.
    const [wednesday, thursday] = (await ofLeague(nextDeadline - HOUR_MS)).runs.map(({ at }) => at);
    await w.onWaivers([SAKA]);
    await w.onWaivers([PALMER], wednesday + MINUTE_MS);
    await w.claim(ANN, SAKA);
    await w.claim(ANN, PALMER);
    const runsAt = async (now: number) => (await w.pending(ANN, now)).map(({ run }) => run);

    expect(await runsAt(nextDeadline - HOUR_MS)).toEqual([
      { at: wednesday, skippedIf: NEXT },
      { at: thursday, skippedIf: NEXT },
    ]);
    // Wednesday's run has gone by in the lock, skipped: Saka's first run is Thursday's now.
    expect(await runsAt(wednesday + HOUR_MS)).toEqual([
      { at: thursday, skippedIf: NEXT },
      { at: thursday, skippedIf: NEXT },
    ]);
    await w.matchIs(NEXT, "fullTime");
    expect(await runsAt(wednesday + HOUR_MS)).toEqual([
      { at: thursday, skippedIf: null },
      { at: thursday, skippedIf: null },
    ]);
  });

  test("a manager sees only his own pending claims; the commissioner sees everyone's", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.claim(BOB, SAKA);

    expect(await w.pending(ANN)).toEqual([
      {
        claimId: expect.any(String),
        teamId: w.annsTeam,
        teamName: teamNumbered(1),
        yours: true,
        claim: expect.objectContaining({ playerCode: SAKA, playerName: nameOf(SAKA) }),
        drop: expect.objectContaining({ playerCode: ANNS_FIRST_DROP, playerName: nameOf(ANNS_FIRST_DROP) }),
        run: { at: expect.any(Number), skippedIf: null },
      },
    ]);
    expect((await w.pending(BOB)).map(({ teamId }) => teamId)).toEqual([w.bobsTeam]);
    expect((await w.pending(COMMISSIONER)).map(({ teamId }) => teamId)).toEqual([w.annsTeam, w.bobsTeam]);
  });

  // Craig, 11 Nov 2026, on #1464: withdrawn when the manager goes; the next manager starts with none.
  test.each(["removed", "leaves"])("are withdrawn when their manager is %s: none is tried, and whoever takes the team on starts with none", async (how) => {
    await w.onWaivers([SAKA, PALMER]);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.claim(ANN, PALMER, ANNS_SECOND_DROP);
    await w.claim(BOB, PALMER);
    const leagueId = w.leagueId;
    if (how === "removed") await (await actingAs(w.t, COMMISSIONER)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: w.annsTeam });
    else await (await actingAs(w.t, ANN)).mutation(api.leagues.teams.leave, { leagueId });

    expect((await w.pending(COMMISSIONER)).map(({ teamId }) => teamId)).toEqual([w.bobsTeam]);
    const dan = MANAGERS[3];
    await addManager(w.t, leagueId, dan, w.annsTeam);
    expect(await w.pending(dan)).toEqual([]);
    await w.runWaivers();
    expect(await w.stateOf(SAKA)).toEqual({ kind: "freeAgent" });
    expect(await w.squadCodes(w.annsTeam)).toEqual(expect.arrayContaining([ANNS_FIRST_DROP, ANNS_SECOND_DROP]));
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
  });
});

describe("the lock", () => {
  test("refuses a claim from the deadline until the gameweek's last match is over, and a run then is skipped", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await passNextDeadline(w.t);
    await expectRefused(w.claim(ANN, SAKA), claimRefusals.locked);
    await w.runWaivers();

    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "onWaivers" });
    expect(await w.pending(BOB)).toHaveLength(1);

    await w.matchIs(NEXT, "fullTime");
    await w.runWaivers();
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
  });

  test("shuts new claims and a change of drop, but a claim in can still be ranked again or withdrawn (S08.14)", async () => {
    await w.onWaivers([SAKA, PALMER]);
    const sakaClaim = await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    const palmerClaim = await w.claim(ANN, PALMER);
    await passNextDeadline(w.t);
    const ann = await actingAs(w.t, ANN);
    const leagueId = w.leagueId;
    await expectRefused(ann.mutation(api.waivers.waiverClaims.changeDrop, { leagueId, claimId: sakaClaim, dropCode: ANNS_SECOND_DROP }), claimRefusals.locked);

    await ann.mutation(api.waivers.waiverClaims.rank, { leagueId, claimIds: [palmerClaim, sakaClaim] });
    expect((await w.pending(ANN)).map(({ claim }) => claim.playerCode)).toEqual([PALMER, SAKA]);
    await ann.mutation(api.waivers.waiverClaims.withdraw, { leagueId, claimId: palmerClaim });
    expect((await w.pending(ANN)).map(({ claim }) => claim.playerCode)).toEqual([SAKA]);
  });

  test("holds through a gameweek the league doesn't play, claims and the run alike (spec/13)", async () => {
    await setUsed(w.t, w.leagueId, NEXT, false);
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await passNextDeadline(w.t);
    await w.matchIs(NEXT, "live");
    await expectRefused(w.claim(ANN, SAKA), claimRefusals.locked);
    await w.runWaivers();
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "onWaivers" });

    await w.matchIs(NEXT, "fullTime");
    await w.runWaivers();
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
  });
});
