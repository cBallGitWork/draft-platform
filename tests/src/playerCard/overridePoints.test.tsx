// The player card's override (#32; spec/14, Changes and corrections): whoever runs the league sets
// one player's points in one match, with a reason, from his card; everyone sees the override on the
// match it changed. The server's own rules and refusals are tested in
// tests/convex/table/pointsOverrides.test.ts.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OverridePoints } from "../../../src/playerCard/OverridePoints";
import { playerCardPath } from "../../../src/playerCard/paths";
import type { PlayedMatch, PlayerCard } from "../../../src/playerCard/seam";
import {
  cancelOverrideWords,
  OVERRIDE_TITLE,
  overriddenDoneWords,
  overriddenWasWords,
  overriddenWords,
  overrideHint,
  overrideLabels,
  overrideMatchWords,
  overrideRemovedWords,
  overrideWords,
  removeOverrideWords,
  SEASON_TITLE,
} from "../../../src/playerCard/words";
import { ARSENAL, COVENTRY } from "../../support/convex/footballRows.harness";
import { descriptionOf } from "../../support/src/describedBy";
import { fakePlayerCard, type PlayerCardData } from "../../support/src/playerCard.harness";
import { SAKA_POTATOES } from "../../support/src/playerCardScreen.harness";
import { adminSeeing, coCommissioned, commissioned, league, manager, managerIn, openApp } from "../../support/src/shell.harness";
import type { Session } from "../../../src/signIn/seam";

const MATCH: PlayedMatch = {
  fixtureCode: 41,
  gameweek: 4,
  kickoff: Date.parse("2026-09-12T14:00:00Z"),
  home: ARSENAL,
  away: COVENTRY,
  minutes: 90,
  score: null,
  stats: null,
  points: [
    {
      position: "W",
      total: 7,
      categories: [{ stat: "goals_scored", name: "Goals scored", points: 5, why: { actions: 1, value: { shape: "perAction", points: 5 }, pricedBy: { by: "all" }, cut: null } }],
    },
  ],
  version: null,
  override: null,
  provisional: false,
};
const EARLIER: PlayedMatch = { ...MATCH, fixtureCode: 31, gameweek: 3, home: COVENTRY, away: ARSENAL };
const SAKA: PlayerCard = {
  code: 1001,
  name: "Saka",
  fullName: "Bukayo Saka",
  club: ARSENAL,
  gone: false,
  positions: ["W"],
  pricedAt: ["W"],
  ownerTeamName: "Saka Potatoes",
  ownerTeamId: SAKA_POTATOES,
  news: null,
  chanceOfPlaying: null,
  matches: [MATCH, EARLIER],
  postponed: [],
  categories: [],
  lastSeason: null,
  nextFixtures: [],
};
const REASON = "The feed gave his goal to Rice";

const openCard = (session: Session, playerCard: PlayerCardData = { cards: [SAKA] }) =>
  openApp(playerCardPath(league.leagueId, SAKA.code), session, { playerCard });
const overrideButton = () => screen.queryByRole("button", { name: OVERRIDE_TITLE });

describe("who may override", () => {
  it("a manager who doesn't run the league isn't offered it", async () => {
    openCard(manager);
    await screen.findByRole("region", { name: SEASON_TITLE });
    expect(overrideButton()).toBeNull();
  });

  it.each([
    ["the commissioner", managerIn(commissioned)],
    ["the co-commissioner", managerIn(coCommissioned)],
    ["the admin", adminSeeing(league)],
  ])("%s is offered it", async (_who, session) => {
    openCard(session);
    expect(await screen.findByRole("button", { name: OVERRIDE_TITLE })).toBeTruthy();
  });

  it("isn't offered for a player who has played no match", async () => {
    openCard(managerIn(commissioned), { cards: [{ ...SAKA, matches: [] }] });
    await screen.findByRole("region", { name: SEASON_TITLE });
    expect(overrideButton()).toBeNull();
  });
});

describe("overriding", () => {
  it("Override waits for his points and why, and Cancel shuts the form, forgetting them", async () => {
    openCard(managerIn(commissioned));
    await userEvent.click(await screen.findByRole("button", { name: OVERRIDE_TITLE }));
    const form = within(screen.getByRole("form", { name: OVERRIDE_TITLE }));
    expect((form.getByRole("button", { name: overrideWords }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(form.getByLabelText(overrideLabels.points), "3");
    await userEvent.type(form.getByLabelText(overrideLabels.reason), REASON);
    expect((form.getByRole("button", { name: overrideWords }) as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(form.getByRole("button", { name: cancelOverrideWords }));
    expect(screen.queryByRole("form", { name: OVERRIDE_TITLE })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: OVERRIDE_TITLE }));
    expect((screen.getByLabelText(overrideLabels.reason) as HTMLInputElement).value).toBe("");
  });

  it("sends the match picked, his points and why, then says it is done and clears the form", async () => {
    const app = openCard(managerIn(commissioned));
    await userEvent.click(await screen.findByRole("button", { name: OVERRIDE_TITLE }));
    const form = within(screen.getByRole("form", { name: OVERRIDE_TITLE }));

    expect(form.getAllByRole("option").map((option) => option.textContent)).toEqual([
      overrideMatchWords(4, "ARS", "COV"),
      overrideMatchWords(3, "COV", "ARS"),
    ]);
    await userEvent.selectOptions(form.getByLabelText(overrideLabels.match), overrideMatchWords(3, "COV", "ARS"));
    await userEvent.type(form.getByLabelText(overrideLabels.points), "12.5");
    await userEvent.type(form.getByLabelText(overrideLabels.reason), REASON);
    const statusesBefore = screen.getAllByRole("status");
    await userEvent.click(form.getByRole("button", { name: overrideWords }));

    expect(app.playerCard.override).toHaveBeenCalledWith(league.leagueId, { fixtureCode: EARLIER.fixtureCode, playerCode: SAKA.code, points: 12.5, reason: REASON });
    const done = await screen.findByText(overriddenDoneWords);
    expect(done.getAttribute("role")).toBe("status");
    // The live region was in the page, empty, before the save, so the words are announced.
    expect(statusesBefore).toContain(done);
    expect((form.getByLabelText(overrideLabels.reason) as HTMLInputElement).value).toBe("");
  });

  it("opens on the match whose breakdown it sits in, and sends that one (#1535)", async () => {
    const app = openCard(managerIn(commissioned));
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    await userEvent.click(within(season.getAllByRole("rowheader")[1]).getByRole("button"));
    await userEvent.click(screen.getByRole("button", { name: OVERRIDE_TITLE }));
    const form = within(screen.getByRole("form", { name: OVERRIDE_TITLE }));

    expect((form.getByLabelText(overrideLabels.match) as HTMLSelectElement).value).toBe(String(EARLIER.fixtureCode));
    await userEvent.type(form.getByLabelText(overrideLabels.points), "2");
    await userEvent.type(form.getByLabelText(overrideLabels.reason), REASON);
    await userEvent.click(form.getByRole("button", { name: overrideWords }));
    expect(app.playerCard.override).toHaveBeenCalledWith(league.leagueId, { fixtureCode: EARLIER.fixtureCode, playerCode: SAKA.code, points: 2, reason: REASON });
  });

  it("follows the match pressed in the game log, opening afresh on it", async () => {
    openCard(managerIn(commissioned));
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    await userEvent.click(screen.getByRole("button", { name: OVERRIDE_TITLE }));
    expect((screen.getByLabelText(overrideLabels.match) as HTMLSelectElement).value).toBe(String(MATCH.fixtureCode));

    await userEvent.click(within(season.getAllByRole("rowheader")[1]).getByRole("button"));
    expect(screen.queryByRole("form", { name: OVERRIDE_TITLE })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: OVERRIDE_TITLE }));
    expect((screen.getByLabelText(overrideLabels.match) as HTMLSelectElement).value).toBe(String(EARLIER.fixtureCode));
  });

  it("describes the points box by the hint, for screen readers", async () => {
    openCard(managerIn(commissioned));
    await userEvent.click(await screen.findByRole("button", { name: OVERRIDE_TITLE }));
    expect(descriptionOf(screen.getByLabelText(overrideLabels.points))).toBe(overrideHint);
  });

  it("says why the server refused, and keeps what was typed", async () => {
    const refusal = "That match isn't final yet.";
    openCard(managerIn(commissioned), { cards: [SAKA], overrideRefusal: refusal });
    await userEvent.click(await screen.findByRole("button", { name: OVERRIDE_TITLE }));
    const form = within(screen.getByRole("form", { name: OVERRIDE_TITLE }));
    await userEvent.type(form.getByLabelText(overrideLabels.points), "3");
    await userEvent.type(form.getByLabelText(overrideLabels.reason), REASON);
    await userEvent.click(form.getByRole("button", { name: overrideWords }));

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
    expect((form.getByLabelText(overrideLabels.reason) as HTMLInputElement).value).toBe(REASON);
    expect(screen.queryByText(overriddenDoneWords)).toBeNull();
  });
});

describe("removing an override (S14.5)", () => {
  const OVERRIDDEN_SAKA: PlayerCard = { ...SAKA, matches: [MATCH, { ...EARLIER, override: { points: 12.5, reason: REASON } }] };
  const removeButton = () => screen.queryByRole("button", { name: removeOverrideWords });

  it("is offered only on a match the league overrode, and removes that one, then says so", async () => {
    const app = openCard(managerIn(commissioned), { cards: [OVERRIDDEN_SAKA] });
    await userEvent.click(await screen.findByRole("button", { name: OVERRIDE_TITLE }));
    expect(removeButton()).toBeNull();

    const form = within(screen.getByRole("form", { name: OVERRIDE_TITLE }));
    await userEvent.selectOptions(form.getByLabelText(overrideLabels.match), overrideMatchWords(3, "COV", "ARS"));
    await userEvent.click(removeButton()!);
    expect(app.playerCard.removeOverride).toHaveBeenCalledWith(league.leagueId, { fixtureCode: EARLIER.fixtureCode, playerCode: SAKA.code });
    expect((await screen.findByText(overrideRemovedWords)).getAttribute("role")).toBe("status");
    expect(app.playerCard.override).not.toHaveBeenCalled();
  });

  it("says why the server refused", async () => {
    const refusal = "His points in that match aren't overridden.";
    openCard(managerIn(commissioned), { cards: [{ ...SAKA, matches: [{ ...MATCH, override: { points: 1, reason: REASON } }] }], overrideRefusal: refusal });
    await userEvent.click(await screen.findByRole("button", { name: OVERRIDE_TITLE }));
    await userEvent.click(removeButton()!);

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
    expect(screen.queryByText(overrideRemovedWords)).toBeNull();
  });
});

it("a match the league overrode shows the override's points, and why, to everyone in it", async () => {
  openCard(manager, { cards: [{ ...SAKA, matches: [{ ...MATCH, override: { points: 12.5, reason: REASON } }] }] });
  const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
  const row = season.getAllByRole("rowheader")[0].closest("tr")!;

  // In the game log, what he scored before it with its reason on hover; in the breakdown, why.
  const points = within(row).getAllByRole("cell").at(-1)!;
  expect(points.textContent).toBe(`${overriddenWasWords(7)}12.5`);
  expect(within(points).getByTitle(REASON)).toBeTruthy();
  expect(screen.getByText(overriddenWords(12.5, REASON))).toBeTruthy();
});

// The card is live (livePlayerCard.ts), so its matches can change while it is open: the form keeps
// to one still on the card.
describe("as the open card changes", () => {
  const LATER: PlayedMatch = { ...MATCH, fixtureCode: 51, gameweek: 5 };
  const seam = fakePlayerCard();
  const form = (card: PlayerCard) => <OverridePoints leagueId={league.leagueId} card={card} selected={MATCH.fixtureCode} seam={seam} />;

  it("is offered once his first match appears", () => {
    const view = render(form({ ...SAKA, matches: [] }));
    expect(overrideButton()).toBeNull();

    view.rerender(form({ ...SAKA, matches: [MATCH] }));
    expect(overrideButton()).toBeTruthy();
  });

  it("falls back to his first match when the one picked leaves the card, and sends that", async () => {
    const view = render(form(SAKA));
    await userEvent.click(screen.getByRole("button", { name: OVERRIDE_TITLE }));
    await userEvent.selectOptions(screen.getByLabelText(overrideLabels.match), overrideMatchWords(3, "COV", "ARS"));

    view.rerender(form({ ...SAKA, matches: [LATER, MATCH] }));
    expect((screen.getByLabelText(overrideLabels.match) as HTMLSelectElement).value).toBe(String(LATER.fixtureCode));
    await userEvent.type(screen.getByLabelText(overrideLabels.points), "3");
    await userEvent.type(screen.getByLabelText(overrideLabels.reason), REASON);
    await userEvent.click(screen.getByRole("button", { name: overrideWords }));

    expect(seam.override).toHaveBeenCalledWith(league.leagueId, { fixtureCode: LATER.fixtureCode, playerCode: SAKA.code, points: 3, reason: REASON });
  });
});
