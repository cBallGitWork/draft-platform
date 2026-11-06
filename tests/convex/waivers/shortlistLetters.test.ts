import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { shortlistedClearedLetter, shortlistedDroppedLetter } from "../../../convex/scouting/shortlistWords";
import { DAY_MS } from "../../../convex/shared/time";
import { actingAs } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, PALMER, RICE, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// The shortlist's waiver letters (#374, spec/19 The shortlist, spec/16): Mail tells each manager
// whose shortlist holds a player when he is dropped, by a manager or for a claim, and when he
// clears waivers, nobody claiming him at a run: one letter a run, naming every such player.

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

const shortlist = async (email: string, codes: readonly number[]) => {
  const manager = await actingAs(w.t, email);
  for (const playerCode of codes) await manager.mutation(api.scouting.shortlist.add, { leagueId: w.leagueId, playerCode });
};
const drop = async (email: string, playerCode: number) => (await actingAs(w.t, email)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode });
const dropped = (toWaivers: boolean, who: string, playerCode = ANNS_FIRST_DROP, teamName = "Team 1") =>
  shortlistedDroppedLetter({ playerName: nameOf(playerCode), teamName, toWaivers }, who);
const shortlistLettersTo = async (email: string) => (await w.lettersTo(email)).filter(({ subject }) => subject.includes("on your shortlist"));

describe("a shortlisted player dropped", () => {
  test("by his manager: each manager whose shortlist holds him is told he is on waivers, and no one else", async () => {
    await shortlist(BOB, [ANNS_FIRST_DROP]);
    await shortlist(CAT, [ANNS_FIRST_DROP]);
    await drop(ANN, ANNS_FIRST_DROP);

    const letter = dropped(true, ANN);
    expect(letter).toEqual({
      subject: `${nameOf(ANNS_FIRST_DROP)}, on your shortlist, was dropped`,
      body: `${ANN} dropped ${nameOf(ANNS_FIRST_DROP)} from Team 1. He is on waivers for at least 24 hours, and on your shortlist.`,
    });
    expect(await shortlistLettersTo(BOB)).toEqual([letter]);
    expect(await shortlistLettersTo(CAT)).toEqual([letter]);
    expect(await shortlistLettersTo(ANN)).toEqual([]);
  });

  test("under the churn rule: he is told the player is a free agent again", async () => {
    await w.t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId: w.leagueId, teamId: w.bobsTeam, playerCode: SAKA, pickedUpAt: Date.now() }));
    await shortlist(CAT, [SAKA]);
    await drop(BOB, SAKA);

    const letter = dropped(false, BOB, SAKA, "Team 2");
    expect(letter.body).toBe(`${BOB} dropped ${nameOf(SAKA)} from Team 2. He is a free agent again, not on waivers, and on your shortlist.`);
    expect(await shortlistLettersTo(CAT)).toEqual([letter]);
  });

  test("for a claim at a waiver run: the shortlisting manager is told",async () => {
    await shortlist(BOB, [ANNS_FIRST_DROP]);
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.runWaivers();

    expect(await shortlistLettersTo(BOB)).toEqual([dropped(true, ANN)]);
  });
});

describe("shortlisted players clearing waivers", () => {
  test("one letter a run to each manager whose shortlist holds players nobody claimed, naming them; a claimed one isn't named", async () => {
    await w.onWaivers([SAKA, PALMER, RICE]);
    await shortlist(BOB, [SAKA, PALMER, RICE]);
    await shortlist(ANN, [RICE]);
    await w.claim(CAT, RICE);
    await w.runWaivers();

    const names = [nameOf(SAKA), nameOf(PALMER)].sort((one, other) => one.localeCompare(other));
    expect(await shortlistLettersTo(BOB)).toEqual([shortlistedClearedLetter(names)]);
    expect(await shortlistLettersTo(ANN)).toEqual([]);
    expect(await shortlistLettersTo(CAT)).toEqual([]);
  });

  test("one player alone is named in the subject", async () => {
    await w.onWaivers([SAKA]);
    await shortlist(BOB, [SAKA]);
    await w.runWaivers();

    expect(await shortlistLettersTo(BOB)).toEqual([
      {
        subject: `${nameOf(SAKA)}, on your shortlist, cleared waivers`,
        body: `Nobody claimed ${nameOf(SAKA)} at the waiver run. He is a free agent, first come first served, and on your shortlist.`,
      },
    ]);
  });

  test("a player whose 24 hours aren't up hasn't cleared: no letter", async () => {
    await w.onWaivers([SAKA], Date.now() + 2 * DAY_MS);
    await shortlist(BOB, [SAKA]);
    await w.runWaivers();

    expect(await shortlistLettersTo(BOB)).toEqual([]);
  });
});
