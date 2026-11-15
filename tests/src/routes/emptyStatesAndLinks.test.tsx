// The regression catalogue's screens-and-routes cases, part 3, at the Integration level (#2307): what
// each screen says while it has nothing to show, or nothing yet; and the E2E cases whose state the
// dev server's preview can't hold (a pre-season League home, a draft starting tomorrow, a deletion
// undone, a trade-offer letter), here on the whole app with its fake seams. Each test's name carries
// its case ID and the spec or design line it checks. The rest of the E2E cases are in
// tests/smoke/emptyStatesAndLinks.spec.ts.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { screenMoment } from "../../../convex/shared/moments";
import { HOUR_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { BOARD_TITLE, clockHead, emptyQueueWords, inWords, loadingWords as draftLoadingWords, QUEUE_TITLE, startsHead, stateWords, youPickHead } from "../../../src/draft/words";
import { DRAFT_PATH, MAIL_PATH, MY_TEAM_PATH, MY_TEAM_TRANSACTIONS_PATH, TRADES_PATH } from "../../../src/frame/menu";
import { ERROR_PAGE_TITLE, signOutWords } from "../../../src/frame/words";
import { headToHeadsLabel, noResultsWords as homeNoResultsWords, TABLE_TITLE as HOME_TABLE_TITLE } from "../../../src/home/words";
import { joinFailedWords } from "../../../src/joining/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { confirmDeleteWords, deleteLeagueWords, undoWords } from "../../../src/leagues/words";
import { mailTabsLabel, mailTabWords, noLetterOpenWords, noLettersWords, noUnreadWords } from "../../../src/mail/words";
import { noClaimsWords } from "../../../src/myTeam/claims/words";
import { noTransactionsWords } from "../../../src/myTeam/words";
import { noClubsWords, TABLE_TITLE as PL_TABLE_TITLE } from "../../../src/premierLeague/words";
import { availabilityWords, noneMatchWords, positionLabel } from "../../../src/scouting/words";
import { POSITION_NAMES } from "../../../src/shared/words";
import { gameweekShort } from "../../../src/shared/when/words";
import { leagueTableOf } from "../../../src/table/drawnTable";
import { fixturesListLabel, gameweekWords, noResultsWords } from "../../../src/table/words";
import { noClosedWords, noOffersWords } from "../../../src/trades/words";
import type { DraftState } from "../../../src/draft/seam";
import { draftOrder, emptyBoard } from "../../support/src/draft.harness";
import { openHome } from "../../support/src/homeScreen.harness";
import { mailLetter } from "../../support/src/mailScreen.harness";
import { openSection } from "../../support/src/premierLeagueScreen.harness";
import { namesShown, openScouting } from "../../support/src/scoutingScreen.harness";
import { beingDeleted, commissioned, deleterOf, league, manager, managerIn, newcomer, openApp, panel, yourLeaguesHeading } from "../../support/src/shell.harness";
import { openTable } from "../../support/src/tableScreen.harness";
import { MY_TEAM_NAME, THEIR_TEAM_NAME } from "../../support/src/teams.harness";
import { quietTrades } from "../../support/src/trades.harness";

/** The header's reading under `head`. */
const fact = (head: string) => screen.getByText(head, { selector: "dt" }).nextElementSibling?.textContent;

describe("empty states", () => {
  it("UI-144 (S13.1): a newcomer whose invite couldn't be taken up at sign-in is signed in, and told to open the invite link again", async () => {
    openApp(LEAGUES_PATH, newcomer, { joining: { endedInvite: { leagueName: league.name, ended: "joinFailed", reason: null } } });
    expect(await yourLeaguesHeading()).toBeTruthy();
    expect(screen.getByText(joinFailedWords)).toBeTruthy();
    expect(screen.getByRole("button", { name: signOutWords })).toBeTruthy();
  });

  it("UI-145 (src/mail/words.ts:12, 41-42): a manager with no letters is told so, Unread says none is unread, and no letter is open", async () => {
    openApp(MAIL_PATH, manager);
    expect(await screen.findByText(noLettersWords)).toBeTruthy();
    expect(screen.getByText(noLetterOpenWords)).toBeTruthy();
    await userEvent.click(within(screen.getByRole("group", { name: mailTabsLabel })).getByRole("button", { name: mailTabWords(0).unread }));
    expect(screen.getByText(noUnreadWords)).toBeTruthy();
    expect(screen.getByText(noLetterOpenWords)).toBeTruthy();
  });

  it("UI-146 (src/scouting/words.ts:91): Owned at a position nobody owned plays says no player matches, and the filters still work", async () => {
    openScouting();
    await userEvent.click(await screen.findByRole("radio", { name: availabilityWords.owned }));
    const position = screen.getByRole("combobox", { name: positionLabel });
    await userEvent.selectOptions(position, POSITION_NAMES.GK);
    expect(screen.getByText(noneMatchWords)).toBeTruthy();

    await userEvent.selectOptions(position, POSITION_NAMES.W);
    expect(namesShown()).toEqual(["Saka"]);
    expect(screen.queryByText(noneMatchWords)).toBeNull();
  });

  it("UI-147 (src/premierLeague/words.ts:49): a new season with no clubs or fixtures synced says there is no table, never an error page", async () => {
    openSection({ standings: { rows: [], provisional: false, liveGameweek: null }, firstKickoffs: [], matches: {} });
    expect(within(await panel(PL_TABLE_TITLE)).getByText(noClubsWords)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: ERROR_PAGE_TITLE })).toBeNull();
  });

  it("UI-148 (src/trades/words.ts:50, 71): Trades with no offer open or closed says so for both", async () => {
    openApp(TRADES_PATH, manager, { trades: { view: { ...quietTrades, closed: [] } } });
    expect(await screen.findByText(noOffersWords)).toBeTruthy();
    expect(screen.getByText(noClosedWords)).toBeTruthy();
  });

  it("UI-149 (src/myTeam/words.ts:108, src/myTeam/claims/words.ts:19): a new team's Transactions says none yet, and no pending claims", async () => {
    openApp(MY_TEAM_TRANSACTIONS_PATH, manager);
    expect(await screen.findByText(noTransactionsWords)).toBeTruthy();
    expect(screen.getByText(noClaimsWords)).toBeTruthy();
  });

  // The approved pre-season picture (1440-pre-season.png) doesn't bind until its grill settles what
  // its panels hold (approved/home README:15-16), so what is checked is plate.md's rule alone: no
  // made-up result before anything is played. #2307 says so.
  it("UI-151 (plate.md:141-146): League home before the draft shows no made-up result: every head-to-head unscored, and the table says nothing is scored", async () => {
    openHome();
    const table = await panel(HOME_TABLE_TITLE);
    expect(within(table).getByText(homeNoResultsWords)).toBeTruthy();
    for (const row of within(table).getAllByRole("row").slice(1)) expect(within(row).getAllByRole("cell")[3].textContent).toBe("—");
    const headToHeads = within(screen.getByRole("list", { name: headToHeadsLabel(gameweekShort(1)) })).getAllByRole("listitem");
    expect(headToHeads.map((headToHead) => headToHead.textContent)).toEqual([`${MY_TEAM_NAME}v${THEIR_TEAM_NAME}`]);
  });

  it("UI-153 (approved/draft-room README:13, src/draft/words.ts:102): a draft starting tomorrow at 19:00 shows the order drawn, his pick, the countdown, and an empty queue", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startsAt = tomorrow.setHours(19, 0, 0, 0);
    const before = Date.now();
    const draft: DraftState = { status: "waiting", startsAt, rounds: 2, order: draftOrder };
    openApp(DRAFT_PATH, manager, { draft: { draft, board: emptyBoard, lists: { queue: [], doNotDraft: [] } } });
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain(stateWords.waiting);
    expect(within(await panel(BOARD_TITLE)).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Rd", "Team 1", "Team 2, you", "Team 3"]);
    expect(fact(youPickHead)).toBe("2nd, then 5th");
    expect(fact(clockHead)).toBeTruthy();
    // The countdown goes by the minute's start (useMinute), so each bound is floored to its minute.
    const minuteOf = (at: number) => at - (at % MINUTE_MS);
    expect([inWords(startsAt - minuteOf(before)), inWords(startsAt - minuteOf(Date.now()))]).toContain(fact(startsHead(screenMoment(startsAt))));
    expect(within(await panel(new RegExp(`^${QUEUE_TITLE}`))).getByText(emptyQueueWords)).toBeTruthy();
  });

  it("UI-155 (approved/table README:52-56): before GW1, every team is on 0 points and the fixtures read v, with no score to click", async () => {
    const teams = ["Ann's", "Bob's", "Cat's", "Dan's"];
    const drawn = leagueTableOf(teams, { deadlineOf: (gameweek) => Date.now() + gameweek * WEEK_MS + HOUR_MS });
    openTable({ leagueTable: drawn });
    expect(await screen.findByText(noResultsWords)).toBeTruthy();
    const rows = within(screen.getAllByRole("table")[0]).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[8].textContent)).toEqual(teams.map(() => "0"));
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(1) })).toBeTruthy();
    const fixtures = screen.getByRole("list", { name: fixturesListLabel(1) });
    expect(within(fixtures).getAllByRole("listitem").map((item) => item.textContent)).toEqual(drawn.gameweeks[0].fixtures.map(({ team, opponent }) => `${team}v${opponent}`));
    // A fixture's "v" may open its matchup ahead (README:52-53 has each score open it); no score is there to click.
    expect(within(fixtures).queryAllByRole("link").map((link) => link.textContent)).not.toContainEqual(expect.stringMatching(/\d/));
  });
});

describe("loading", () => {
  it("UI-158 (src/draft/words.ts:12): the draft room says it is loading, with no clock and nothing to pick, until it has loaded", async () => {
    openApp(DRAFT_PATH, manager, { draft: { loading: true } });
    expect((await screen.findByRole("status")).textContent).toBe(draftLoadingWords);
    const main = screen.getByRole("main");
    expect(within(main).queryByText(clockHead)).toBeNull();
    expect(within(main).queryAllByRole("button")).toEqual([]);
  });
});

describe("interaction notes", () => {
  it("UI-187 (approved/leagues README:25, spec/13 Deleting): the commissioner deletes L1, then Undo on its row puts it back for its managers", async () => {
    const app = openApp(LEAGUES_PATH, managerIn(commissioned));
    await userEvent.click(await screen.findByRole("button", { name: deleteLeagueWords }));
    await userEvent.click(screen.getByRole("button", { name: confirmDeleteWords.yes }));
    expect(app.leagues.deleteLeague).toHaveBeenCalledExactlyOnceWith(league.leagueId);

    app.becomes(deleterOf(beingDeleted(commissioned)));
    await userEvent.click(await screen.findByRole("button", { name: undoWords }));
    expect(app.leagues.undoDeletion).toHaveBeenCalledExactlyOnceWith(league.leagueId);
    app.becomes(managerIn(commissioned));
    expect(await screen.findByRole("button", { name: deleteLeagueWords })).toBeTruthy();
    cleanup();

    openApp(MY_TEAM_PATH, manager);
    expect(await screen.findByRole("heading", { level: 1, name: league.teamName! })).toBeTruthy();
  });

  // A letter holds no link on main: its one link, to where you act on it, isn't built (#2361).
  // Marked to fail until it is.
  it.fails("UI-189 (approved/mail README:44, spec/16): a trade-offer letter ends with its one link, opening the offer in Trades", async () => {
    const app = openApp(MAIL_PATH, manager, { letters: [mailLetter(1, false, null, "trade")] });
    await userEvent.click(await screen.findByRole("button", { name: /Letter 1/ }));
    const open = screen.getByRole("region", { name: /From/ });
    const links = within(open).getAllByRole("link");
    expect(links).toHaveLength(1);
    await userEvent.click(links[0]);
    expect(app.path()).toBe(TRADES_PATH);
    expect(app.search()).toMatch(/^\?offer=/);
  });
});
