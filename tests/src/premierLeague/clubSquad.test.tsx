// A club page's Squad tab (#1937; spec/18 `S18.8`): the club's players in the server's order,
// grouped GK, DEF, MID, AM, FWD, no position last, each row with his position chips, who holds him, his points, his last five gameweeks, his
// starts and minutes, and a greyed doubt chip; a row opens his card. And its header's top three
// scorers (`S18.7`). The read itself is tested in tests/convex/scouting/clubSquad.test.ts.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { playerCardPath } from "../../../src/playerCard/paths";
import { clubPath } from "../../../src/premierLeague/paths";
import type { ClubPageData, ClubSquad, SquadPlayer } from "../../../src/premierLeague/seam";
import {
  clubTabWords,
  freeAgentWords,
  noSeasonPointsWords,
  noSquadWords,
  statusNotSettledLabel,
  topScorersHead,
  waiversWords,
} from "../../../src/premierLeague/words";
import { POSITION_NAMES } from "../../../src/shared/words";
import { ARSENAL, type PremierLeagueData } from "../../support/src/premierLeague.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const arsenal: ClubPageData = { club: ARSENAL, position: 1, form: [], next: null, fixtures: [] };

/** A row of Arsenal's squad, held by nobody and doubted by nobody unless `rest` says. */
const squadPlayer = (code: number, name: string, group: SquadPlayer["group"], positions: SquadPlayer["positions"], rest: Partial<SquadPlayer> = {}): SquadPlayer => ({
  code,
  name,
  fullName: name,
  positions,
  group,
  ownerTeamName: null,
  onWaivers: false,
  seasonPoints: null,
  lastGameweeks: [null, null, null, null, null],
  starts: 0,
  minutes: 0,
  chanceOfPlaying: null,
  ...rest,
});

const squad: ClubSquad = {
  gameweeks: [4, 5, 6, 7, 8],
  pointsSeason: null,
  players: [
    squadPlayer(3, "Raya", "GK", ["GK"], { seasonPoints: 30, lastGameweeks: [6, 1, null, 2, 6], starts: 8, minutes: 720 }),
    squadPlayer(2, "Rice", "DEF", ["CB", "CM"], { onWaivers: true, seasonPoints: 25 }),
    squadPlayer(1, "Saka", "AM", ["W", "ST"], { ownerTeamName: "Saka Potatoes", seasonPoints: 42, chanceOfPlaying: 75 }),
    squadPlayer(9, "Trialist", null, []),
  ],
  topScorers: [
    { code: 1, name: "Saka", seasonPoints: 42 },
    { code: 3, name: "Raya", seasonPoints: 30 },
    { code: 2, name: "Rice", seasonPoints: 25 },
  ],
};

const openClub = (premierLeague: PremierLeagueData) => openApp(clubPath(ARSENAL.code), manager, { premierLeague: { club: arsenal, ...premierLeague } });
const squadPanel = () => screen.findByRole("region", { name: clubTabWords.squad });

describe("the Squad tab", () => {
  it("shows first, its players grouped GK, DEF, MID, AM, FWD with no position last, each row's owner, points, last five, starts and minutes", async () => {
    const app = openClub({ squad });
    const panel = await squadPanel();
    expect(app.premierLeague.useClubSquad).toHaveBeenLastCalledWith(league.leagueId, ARSENAL.code);
    const lines = within(panel)
      .getAllByRole("row")
      .slice(1)
      .map((row) => [...row.children].map((cell) => cell.textContent));
    // The server's order groups them; the position chips mark the groups, with no band rows.
    expect(lines).toEqual([
      ["GK", "Raya", freeAgentWords, "30", "6", "1", "—", "2", "6", "8", "720"],
      ["CBCM", "Rice", waiversWords, "25", "—", "—", "—", "—", "—", "0", "0"],
      ["WST", "Saka", "Saka Potatoes", "42", "—", "—", "—", "—", "—", "0", "0"],
      ["—", "Trialist", freeAgentWords, "—", "—", "—", "—", "—", "—", "0", "0"],
    ]);
    expect(within(panel).getAllByTitle(POSITION_NAMES.CB)).toHaveLength(1);
    expect(within(panel).getByRole("columnheader", { name: /GW4/ })).toBeTruthy();
  });

  it("greys a doubt chip's place only where FPL holds a doubt about him", async () => {
    openClub({ squad });
    const chips = within(await squadPanel()).getAllByRole("img", { name: statusNotSettledLabel });
    expect(chips).toHaveLength(1);
    expect(chips[0].closest("tr")!.textContent).toContain("Saka");
  });

  it("opens a player's card from his row, and the tab has no buttons of its own", async () => {
    const app = openClub({ squad });
    const panel = await squadPanel();
    expect(within(panel).queryAllByRole("button")).toHaveLength(0);
    await userEvent.click(within(panel).getAllByRole("row")[1].querySelectorAll("td")[1]);
    expect(app.path()).toBe(playerCardPath(league.leagueId, 3));
  });

  it("says why points are '—', naming last season's before the first match", async () => {
    openClub({ squad: { ...squad, pointsSeason: 2025 } });
    const panel = await squadPanel();
    expect(within(panel).getByRole("columnheader", { name: /Pts 25\/26/ })).toBeTruthy();
    const trialist = within(panel).getAllByRole("row").at(-1)!;
    expect(trialist.querySelectorAll("td")[2].getAttribute("title")).toBe(noSeasonPointsWords(2025));
  });

  it("says so when no players are held at the club", async () => {
    openClub({ squad: { ...squad, players: [], topScorers: [] } });
    expect(within(await squadPanel()).getByText(noSquadWords)).toBeTruthy();
  });
});

describe("the top scorers", () => {
  it("names the club's top three under its form, most points first, each opening his card", async () => {
    openClub({ squad });
    const scorers = within((await screen.findByText(topScorersHead)).nextElementSibling as HTMLElement).getAllByRole("listitem");
    expect(scorers.map((scorer) => scorer.textContent)).toEqual(["Saka 42", "Raya 30", "Rice 25"]);
    expect(within(scorers[0]).getByRole("link").getAttribute("href")).toBe(playerCardPath(league.leagueId, 1));
  });

  it("shows '—' for a club whose players have no points", async () => {
    openClub({ squad: { ...squad, topScorers: [] } });
    expect((await screen.findByText(topScorersHead)).nextElementSibling!.textContent).toBe("—");
  });
});
