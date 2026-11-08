import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { claimRefusals } from "../../../convex/waivers/waiverClaims";
import { WAIVER_MS } from "../../../convex/waivers/waiverPlayers";
import { playerLeaves } from "../../support/convex/draftLists.harness";
import { setUsed } from "../../support/convex/leagueRules.harness";
import { actingAs, COMMISSIONER } from "../../support/convex/leagues.harness";
import { nameOf, passNextDeadline } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, ANNS_FIRST_DROP, ANNS_SECOND_DROP, BOB, NEXT, PALMER, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

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

  test("a manager sees only his own pending claims; the commissioner sees everyone's", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.claim(BOB, SAKA);

    expect(await w.pending(ANN)).toEqual([
      {
        claimId: expect.any(String),
        teamId: w.annsTeam,
        teamName: "Team 1",
        claim: { playerCode: SAKA, playerName: nameOf(SAKA) },
        drop: { playerCode: ANNS_FIRST_DROP, playerName: nameOf(ANNS_FIRST_DROP) },
      },
    ]);
    expect((await w.pending(BOB)).map(({ teamId }) => teamId)).toEqual([w.bobsTeam]);
    expect((await w.pending(COMMISSIONER)).map(({ teamId }) => teamId)).toEqual([w.annsTeam, w.bobsTeam]);
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
