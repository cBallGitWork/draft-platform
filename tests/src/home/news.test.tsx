// League home's News tab (#1356; docs/design/approved/home/, The News tab): every team's moves,
// newest first, with Team and Kind filters, Older moves paging back, the commissioner's latest
// letter pinned on top, and the selected move's detail on the right. Overview's More, on News opens it.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { HOME_NEWS_PATH, HOME_PATH, MAIL_PATH } from "../../../src/frame/menu";
import { menuWords } from "../../../src/frame/words";
import type { LeagueNews } from "../../../src/home/seam";
import {
  everyKindWords,
  fromTeamWords,
  gotWords,
  kindFilterLabel,
  letGoWords,
  leftToWords,
  moreOnNewsLink,
  newsKindWords,
  newsTableLabel,
  NEWS_TITLE,
  noNewsWords,
  olderMovesWords,
  teamFilterLabel,
} from "../../../src/home/words";
import { newsMove, quietNews, type HomeData } from "../../support/src/home.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const openNews = (home: HomeData = {}) => openApp(HOME_NEWS_PATH, manager, { home });
const rows = async () => within(await screen.findByRole("table", { name: newsTableLabel })).getAllByRole("row").slice(1);

const claim = newsMove(3_000, "Team 1", { kind: "playerClaimed", joined: { playerCode: 1, playerName: "Mbeumo" }, left: { playerCode: 2, playerName: "Livramento" }, toWaivers: true });
const moved = newsMove(2_000, "Team 2", { kind: "playerMoved", joined: { playerCode: 3, playerName: "Konsa" }, fromTeamId: "team-Team 1" as Id<"teams">, fromTeamName: "Team 1" });
const older = newsMove(1_000, "Team 2", { kind: "playerReleased", joined: null, left: { playerCode: 4, playerName: "Eze" } });
const pages = ({ before }: { before: LeagueNews["older"] }): LeagueNews =>
  before === null ? { ...quietNews, moves: [claim, moved], older: { at: moved.at, filed: moved.filed } } : { ...quietNews, moves: [older] };

describe("reaching it", () => {
  it("opens from Home's News tab, and from Overview's More, on News", async () => {
    const app = openApp(HOME_PATH, manager, { home: { news: pages } });
    await userEvent.click(await screen.findByRole("link", { name: moreOnNewsLink }));
    expect(await screen.findByRole("heading", { level: 1, name: NEWS_TITLE })).toBeTruthy();
    expect(app.path()).toBe(HOME_NEWS_PATH);
    await userEvent.click(screen.getByRole("link", { name: menuWords.overview }));
    expect(app.path()).toBe(HOME_PATH);
    await userEvent.click(screen.getByRole("link", { name: menuWords.news }));
    expect(app.path()).toBe(HOME_NEWS_PATH);
    expect(app.home.useLeagueNews.mock.lastCall).toEqual([league.leagueId, { before: null, teamId: null, kind: null }]);
  });

  it("says so when no move has been made", async () => {
    openNews();
    expect(await screen.findByText(noNewsWords)).toBeTruthy();
  });
});

describe("the moves", () => {
  it("lists each, newest first, with its kind, team, who came in and went out, and the team a moved player came from", async () => {
    openNews({ news: pages });
    expect((await rows()).slice(0, 2).map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent).slice(1))).toEqual([
      [newsKindWords.playerClaimed, "Mbeumo", "Livramento", ""],
      [newsKindWords.playerMoved, "Konsa", "", fromTeamWords("Team 1")],
    ]);
  });

  it("Older moves reads the next page, below the last move shown", async () => {
    const app = openNews({ news: pages });
    await userEvent.click(await screen.findByRole("button", { name: olderMovesWords }));
    expect((await rows()).map((row) => within(row).getByRole("rowheader").textContent)).toEqual(["Team 1", "Team 2", "Team 2"]);
    expect(app.home.useLeagueNews.mock.lastCall?.[1]).toEqual({ before: { at: moved.at, filed: moved.filed }, teamId: null, kind: null });
    expect(screen.queryByRole("button", { name: olderMovesWords })).toBeNull();
  });

  it("the Team and Kind filters ask for that team's and that kind's moves", async () => {
    const app = openNews({ news: pages });
    const filter = (name: string) => screen.findByRole("combobox", { name });
    await userEvent.selectOptions(await filter(teamFilterLabel), "Team 2");
    await userEvent.selectOptions(await filter(kindFilterLabel), newsKindWords.playerMoved);
    expect(app.home.useLeagueNews.mock.lastCall?.[1]).toEqual({ before: null, teamId: "team-Team 2", kind: "playerMoved" });
    await userEvent.selectOptions(await filter(kindFilterLabel), everyKindWords);
    expect(app.home.useLeagueNews.mock.lastCall?.[1]).toEqual({ before: null, teamId: "team-Team 2", kind: null });
  });
});

describe("the detail", () => {
  it("shows the newest move until another is selected, and the selected one after", async () => {
    openNews({ news: pages });
    const detail = await screen.findByRole("region", { name: newsKindWords.playerClaimed });
    expect(within(detail).getByText(gotWords("Team 1"))).toBeTruthy();
    expect(within(detail).getByText(letGoWords("Team 1"))).toBeTruthy();
    expect(within(detail).getByText(leftToWords(true), { exact: false })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Team 2" }));
    const movedDetail = await screen.findByRole("region", { name: newsKindWords.playerMoved });
    expect(within(movedDetail).getByText(gotWords("Team 2"))).toBeTruthy();
    expect(within(movedDetail).getByText(fromTeamWords("Team 1"), { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Team 2" }).getAttribute("aria-pressed")).toBe("true");
  });
});

it("pins the commissioner's latest letter on top, opening Mail", async () => {
  const app = openNews({ news: () => ({ ...quietNews, pinnedLetter: { at: 1_000, from: "commish@example.com", subject: "Christmas break", body: "GW17 to GW19 are off" } }) });
  await userEvent.click(await screen.findByRole("link", { name: /Christmas break/ }));
  expect(app.path()).toBe(MAIL_PATH);
});
