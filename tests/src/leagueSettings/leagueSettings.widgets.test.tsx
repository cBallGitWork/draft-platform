// League settings' right-hand widgets (#2503; docs/design/approved/settings/, README "Interaction
// notes"): the Fixtures tab's Gameweeks, marking the scoring start (spec/04, After the draft), and
// the Draft tab's The draft, its rounds the squad's most players (spec/04, The picks); and (#2504)
// the Trades tab's In review, the Draft order tab's Round 2 and the Squad tab's Formation presets.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import type { Id } from "../../../convex/_generated/dataModel";
import { DRAFT_PATH, TRADES_PATH } from "../../../src/frame/menu";
import { gameweeksPath } from "../../../src/gameweeks/paths";
import { weeklySeason } from "../../../src/gameweeks/weeklySeason";
import { GAMEWEEKS_SHOWN } from "../../../src/leagueSettings/SettingsWidgets";
import {
  draftOrderLinkWords,
  draftRoomWords,
  draftWidgetTitle,
  editGameweeksWords,
  gameweeksWidgetTitle,
  inReviewWidgetTitle,
  noneInReviewWords,
  noScoresWords,
  notUsedWords,
  presetsWidgetTitle,
  roundTwoWidgetTitle,
  scoringStartsWords,
  SETTINGS_TITLE,
  teamOrderTitle,
  tradesLinkWords,
} from "../../../src/leagueSettings/words";
import { TEAMS_IN_ORDER } from "../../support/src/leagueSettings.harness";
import { notSetWords } from "../../../src/shared/words";
import { openedOn, openedSettings, openTab, SETTINGS_PAGE } from "../../support/src/leagueSettingsScreen.harness";
import { adminSeeing, league, openApp } from "../../support/src/shell.harness";

const widget = (title: string) => screen.getByRole("region", { name: title });
const gameweekRows = () => within(widget(gameweeksWidgetTitle)).getAllByRole("listitem");
/** A season whose gameweek 10 kicks off in an hour, so 1 to 9 have begun, with 14 unticked. */
const upcomingSeason = weeklySeason(Date.now() + HOUR_MS - 9 * WEEK_MS, [14]);
const ticked = upcomingSeason.filter(({ used }) => used).map(({ gameweek, deadline }) => ({ gameweek, deadline }));

describe("the Gameweeks widget (#2503)", () => {
  it("S04.12: lists the gameweeks from the next not begun, the ones before the scoring start scoring nothing, the start marked and an unticked one not used", async () => {
    await openedSettings({ gameweeks: upcomingSeason, scoringStart: { start: 11, ticked, seasonBegun: false } });

    expect(gameweekRows()).toHaveLength(GAMEWEEKS_SHOWN);
    expect(gameweekRows().map((row) => row.textContent)).toEqual([
      expect.stringMatching(new RegExp(`^GW10.*${noScoresWords}$`)),
      expect.stringMatching(new RegExp(`^GW11.*${scoringStartsWords}$`)),
      expect.stringMatching(/^GW12[^A-Za-z]*[A-Za-z]{3} \d+ [A-Za-z]{3}, \d\d:\d\d$/),
      expect.stringMatching(/^GW13/),
      expect.stringMatching(new RegExp(`^GW14.*${notUsedWords}$`)),
      expect.stringMatching(/^GW15/),
      expect.stringMatching(/^GW16/),
    ]);
    expect(within(widget(gameweeksWidgetTitle)).getByRole("link", { name: editGameweeksWords }).getAttribute("href")).toBe(gameweeksPath(league.leagueId));
  });

  it("S04.12: marks nothing when no scoring start is set", async () => {
    await openedSettings({ gameweeks: upcomingSeason, scoringStart: { start: null, ticked, seasonBegun: false } });

    expect(within(widget(gameweeksWidgetTitle)).queryByText(scoringStartsWords)).toBeNull();
    expect(within(widget(gameweeksWidgetTitle)).queryByText(noScoresWords)).toBeNull();
  });
});

describe("The draft widget (#2503)", () => {
  it("S04.18: shows the start, the rounds as the squad's most players, picks as rounds times teams, and the teams", async () => {
    await openedOn("draft", { draftStart: { rounds: 15, teams: 8 } });

    const facts = within(widget(draftWidgetTitle));
    expect(facts.getAllByRole("definition").map((value) => value.textContent)).toEqual([notSetWords, "15", "120", "8"]);
  });

  it("S04.18: with no squad size limit, shows no rounds and no picks", async () => {
    await openedOn("draft", { draftStart: { rounds: null, teams: 8 } });

    expect(within(widget(draftWidgetTitle)).getAllByRole("definition").map((value) => value.textContent)).toEqual([notSetWords, "—", "—", "8"]);
  });

  it("S04.18: links to the draft room, and Draft order › opens the Draft order tab", async () => {
    await openedOn("draft");

    expect(within(widget(draftWidgetTitle)).getByRole("link", { name: draftRoomWords }).getAttribute("href")).toBe(DRAFT_PATH);
    await userEvent.click(within(widget(draftWidgetTitle)).getByRole("button", { name: draftOrderLinkWords }));
    expect(screen.getByRole("region", { name: teamOrderTitle })).toBeTruthy();
  });

  it("S04.18: leaves the draft room out for a league the app isn't in, whose draft room it would not open", async () => {
    openApp(SETTINGS_PAGE, adminSeeing(league), { leagueSettings: {} });
    await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
    await openTab("draft");

    expect(within(widget(draftWidgetTitle)).queryByRole("link", { name: draftRoomWords })).toBeNull();
  });
});

const inReview = (offerId: string, opens: boolean) => ({
  offerId: offerId as Id<"tradeOffers">,
  fromTeamName: "Kroos Control",
  toTeamName: "Rovers XI",
  reviewEndsAt: Date.now() + HOUR_MS,
  opens,
});

describe("the In review widget (#2504)", () => {
  it("S08.30: lists every trade in review with its end, one the commissioner reviews or is in opening on Trades, and links to Trades", async () => {
    await openedOn("trades", { tradesInReview: [inReview("offer-1", true), inReview("offer-2", false)] });

    const rows = within(widget(inReviewWidgetTitle)).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Kroos Control ⇄ Rovers XIEnds /),
      expect.stringMatching(/^Kroos Control ⇄ Rovers XIEnds /),
    ]);
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe(`${TRADES_PATH}?offer=offer-1`);
    expect(within(rows[1]).queryByRole("link")).toBeNull();
    expect(within(widget(inReviewWidgetTitle)).getByRole("link", { name: tradesLinkWords }).getAttribute("href")).toBe(TRADES_PATH);
  });

  it("S08.30: with none in review, says so and still links to Trades", async () => {
    await openedOn("trades");

    expect(within(widget(inReviewWidgetTitle)).getByText(noneInReviewWords)).toBeTruthy();
    expect(within(widget(inReviewWidgetTitle)).getByRole("link", { name: tradesLinkWords })).toBeTruthy();
  });
});

describe("the Round 2 widget (#2504)", () => {
  it("S04.18: lists the draft order backwards, the snake's second round", async () => {
    await openedOn("draftOrder");

    expect(within(widget(roundTwoWidgetTitle)).getAllByRole("listitem").map((row) => row.textContent)).toEqual(
      TEAMS_IN_ORDER.toReversed().map(({ name }, place) => `${place + 1}${name}`),
    );
  });
});

describe("the Formation presets widget (#2504)", () => {
  it("S03.10: lists the league's presets by name, with how many", async () => {
    await openedOn("squad", { presetNames: ["4-4-2", "4-3-3"] });

    expect(within(widget(presetsWidgetTitle)).getAllByRole("listitem").map((row) => row.textContent)).toEqual(["4-4-2", "4-3-3"]);
    expect(within(widget(presetsWidgetTitle)).getByText("2")).toBeTruthy();
  });
});
