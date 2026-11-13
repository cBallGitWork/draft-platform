// League home's board, as its approved picture lays it out (#387; docs/design/approved/home/1440.png):
// Mail and News on the left; Your matchup at the top of the centre; and on the right, the Premier
// League's gameweek, the recap and Your squad news, each folding on its ▾. The title plate and the
// deadline strip are deadlineStrip.test.tsx's; the head-to-heads, the table and matchday mode
// home.test.tsx's.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import { DAY_MS } from "../../../convex/shared/time";
import { HOME_NEWS_PATH, HOME_PATH, MAIL_PATH, MATCHUP_PATH, MY_TEAM_PATH, PREMIER_LEAGUE_PATH } from "../../../src/frame/menu";
import { playerCardPath } from "../../../src/playerCard/paths";
import { matchPath } from "../../../src/premierLeague/paths";
import {
  allFixturesLink,
  foldLabel,
  LETTER_TITLE,
  loadingWords,
  MAIL_TITLE,
  mailViews,
  moreOnNewsLink,
  needsYouToComeWords,
  NEWS_PANEL_TITLE,
  noMatchesWords,
  noMovesWords,
  noSquadNewsWords,
  openMatchupLink,
  premierLeagueTitle,
  recapTitle,
  recapToComeWords,
  RUN_LEAGUE_TITLE,
  scoreToComeLabel,
  setLineupLink,
  SQUAD_NEWS_TITLE,
  standingWords,
  TABLE_TITLE,
  themWords,
  toComeLabel,
  unfoldLabel,
  weekdayTimeWords,
  youWords,
} from "../../../src/home/words";
import { scoreWords } from "../../../src/matchup/words";
import { formLabel } from "../../../src/shared/words";
import { gameweekOneRecap, homeFixture, homeRow, quietYours } from "../../support/src/home.harness";
import { openHome, withHome } from "../../support/src/homeScreen.harness";
import { commissioner, league, manager, openApp, panel } from "../../support/src/shell.harness";
const follows = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

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

  it("keeps the board up, and Needs you chosen, while the next minute's league home loads (#1534)", async () => {
    const app = withHome({}, { mail: { letters: [letter], unread: 1 } });
    await userEvent.click(within(await panel(MAIL_TITLE)).getByRole("radio", { name: mailViews.needsYou }));

    app.home.useLeagueHome.mockReturnValue(undefined);
    app.becomes({ ...manager });
    await waitFor(() => expect(app.home.useLeagueHome).toHaveLastReturnedWith(undefined));

    expect(screen.queryByText(loadingWords)).toBeNull();
    expect((within(await panel(MAIL_TITLE)).getByRole("radio", { name: mailViews.needsYou }) as HTMLInputElement).checked).toBe(true);
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

  it("lists a trade as one line naming both sides, a pick by the team whose pick it is (#1491)", async () => {
    withHome({
      squadMoves: [
        {
          at: Date.now(),
          kind: "tradeMade",
          fromTeamName: "Ann's",
          toTeamName: "Bob's",
          gives: { players: [{ playerCode: 1, playerName: "Saka" }], picks: [] },
          gets: { players: [{ playerCode: 2, playerName: "Palmer" }, { playerCode: 3, playerName: "Rice" }], picks: [] },
        },
        {
          at: Date.now() - 1,
          kind: "tradeMade",
          fromTeamName: "Ann's",
          toTeamName: "Bob's",
          gives: { players: [], picks: [{ round: 4, teamId: "team-1" as Id<"teams">, teamName: "Pickford Pirates" }] },
          gets: { players: [], picks: [{ round: 2, teamId: "team-2" as Id<"teams">, teamName: "Bob's" }] },
        },
      ],
    });
    const rows = within(await panel(NEWS_PANEL_TITLE)).getAllByRole("listitem");
    expect(rows.map((row) => row.firstChild?.firstChild?.textContent)).toEqual(["Trade", "Trade"]);
    expect(rows.map((row) => row.lastChild?.textContent)).toEqual([
      "Ann's traded Saka to Bob's for Palmer and Rice",
      "Ann's traded Pickford Pirates' round 4 pick to Bob's for Bob's round 2 pick",
    ]);
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
  it("holds the Premier League, the recap to come, its outline's words written in it, and Your squad news in their places, each folding on its ▾", async () => {
    openHome();
    const premierLeague = await panel(premierLeagueTitle(1));
    expect(within(premierLeague).getByText(noMatchesWords)).toBeTruthy();
    const recap = await panel(recapTitle(1));
    expect(within(recap).getByText(recapToComeWords(1))).toBeTruthy();
    expect(within(recap).getByRole("img", { name: toComeLabel(recapTitle(1)) }).textContent).toBe(toComeLabel(recapTitle(1)));
    expect(follows(premierLeague, recap)).toBe(true);
    expect(follows(recap, await panel(SQUAD_NEWS_TITLE))).toBe(true);

    await userEvent.click(within(recap).getByRole("button", { name: foldLabel(recapTitle(1)) }));
    expect(within(recap).queryByText(recapToComeWords(1))).toBeNull();
    await userEvent.click(within(recap).getByRole("button", { name: unfoldLabel(recapTitle(1)) }));
    expect(within(recap).getByText(recapToComeWords(1))).toBeTruthy();
  });

  it("lists this gameweek's matches with the reader's players or his opponent's, each opening its page, and All fixtures the Premier League (#1976)", async () => {
    const kickoff = Date.now() + DAY_MS;
    const club = (code: number, shortName: string) => ({ code, name: shortName, shortName });
    const match = { fixtureCode: 501, kickoff, home: club(3, "ARS"), away: club(54, "FUL"), you: ["Saka", "Rice"], them: ["Raya"] };
    const app = withHome({ yours: { ...quietYours, premierLeague: [match, { ...match, fixtureCode: 502, home: club(43, "MCI"), away: club(8, "CHE"), you: [], them: ["Dias"] }] } });
    const premierLeague = await panel(premierLeagueTitle(1));
    expect(within(premierLeague).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      `ARS v FUL${weekdayTimeWords(kickoff)}${youWords} Saka, Rice${themWords} Raya`,
      `MCI v CHE${weekdayTimeWords(kickoff)}${themWords} Dias`,
    ]);
    expect(within(premierLeague).getByRole("link", { name: allFixturesLink }).getAttribute("href")).toBe(PREMIER_LEAGUE_PATH);
    await userEvent.click(within(premierLeague).getByRole("link", { name: "ARS v FUL" }));
    expect(app.path()).toBe(matchPath(501));
  });

  it("lists Your squad news, FPL's note word for word, each name opening his card; and says when there is none (#1976)", async () => {
    withHome({ yours: { ...quietYours, squadNews: [{ playerCode: 10, name: "Saka", news: "Knock - 75% chance of playing", chanceOfPlaying: 75 }] } });
    const news = await panel(SQUAD_NEWS_TITLE);
    expect(within(news).getByRole("listitem").textContent).toBe("SakaKnock - 75% chance of playing");
    expect(within(news).getByRole("link", { name: "Saka" }).getAttribute("href")).toBe(playerCardPath(league.leagueId, 10));
  });

  it("says when the squad has no news", async () => {
    openHome();
    expect(within(await panel(SQUAD_NEWS_TITLE)).getByText(noSquadNewsWords)).toBeTruthy();
  });

  it("has no Premier League or squad news for someone running no team", async () => {
    withHome({ yours: null });
    await panel(TABLE_TITLE);
    expect(screen.queryByRole("region", { name: SQUAD_NEWS_TITLE })).toBeNull();
    expect(screen.queryByRole("region", { name: premierLeagueTitle(1) })).toBeNull();
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
