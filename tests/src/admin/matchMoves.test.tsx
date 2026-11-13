// Moving a match on the admin's dashboard (#1417; spec/07 S07.9), and his log of moves (spec/15).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { matchMoveRefusals, matchMoveWarnings } from "../../../convex/gameweeks/matchMoves";
import { ADMIN_PATH } from "../../../src/admin/paths";
import type { GameweekMatch } from "../../../src/admin/seam";
import {
  clearMoveLabel,
  moreMovesWords,
  movedFromWords,
  moveGameweekLabel,
  moveLogTitle,
  moveLogWords,
  moveMatchTitle,
  moveToLabel,
  moveWords,
  noGameweekMatchesWords,
  noMovesWords,
} from "../../../src/admin/words";
import type { AdminData } from "../../support/src/admin.harness";
import { admin, openApp } from "../../support/src/shell.harness";

const openDashboard = (data: AdminData = {}) => openApp(ADMIN_PATH, admin, { admin: data });

const ARSENAL_SPURS: GameweekMatch = { fixtureCode: 141, match: "Arsenal v Spurs", kickoff: Date.parse("2026-12-05T15:00:00Z"), move: null };
const CHELSEA_FULHAM: GameweekMatch = { fixtureCode: 142, match: "Chelsea v Fulham", kickoff: null, move: { unmoved: 13 } };

async function showGameweek(gameweek: string) {
  const panel = await screen.findByRole("region", { name: moveMatchTitle });
  await userEvent.type(within(panel).getByRole("spinbutton", { name: moveGameweekLabel }), gameweek);
  return panel;
}

async function moveTo(panel: HTMLElement, match: GameweekMatch, gameweek: string) {
  await userEvent.type(within(panel).getByRole("spinbutton", { name: moveToLabel(match.match) }), gameweek);
  const row = within(panel).getByRole("spinbutton", { name: moveToLabel(match.match) }).closest("li")!;
  await userEvent.click(within(row).getByRole("button", { name: moveWords }));
}

describe("moving a match", () => {
  it("lists the gameweek typed's matches, marking the one he moved in", async () => {
    const app = openDashboard({ gameweekMatches: [ARSENAL_SPURS, CHELSEA_FULHAM] });
    const panel = await showGameweek("14");
    expect(app.admin.useGameweekMatches).toHaveBeenLastCalledWith(14);
    const rows = within(within(panel).getByRole("list", { name: moveMatchTitle })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining(ARSENAL_SPURS.match), expect.stringContaining(movedFromWords(13))]);
    expect(rows[0].textContent).not.toContain(movedFromWords(13));
  });

  it("asks for no gameweek until one is typed, and says so when one has no matches", async () => {
    const app = openDashboard();
    const panel = await screen.findByRole("region", { name: moveMatchTitle });
    expect(app.admin.useGameweekMatches).toHaveBeenLastCalledWith(null);
    await showGameweek("40");
    expect(within(panel).getByText(noGameweekMatchesWords)).toBeTruthy();
  });

  it("moves a match to the gameweek typed, and shows the server's deadline warnings", async () => {
    const app = openDashboard({ gameweekMatches: [ARSENAL_SPURS] });
    const warning = matchMoveWarnings.past(15, ["Pro League"]);
    app.admin.moveMatch.mockResolvedValueOnce({ warnings: [warning] });
    const panel = await showGameweek("14");
    await moveTo(panel, ARSENAL_SPURS, "15");

    expect(app.admin.moveMatch).toHaveBeenCalledExactlyOnceWith(ARSENAL_SPURS.fixtureCode, 15);
    expect((await within(panel).findByText(warning)).getAttribute("role")).toBe("status");
  });

  it("clears his move of a match he moved, and offers no clear for one he hasn't", async () => {
    const app = openDashboard({ gameweekMatches: [ARSENAL_SPURS, CHELSEA_FULHAM] });
    const panel = await showGameweek("14");
    expect(within(panel).queryByRole("button", { name: clearMoveLabel(ARSENAL_SPURS.match) })).toBeNull();
    await userEvent.click(within(panel).getByRole("button", { name: clearMoveLabel(CHELSEA_FULHAM.match) }));
    expect(app.admin.moveMatch).toHaveBeenCalledExactlyOnceWith(CHELSEA_FULHAM.fixtureCode, null);
  });

  it("shows why a move was refused", async () => {
    const app = openDashboard({ gameweekMatches: [ARSENAL_SPURS] });
    app.admin.moveMatch.mockResolvedValueOnce(matchMoveRefusals.dropped);
    const panel = await showGameweek("14");
    await moveTo(panel, ARSENAL_SPURS, "15");
    expect((await screen.findByRole("alert")).textContent).toBe(matchMoveRefusals.dropped);
  });
});

describe("his log of moves", () => {
  it("lists each move and clear, newest first, each match named", async () => {
    const at = Date.parse("2026-11-12T10:00:00Z");
    openDashboard({
      moveLog: {
        rows: [
          { fixtureCode: 142, match: "Chelsea v Fulham", from: 15, to: null, at },
          { fixtureCode: 142, match: "Chelsea v Fulham", from: 14, to: 15, at: at - 1 },
        ],
        more: true,
      },
    });
    const panel = await screen.findByRole("region", { name: moveLogTitle });
    const rows = within(within(panel).getByRole("list", { name: moveLogTitle })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining(moveLogWords({ from: 15, to: null })),
      expect.stringContaining(moveLogWords({ from: 14, to: 15 })),
    ]);
    expect(within(panel).getByText(moreMovesWords(2))).toBeTruthy();
  });

  it("says when no match has been moved", async () => {
    openDashboard({ moveLog: { rows: [], more: false } });
    const panel = await screen.findByRole("region", { name: moveLogTitle });
    expect(within(panel).getByText(noMovesWords)).toBeTruthy();
  });
});
