// My team's Squad tab's views and right-hand column (its approved picture,
// docs/design/approved/team-squad): the view picker, a player's season panel opened from his row,
// Your eleven, and Mail and news. The table's rows and squad numbers: squad.test.tsx.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import { MAIL_PATH, MY_TEAM_PATH } from "../../../src/frame/menu";
import { MAIL_TITLE, unreadCount } from "../../../src/mail/words";
import { playerCardPath } from "../../../src/playerCard/paths";
import {
  allMailWords,
  bestRoleNotRatedLabel,
  closePanelLabel,
  elevenBenchLabel,
  elevenPitchLabel,
  elevenPlayerLabel,
  formLabel,
  MAIL_WIDGET_TITLE,
  openPanelLabel,
  playerCardWords,
  roleLastGameweekNotSettledLabel,
  rolePointsNotSettledLabel,
  setLineupWords,
  setRoleNotSettledLabel,
  squadCountWords,
  squadTableLabel,
  squadViewWords,
  startedNotSettledLabel,
  statusNotSettledLabel,

  viewNotSettledLabel,
  YOUR_ELEVEN_TITLE,
} from "../../../src/myTeam/squad/words";
import { league } from "../../support/src/shell.harness";
import { openSquad, PALMER, RAYA, SAKA, squadOf, tacticsWith } from "../../support/src/squadTab.harness";

const WINGER = { area: "attackingMidfield", lane: "right" } as const;
const KEEPER = { area: "goalkeeper", lane: "centre" } as const;
const players = [SAKA, PALMER, RAYA];
/** Saka on the right wing and Raya in goal; Palmer on the bench. */
const lineup = tacticsWith(players, [
  [SAKA, WINGER],
  [RAYA, KEEPER],
]);
const openPanel = (name: string) => userEvent.click(screen.getByRole("button", { name: openPanelLabel(name) }));
const panelOf = (name: string) => screen.getByRole("region", { name });

const letter = (number: number, read: boolean): LetterSummary => ({
  letterId: `letter-${number}` as Id<"letters">,
  leagueName: league.name,
  at: Date.UTC(2026, 9, 10 + number, 12),
  from: null,
  subject: `Letter ${number}`,
  body: `The text of letter ${number}.`,
  read,
});
const mail = { letters: [letter(3, false), letter(2, true)], unread: 4 };

describe("the table's plate", () => {
  it("says how full the squad is against the league's maximum", async () => {
    openSquad({ squad: squadOf([SAKA, PALMER], 9, [], 2) });
    expect(await screen.findByText(squadCountWords(2, 2))).toBeTruthy();
    expect(squadCountWords(2, 2)).toBe("2 of 2, the league's maximum");
    expect(squadCountWords(19, 20)).toBe("19 of 20");
    expect(squadCountWords(19, null)).toBe("19 players");
  });

  it("switches the table's view; Schedule and Rules are placeholders until what they hold is settled", async () => {
    openSquad({ squad: squadOf([SAKA]) });
    await screen.findByRole("table", { name: squadTableLabel("Team 1") });
    expect(screen.getByRole<HTMLInputElement>("radio", { name: squadViewWords.stats }).checked).toBe(true);

    await userEvent.click(screen.getByRole("radio", { name: squadViewWords.schedule }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("img", { name: viewNotSettledLabel("schedule") })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: squadViewWords.rules }));
    expect(screen.getByRole("img", { name: viewNotSettledLabel("rules") })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: squadViewWords.stats }));
    expect(screen.getByRole("table")).toBeTruthy();
  });
});

describe("his season panel", () => {
  it("opens on top of the right-hand column from his row, marks the row, and the cross closes it", async () => {
    openSquad({ squad: squadOf(players), tactics: lineup });
    await screen.findByRole("table");
    expect(screen.queryByRole("region", { name: "Saka" })).toBeNull();

    // A tap anywhere on the row opens it, as his name does.
    await userEvent.click(screen.getByRole("button", { name: openPanelLabel("Saka") }).closest("tr")!.cells[3]);
    expect(panelOf("Saka")).toBeTruthy();
    expect(screen.getByRole("button", { name: openPanelLabel("Saka") }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: openPanelLabel("Saka") }).closest("tr")!.getAttribute("aria-current")).toBe("true");
    const column = panelOf("Saka").parentElement!;
    expect(column.firstElementChild).toBe(panelOf("Saka"));
    // Your eleven outlines him on the pitch.
    const onPitch = within(screen.getByRole("list", { name: elevenPitchLabel })).getByRole("listitem", { name: elevenPlayerLabel("Saka", "42") });
    expect(onPitch.getAttribute("aria-current")).toBe("true");

    await openPanel("Palmer");
    expect(screen.queryByRole("region", { name: "Saka" })).toBeNull();
    await userEvent.click(within(panelOf("Palmer")).getByRole("button", { name: closePanelLabel("Palmer") }));
    expect(screen.queryByRole("region", { name: "Palmer" })).toBeNull();
  });

  it("holds his season: points, his form, the positions he plays, his next matches and where he stands in the gameweek being set", async () => {
    openSquad({ squad: squadOf(players), tactics: lineup });
    await screen.findByRole("table");
    await openPanel("Saka");
    const panel = panelOf("Saka");

    expect(within(panel).getByText("ARS, No 7")).toBeTruthy();
    expect(within(within(panel).getByRole("list", { name: formLabel(5) }))
      .getAllByRole("listitem")
      .map((each) => each.textContent)).toEqual(["3", "7", "—", "12", "7"]);
    expect(within(panel).getByTitle("Winger").textContent).toBe("W");
    expect(within(panel).getByText("Starting, W right")).toBeTruthy();

    await openPanel("Palmer");
    expect(within(panelOf("Palmer")).getByText("Bench, S1")).toBeTruthy();
  });

  it("shows a placeholder for each thing not held or settled yet, never a made-up figure", async () => {
    openSquad({ squad: squadOf([{ ...SAKA, news: "Knock - 75% chance of playing", chanceOfPlaying: 75 }]) });
    await screen.findByRole("table");
    await openPanel("Saka");
    const panel = panelOf("Saka");

    for (const label of [startedNotSettledLabel, rolePointsNotSettledLabel, bestRoleNotRatedLabel, roleLastGameweekNotSettledLabel, setRoleNotSettledLabel, statusNotSettledLabel]) {
      expect(within(panel).getByRole("img", { name: label })).toBeTruthy();
    }
    // FPL's news is held, so it shows beside the chip that waits.
    expect(within(panel).getByText("Knock - 75% chance of playing")).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: /role/i })).toBeNull();
  });

  it("shows FPL's news without a chip when FPL holds no doubt, as his row does", async () => {
    openSquad({ squad: squadOf([{ ...SAKA, news: "Joined on loan" }]) });
    await screen.findByRole("table");
    await openPanel("Saka");
    expect(within(panelOf("Saka")).getByText("Joined on loan")).toBeTruthy();
    expect(screen.queryByRole("img", { name: statusNotSettledLabel })).toBeNull();
  });

  it("opens his player card", async () => {
    const app = openSquad({ squad: squadOf([SAKA]) });
    await screen.findByRole("table");
    await openPanel("Saka");
    await userEvent.click(within(panelOf("Saka")).getByRole("link", { name: playerCardWords }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, SAKA.code));
  });

  it("moves Mail and news under the table while it is open", async () => {
    openSquad({ squad: squadOf([SAKA]), mail });
    await screen.findByRole("table");
    const mailPanel = () => screen.getByRole("region", { name: MAIL_WIDGET_TITLE });
    const eleven = () => screen.getByRole("region", { name: YOUR_ELEVEN_TITLE });
    expect(mailPanel().parentElement).toBe(eleven().parentElement);

    await openPanel("Saka");
    expect(mailPanel().parentElement).not.toBe(eleven().parentElement);
    expect(mailPanel().parentElement!.contains(screen.getByRole("table"))).toBe(true);
  });
});

describe("Your eleven", () => {
  it("shows the lineup being set on the pitch and the bench in order, each with his season points", async () => {
    openSquad({ squad: squadOf(players), tactics: lineup });
    const pitch = await screen.findByRole("list", { name: elevenPitchLabel });
    expect(within(pitch).getAllByRole("listitem", { name: /points this season/ }).map((each) => each.getAttribute("aria-label"))).toEqual([
      elevenPlayerLabel("Saka", "42"),
      elevenPlayerLabel("Raya", "42"),
    ]);
    const bench = screen.getByRole("list", { name: elevenBenchLabel });
    expect(within(bench).getAllByRole("listitem").map((each) => each.getAttribute("aria-label"))).toEqual([elevenPlayerLabel("Palmer", "—")]);
    expect(within(bench).getByText("S1")).toBeTruthy();
  });

  it("names the formation when the eleven stand in one of the league's presets", async () => {
    const preset = { name: "1-0-0-0-0-1", cells: [WINGER, KEEPER] };
    openSquad({ squad: squadOf(players), tactics: { ...lineup, presets: [preset] } });
    const eleven = await screen.findByRole("region", { name: YOUR_ELEVEN_TITLE });
    expect(within(eleven).getByText(/^1-0-0-0-0-1, /)).toBeTruthy();
  });

  it("Set lineup opens the Tactics tab", async () => {
    const app = openSquad({ squad: squadOf(players), tactics: lineup });
    await userEvent.click(await screen.findByRole("link", { name: new RegExp(setLineupWords) }));
    expect(app.path()).toBe(MY_TEAM_PATH);
  });
});

describe("Mail and news", () => {
  it("lists the newest letters, unread ones marked, with Mail's unread count", async () => {
    openSquad({ squad: squadOf([SAKA]), mail });
    const widget = await screen.findByRole("region", { name: MAIL_WIDGET_TITLE });
    expect(within(widget).getByText(unreadCount(4))).toBeTruthy();
    const links = within(within(widget).getByRole("list")).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([expect.stringContaining("Unread: Letter 3"), expect.not.stringContaining("Unread")]);
  });

  it("a letter opens it in Mail", async () => {
    const app = openSquad({ squad: squadOf([SAKA]), mail });
    const widget = await screen.findByRole("region", { name: MAIL_WIDGET_TITLE });
    await userEvent.click(within(widget).getByRole("link", { name: /Letter 3/ }));
    expect(app.path()).toBe(MAIL_PATH);
    expect(app.search()).toBe("?letter=letter-3");
    expect(await screen.findByRole("heading", { level: 1, name: MAIL_TITLE })).toBeTruthy();
  });

  it("All mail opens Mail", async () => {
    const app = openSquad({ squad: squadOf([SAKA]), mail });
    const widget = await screen.findByRole("region", { name: MAIL_WIDGET_TITLE });
    await userEvent.click(within(widget).getByRole("link", { name: new RegExp(allMailWords) }));
    expect(app.path()).toBe(MAIL_PATH);
    expect(app.search()).toBe("");
  });
});
