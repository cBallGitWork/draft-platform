// The player card's claim or drop (#1200; spec/12, the player card's actions; spec/08): Drop for a
// player in the manager's own squad, asked once more; Claim for one on waivers, with the run that can
// first take him; Pick up for a free agent; both naming who goes, or nobody. The server's own rules
// and refusals are tested in tests/convex/waivers/.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { dropRefusals } from "../../../convex/waivers/waivers";
import type { CardAction } from "../../../src/playerCard/seam";
import {
  bidInWords,
  bidOrderWords,
  claimWords,
  confirmDropWords,
  dropWords,
  keepWords,
  pickUpWords,
  whoGoesLabel,
  withdrawWords,
} from "../../../src/playerCard/words";
import { A_CLAIM_ID } from "../../support/src/playerCard.harness";
import { HELD, openCard, RICE, SAKA } from "../../support/src/playerCardScreen.harness";
import { league, manager } from "../../support/src/shell.harness";

const FIRST_RUN = { at: Date.parse("2026-11-12T18:00:00Z"), skippedIf: null };
const SQUAD = [
  { playerCode: 2001, playerName: "Mbeumo" },
  { playerCode: 2002, playerName: "Wissa" },
];
/** Reverse table order, the caller's team with no win holding it at the back. */
const REVERSE = { order: "reverseStandings", wonBid: false } as const;
const withAction = (playerCode: number, action: CardAction, waiverRefusal: string | null = null) => ({ ...HELD, actions: new Map([[playerCode, action]]), waiverRefusal });

describe("a player in the manager's squad", () => {
  it("drops him once asked again, and keeps him on Keep him", async () => {
    const app = openCard(SAKA, withAction(SAKA.code, { kind: "drop" }));
    await userEvent.click(await screen.findByRole("button", { name: dropWords }));
    expect(screen.getByText(confirmDropWords(SAKA.name))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: keepWords }));
    expect(screen.queryByText(confirmDropWords(SAKA.name))).toBeNull();
    expect(app.playerCard.waiverChanges.drop).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: dropWords }));
    await userEvent.click(screen.getByRole("button", { name: dropWords }));
    expect(app.playerCard.waiverChanges.drop).toHaveBeenCalledWith(league.leagueId, SAKA.code);
  });

  it("asks again on Drop when he is back in the squad after going (#1437)", async () => {
    const actions = new Map<number, CardAction>([[RICE.code, { kind: "drop" }]]);
    openCard(RICE, { ...HELD, actions });
    await userEvent.click(await screen.findByRole("button", { name: dropWords }));
    // The card redraws as each change lands, the server's answer moved on by then.
    actions.set(RICE.code, { kind: "pickUp", squad: [] });
    await userEvent.click(screen.getByRole("button", { name: dropWords }));
    actions.set(RICE.code, { kind: "drop" });
    await userEvent.click(await screen.findByRole("button", { name: pickUpWords }));
    await screen.findByRole("button", { name: dropWords });
    expect(screen.queryByText(confirmDropWords(RICE.name))).toBeNull();
  });

  it("says the server's refusal, as in the lock", async () => {
    openCard(SAKA, withAction(SAKA.code, { kind: "drop" }, dropRefusals.locked));
    await userEvent.click(await screen.findByRole("button", { name: dropWords }));
    await userEvent.click(screen.getByRole("button", { name: dropWords }));
    expect(await screen.findByText(dropRefusals.locked)).toBeTruthy();
  });
});

describe("a player on waivers", () => {
  it("says the run that can first take him, and claims him naming who goes", async () => {
    const app = openCard(RICE, withAction(RICE.code, { kind: "claim", firstRun: FIRST_RUN, squad: SQUAD, ...REVERSE }));
    expect(await screen.findByText(bidOrderWords(FIRST_RUN, "reverseStandings", false))).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText(whoGoesLabel), "Wissa");
    await userEvent.click(screen.getByRole("button", { name: claimWords }));

    expect(app.playerCard.waiverChanges.claim).toHaveBeenCalledWith(league.leagueId, RICE.code, 2002);
    expect(await screen.findByText(bidInWords(FIRST_RUN))).toBeTruthy();
  });

  it("claims him naming nobody, with no squad to name from", async () => {
    const app = openCard(RICE, withAction(RICE.code, { kind: "claim", firstRun: null, squad: [], ...REVERSE }));
    expect(await screen.findByText(bidOrderWords(null, "reverseStandings", false))).toBeTruthy();
    expect(screen.queryByLabelText(whoGoesLabel)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: claimWords }));
    expect(app.playerCard.waiverChanges.claim).toHaveBeenCalledWith(league.leagueId, RICE.code, null);
  });

  it("whose first run may fall in a gameweek's lock says it comes after that gameweek's last match (#1467)", async () => {
    openCard(RICE, withAction(RICE.code, { kind: "claim", firstRun: { at: FIRST_RUN.at, skippedIf: 12 }, squad: [], ...REVERSE }));
    expect(await screen.findByText("Bids settle after GW12's last match. Bottom of the table bids first.")).toBeTruthy();
  });
});

describe("S08.32: beside the bid, when bids settle and who bids first (#2648)", () => {
  it("under reverse table order, the bottom of the table bids first", async () => {
    openCard(RICE, withAction(RICE.code, { kind: "claim", firstRun: FIRST_RUN, squad: [], ...REVERSE }));
    expect(await screen.findByText(/^Bids settle .+\. Bottom of the table bids first\.$/)).toBeTruthy();
  });

  it("under rotating, the last team to win a bid goes to the back", async () => {
    openCard(RICE, withAction(RICE.code, { kind: "claim", firstRun: FIRST_RUN, squad: [], order: "rotating", wonBid: true }));
    expect(await screen.findByText(/^Bids settle .+\. Bid order rotates: the last team to win a bid goes to the back\.$/)).toBeTruthy();
  });

  it("a team that has won one this gameweek under reverse table order is told it goes to the back", async () => {
    openCard(RICE, withAction(RICE.code, { kind: "claim", firstRun: FIRST_RUN, squad: [], order: "reverseStandings", wonBid: true }));
    expect(await screen.findByText(/^Bids settle .+\. Bottom of the table bids first\. A team that wins a bid goes to the back until the gameweek ends\.$/)).toBeTruthy();
  });

  it("once the bid is in, says when he'll hear, in Mail, and Withdraw takes it back", async () => {
    const app = openCard(RICE, withAction(RICE.code, { kind: "claim", firstRun: FIRST_RUN, squad: [], ...REVERSE }));
    await userEvent.click(await screen.findByRole("button", { name: claimWords }));
    expect(await screen.findByText(/^Bid in\. You'll hear after .+, in Mail\.$/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: withdrawWords }));
    expect(app.playerCard.waiverChanges.withdraw).toHaveBeenCalledWith(league.leagueId, A_CLAIM_ID);
    expect(screen.queryByText(bidInWords(FIRST_RUN))).toBeNull();
    expect(screen.queryByRole("button", { name: withdrawWords })).toBeNull();
  });
});

describe("a free agent", () => {
  it("is picked up, nobody going unless named", async () => {
    const app = openCard(RICE, withAction(RICE.code, { kind: "pickUp", squad: SQUAD }));
    await userEvent.click(await screen.findByRole("button", { name: pickUpWords }));
    expect(app.playerCard.waiverChanges.pickUp).toHaveBeenLastCalledWith(league.leagueId, RICE.code, null);

    await userEvent.selectOptions(screen.getByLabelText(whoGoesLabel), "Mbeumo");
    await userEvent.click(screen.getByRole("button", { name: pickUpWords }));
    expect(app.playerCard.waiverChanges.pickUp).toHaveBeenLastCalledWith(league.leagueId, RICE.code, 2001);
  });

  it("drops a choice made for a claim once he leaves waivers", async () => {
    const actions = new Map<number, CardAction>([[RICE.code, { kind: "claim", firstRun: FIRST_RUN, squad: SQUAD, ...REVERSE }]]);
    const app = openCard(RICE, { ...HELD, actions });
    await userEvent.selectOptions(await screen.findByLabelText(whoGoesLabel), "Wissa");

    actions.set(RICE.code, { kind: "pickUp", squad: SQUAD });
    app.becomes({ ...manager });
    await userEvent.click(await screen.findByRole("button", { name: pickUpWords }));
    expect(app.playerCard.waiverChanges.pickUp).toHaveBeenCalledWith(league.leagueId, RICE.code, null);
  });
});

it("another team's player has no claim, drop or pickup", async () => {
  openCard(SAKA, withAction(SAKA.code, { kind: "none" }));
  await screen.findByRole("heading", { level: 1, name: SAKA.fullName });
  for (const name of [dropWords, claimWords, pickUpWords]) expect(screen.queryByRole("button", { name })).toBeNull();
});
