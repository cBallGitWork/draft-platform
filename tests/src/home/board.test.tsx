// League home's board, as its approved picture lays it out (#387; docs/design/approved/home/1440.png):
// the league's title plate and the deadline strip; Mail and News on the left; Your matchup at the top
// of the centre; and on the right, the recap and the panels still to come, each in its place, folding
// on its ▾. The head-to-heads, the table and matchday mode are home.test.tsx's.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import { HOME_NEWS_PATH, HOME_PATH, MAIL_PATH, MATCHUP_PATH, MY_TEAM_PATH } from "../../../src/frame/menu";
import type { LeagueHome } from "../../../src/home/seam";
import {
  foldLabel,
  LETTER_TITLE,
  MAIL_TITLE,
  mailViews,
  moreOnNewsLink,
  needsYouToComeWords,
  NEWS_PANEL_TITLE,
  noMovesWords,
  openMatchupLink,
  premierLeagueTitle,
  recapTitle,
  recapToComeWords,
  RUN_LEAGUE_TITLE,
  scoreToComeLabel,
  setLineupLink,
  SQUAD_NEWS_TITLE,
  standingWords,
  stripBoxes,
  stripLabel,
  TABLE_TITLE,
  toComeLabel,
  unfoldLabel,
} from "../../../src/home/words";
import { scoreWords } from "../../../src/matchup/words";
import { formLabel } from "../../../src/shared/words";
import { gameweekOneRecap, homeFixture, homeRow, quietHome, type HomeData } from "../../support/src/home.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const openHome = (home: HomeData = {}) => openApp(HOME_PATH, manager, { home });
const withHome = (change: Partial<LeagueHome>, rest: HomeData = {}) => openHome({ ...rest, leagueHome: { ...quietHome, ...change } });
const panel = (title: string | RegExp) => screen.findByRole("region", { name: title });
const follows = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("the title plate and the deadline strip", () => {
  it("titles the board with the league and this gameweek, and the strip's boxes are outlines until their grill", async () => {
    withHome({ thisGameweek: { gameweek: 9, fixtures: [homeFixture("Team 1", "Team 2")], byes: [] } });
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(`${league.name}GW9`);
    const strip = screen.getByRole("list", { name: stripLabel });
    expect(within(strip).getAllByRole("listitem").map((box) => box.textContent)).toEqual([...stripBoxes(9)]);
    expect(within(strip).getAllByRole("img").map((box) => box.getAttribute("aria-label"))).toEqual(stripBoxes(9).map(toComeLabel));
  });

  it("with no gameweek drawn, has neither the gameweek nor the strip", async () => {
    withHome({ format: "totalPoints", thisGameweek: null });
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(league.name);
    expect(screen.queryByRole("list", { name: stripLabel })).toBeNull();
  });
});

describe("Mail", () => {
  const letter: LetterSummary = { letterId: "letter-1" as Id<"letters">, leagueName: league.name, at: Date.now(), from: null, subject: "Set your lineup", body: "GW1 locks soon.", read: false };

  it("lists the newest letters, each opening in Mail; Needs you holds a line until its grill", async () => {
    const app = withHome({}, { mail: { letters: [letter], unread: 1 } });
    const mail = await panel(MAIL_TITLE);
    expect(within(mail).getByText("Set your lineup")).toBeTruthy();

    await userEvent.click(within(mail).getByRole("radio", { name: mailViews.needsYou }));
    expect(within(mail).getByText(needsYouToComeWords)).toBeTruthy();
    expect(within(mail).queryByText("Set your lineup")).toBeNull();

    await userEvent.click(within(mail).getByRole("radio", { name: mailViews.all }));
    await userEvent.click(within(mail).getByRole("link", { name: /Set your lineup/ }));
    expect(app.path()).toBe(MAIL_PATH);
  });
});

describe("News", () => {
  it("pins the commissioner's latest letter on top, opening Mail", async () => {
    const app = withHome({ pinnedLetter: { at: Date.now(), from: "commish@example.com", subject: "Draft night", body: "Friday at eight." } });
    const pinned = within(await panel(NEWS_PANEL_TITLE)).getAllByRole("link")[0];
    expect(within(pinned).getByText(LETTER_TITLE)).toBeTruthy();
    expect(within(pinned).getByText("Draft night")).toBeTruthy();

    await userEvent.click(pinned);
    expect(app.path()).toBe(MAIL_PATH);
  });

  it("lists the latest moves, newest first, each with its kind, and More, on News opens the News tab", async () => {
    const app = withHome({
      squadMoves: [
        { at: Date.now(), kind: "playerReleased", playerName: "Rice", teamName: "Bob's", fromTeamName: null },
        { at: Date.now() - 1, kind: "playerMoved", playerName: "Palmer", teamName: "Bob's", fromTeamName: "Ann's" },
        { at: Date.now() - 2, kind: "playerAssigned", playerName: "Saka", teamName: "Ann's", fromTeamName: null },
      ],
    });
    const news = await panel(NEWS_PANEL_TITLE);
    const rows = within(news).getAllByRole("listitem");
    expect(rows.map((row) => row.firstChild?.firstChild?.textContent)).toEqual(["Released", "Moved", "Assigned"]);
    expect(rows.map((row) => row.lastChild?.textContent)).toEqual(["Rice was released by Bob's", "Palmer moved from Ann's to Bob's", "Saka joined Ann's"]);

    await userEvent.click(within(news).getByRole("link", { name: moreOnNewsLink }));
    expect(app.path()).toBe(HOME_NEWS_PATH);
  });

  it("says so when there are no moves, and no letter is pinned", async () => {
    openHome();
    const news = await panel(NEWS_PANEL_TITLE);
    expect(within(news).getByText(noMovesWords)).toBeTruthy();
    expect(within(news).queryByText(LETTER_TITLE)).toBeNull();
  });
});

describe("Your matchup", () => {
  const yourMatchup = () => panel(/^Your matchup/);
  const table = [homeRow(1, "Ann's", { points: 9, form: ["won", "won", "won"] }), homeRow(2, "Bob's", { points: 6, form: ["won", "won", "lost"], mine: true })];

  it("before it begins, puts the reader's side first, an outline for the score, and Set lineup opens Tactics", async () => {
    const app = withHome({ table, thisGameweek: { gameweek: 4, fixtures: [homeFixture("Ann's", "Bob's")], byes: [] } });
    const matchup = await yourMatchup();
    expect(follows(within(matchup).getByText("Bob's"), within(matchup).getByText("Ann's"))).toBe(true);
    expect(within(matchup).getByText(standingWords(2, 6))).toBeTruthy();
    expect(within(matchup).getByLabelText(formLabel(["won", "won", "lost"]))).toBeTruthy();
    expect(within(matchup).getByRole("img", { name: scoreToComeLabel })).toBeTruthy();

    await userEvent.click(within(matchup).getByRole("link", { name: setLineupLink }));
    expect(app.path()).toBe(MY_TEAM_PATH);
  });

  it("once begun, shows the score from the reader's side, with no Set lineup, and opens the matchup", async () => {
    const app = withHome({ table, thisGameweek: { gameweek: 4, fixtures: [homeFixture("Ann's", "Bob's", { team: 41, opponent: 22 })], byes: [] } });
    const matchup = await yourMatchup();
    expect(within(matchup).getByText(scoreWords(22, 41))).toBeTruthy();
    expect(within(matchup).queryByRole("link", { name: setLineupLink })).toBeNull();

    await userEvent.click(within(matchup).getByRole("link", { name: openMatchupLink }));
    expect(app.path()).toBe(MATCHUP_PATH);
  });

  it("isn't there for someone with no head-to-head this gameweek", async () => {
    withHome({ format: "totalPoints", thisGameweek: null });
    await panel(TABLE_TITLE);
    expect(screen.queryByRole("region", { name: /^Your matchup/ })).toBeNull();
  });
});

describe("the right-hand column", () => {
  it("holds the Premier League, the recap to come and Your squad news as outlines in their places, each folding on its ▾", async () => {
    openHome();
    const premierLeague = await panel(premierLeagueTitle(1));
    expect(within(premierLeague).getAllByRole("img", { name: toComeLabel(premierLeagueTitle(1)) }).length).toBeGreaterThan(0);
    const recap = await panel(recapTitle(1));
    expect(within(recap).getByText(recapToComeWords(1))).toBeTruthy();
    expect(follows(premierLeague, recap)).toBe(true);
    expect(follows(recap, await panel(SQUAD_NEWS_TITLE))).toBe(true);

    await userEvent.click(within(recap).getByRole("button", { name: foldLabel(recapTitle(1)) }));
    expect(within(recap).queryByText(recapToComeWords(1))).toBeNull();
    await userEvent.click(within(recap).getByRole("button", { name: unfoldLabel(recapTitle(1)) }));
    expect(within(recap).getByText(recapToComeWords(1))).toBeTruthy();
  });

  it("shows the recap once written, in place of its outline", async () => {
    withHome({ recap: gameweekOneRecap });
    expect(within(await panel(recapTitle(1))).queryByText(recapToComeWords(1))).toBeNull();
  });

  it("has Run the league for whoever runs it", async () => {
    openApp(HOME_PATH, commissioner);
    expect(await panel(RUN_LEAGUE_TITLE)).toBeTruthy();
  });

  it("has no Run the league for a manager", async () => {
    openHome();
    await panel(TABLE_TITLE);
    expect(screen.queryByRole("region", { name: RUN_LEAGUE_TITLE })).toBeNull();
  });
});
