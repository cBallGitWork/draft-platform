// My team's header band (src/myTeam/header/TeamHeader.tsx; the approved Tactics picture): the
// team's name, the deadline and its countdown, the opponent then, the last result, the form and the
// table place, from the league's table and fixtures.

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formLabel, deadlineHead, meterListLabel, formHead, gameweekShort, placeWords, pointsShort, tableHead, versusWords } from "../../../../src/myTeam/header/words";
import { MATCHUP_PATH } from "../../../../src/frame/menu";
import { idOf, leagueTableOf } from "../../../../src/table/drawnTable";
import { league } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK } from "../../../support/src/tactics.harness";
import { SAVED, openTacticsTab } from "../../../support/src/tacticsScreen.harness";

const ME = league.teamName!;
const TEAMS = [ME, "Rovers XI", "Kroos Control", "Pique Blinders"];
/** Eight gameweeks scored, the manager's team scoring most, so every game is a win. */
const POINTS: Record<string, number> = { [ME]: 54, "Rovers XI": 41, "Kroos Control": 47, "Pique Blinders": 30 };
const scores = new Map(Array.from({ length: TACTICS_GAMEWEEK - 1 }, (_, index) => [index + 1, new Map(TEAMS.map((team) => [team, POINTS[team]]))]));
const TABLE = leagueTableOf(TEAMS, { scores });

/** The band's readings, by their heads. */
const meter = (head: string) => within(screen.getByRole("group", { name: meterListLabel })).getByText(head).nextElementSibling!;

describe("My team's header band", () => {
  it("reads the team's opponent, last result, form and table place from the league's table", async () => {
    const app = openTacticsTab({ tactics: SAVED, leagueTable: TABLE });
    expect(await screen.findByRole("heading", { level: 1, name: ME })).toBeTruthy();
    expect(app.myTeam.useLeagueTable).toHaveBeenCalledWith(league.leagueId);

    const opponent = TABLE.gameweeks.find(({ gameweek }) => gameweek === TACTICS_GAMEWEEK)!.fixtures.find(({ team, opponent }) => team === ME || opponent === ME)!;
    const name = opponent.team === ME ? opponent.opponent! : opponent.team;
    const link = within(meter(versusWords) as HTMLElement).getByRole("link");
    expect(link.textContent).toContain(name);
    expect(link.getAttribute("href")).toContain(MATCHUP_PATH);
    expect(new URLSearchParams(link.getAttribute("href")!.split("?")[1]).get("team")).toBe(idOf(ME));

    expect(within(meter(gameweekShort(TACTICS_GAMEWEEK - 1)) as HTMLElement).getByText(/^Won 54–/)).toBeTruthy();
    expect(within(meter(formHead) as HTMLElement).getByRole("img").getAttribute("aria-label")).toBe(formLabel(["won", "won", "won", "won", "won"]));
    expect(meter(tableHead).textContent).toBe(`${placeWords(1)}, ${pointsShort(TABLE.table[0].points)}`);
  });

  it("in total points, shows the deadline and the last gameweek's points, with no opponent or form", async () => {
    openTacticsTab({ tactics: { ...SAVED, deadline: Date.now() + 1000 * 60 * 60 }, leagueTable: leagueTableOf(TEAMS, { scores, format: "totalPoints" }) });
    expect(await screen.findByText(deadlineHead(TACTICS_GAMEWEEK))).toBeTruthy();
    expect(screen.queryByText(formHead)).toBeNull();
    expect(screen.queryByText(versusWords)).toBeNull();
    expect(meter(gameweekShort(TACTICS_GAMEWEEK - 1)).textContent).toBe(pointsShort(54));
  });
});
