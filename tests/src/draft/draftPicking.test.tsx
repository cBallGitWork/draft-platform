// Picking on the draft room (#1099; spec/04, The draft room): Scouting's players list under the
// board, with each player the reader's team can't take greyed out in his place, and his panel's
// Draft button, which makes the pick only while the reader is on the clock.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { DRAFT_PATH } from "../../../src/frame/menu";
import type { DraftState } from "../../../src/draft/seam";
import { draftPlayerWords, notLegalWords, notYourPickWords, pausedPickWords, PLAYERS_TITLE, selectLabel, takenWords } from "../../../src/draft/words";
import { availabilityWords } from "../../../src/scouting/words";
import { draftOrder, type DraftData } from "../../support/src/draft.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
const listed = (code: number, name: string, ownerTeamName: string | null = null): ListedPlayer => ({
  code,
  name,
  fullName: name,
  club: ARSENAL,
  positions: ["W"],
  ownerTeamName,
  seasonPoints: null,
  stat: null,
});
const SAKA = listed(1, "Saka");
const RICE = listed(2, "Rice");
const ODEGAARD = listed(3, "Ødegaard", "Team 1");
const players = [SAKA, RICE, ODEGAARD];

/** A live draft's first pick, Team 1's, or the reader's Team 2's second, paused or not. */
function liveDraft(yours: boolean, paused = false): DraftState {
  const now = Date.now();
  const team = draftOrder[yours ? 1 : 0];
  return {
    status: "live",
    startedAt: now - MINUTE_MS,
    rounds: 2,
    order: draftOrder,
    picksMade: yours ? 1 : 0,
    onTheClock: { pick: yours ? 2 : 1, round: 1, teamId: team.teamId, name: team.name },
    clock: { startsAt: now - 42 * SECOND_MS, endsAt: now + 48 * SECOND_MS, pausedAt: paused ? now : undefined },
  };
}

const openDraft = (data: DraftData) => openApp(DRAFT_PATH, manager, { draft: { players, ...data } });
const list = () => screen.findByRole("region", { name: PLAYERS_TITLE });
const open = async (name: string) => userEvent.click(within(await list()).getByRole("button", { name: selectLabel(name) }));
const draftButton = (name: string) => screen.getByRole("button", { name: draftPlayerWords(name) });

describe("the players list", () => {
  it("lists the players nobody has drafted, and Scouting's owner filter shows the drafted ones", async () => {
    openDraft({ draft: liveDraft(true) });
    const region = await list();
    expect(within(region).queryByRole("button", { name: selectLabel(ODEGAARD.name) })).toBeNull();
    expect(within(region).getByRole("button", { name: selectLabel(SAKA.name) })).toBeTruthy();

    await userEvent.click(within(region).getByRole("radio", { name: availabilityWords.owned }));
    expect(within(region).getByRole("button", { name: selectLabel(ODEGAARD.name) })).toBeTruthy();
    expect(within(region).queryByRole("button", { name: selectLabel(SAKA.name) })).toBeNull();
  });

  it("keeps a player the team can't take in his place, saying why", async () => {
    openDraft({ draft: liveDraft(true), greyed: [{ code: RICE.code, reason: "clubFull" }] });
    const rows = within(await list()).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("Rice"), expect.stringContaining("Saka")]);
    expect(rows[0].textContent).toContain(notLegalWords.clubFull);
    expect(rows[1].textContent).not.toContain(notLegalWords.clubFull);
  });
});

describe("the Draft button", () => {
  it("makes the pick while the reader is on the clock", async () => {
    const app = openDraft({ draft: liveDraft(true) });
    await open(SAKA.name);
    const button = draftButton(SAKA.name);
    expect(button).toHaveProperty("disabled", false);

    await userEvent.click(button);
    expect(app.draft.changes.makePick).toHaveBeenCalledWith(expect.anything(), SAKA.code);
  });

  it("can't be pressed for a greyed-out player", async () => {
    openDraft({ draft: liveDraft(true), greyed: [{ code: RICE.code, reason: "areasShort" }] });
    await open(RICE.name);
    expect(draftButton(RICE.name)).toHaveProperty("disabled", true);
    expect(screen.getAllByText(notLegalWords.areasShort).length).toBeGreaterThan(0);
  });

  it("can't be pressed out of turn", async () => {
    openDraft({ draft: liveDraft(false) });
    await open(SAKA.name);
    expect(draftButton(SAKA.name)).toHaveProperty("disabled", true);
    expect(screen.getByText(notYourPickWords)).toBeTruthy();
  });

  it("can't be pressed while the draft is paused", async () => {
    openDraft({ draft: liveDraft(true, true) });
    await open(SAKA.name);
    expect(draftButton(SAKA.name)).toHaveProperty("disabled", true);
    expect(screen.getByText(pausedPickWords)).toBeTruthy();
  });

  it("can't be pressed for a drafted player, naming his team", async () => {
    openDraft({ draft: liveDraft(true) });
    await userEvent.click(within(await list()).getByRole("radio", { name: availabilityWords.owned }));
    await open(ODEGAARD.name);
    expect(draftButton(ODEGAARD.name)).toHaveProperty("disabled", true);
    expect(screen.getAllByText(takenWords("Team 1")).length).toBeGreaterThan(0);
  });

  it("says why the server refused the pick", async () => {
    openDraft({ draft: liveDraft(true), pickAnswer: "Saka is already on Team 1." });
    await open(SAKA.name);
    await userEvent.click(draftButton(SAKA.name));
    expect((await screen.findByRole("alert")).textContent).toBe("Saka is already on Team 1.");
  });
});
