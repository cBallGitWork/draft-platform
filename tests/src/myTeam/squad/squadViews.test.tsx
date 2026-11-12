// My team's Squad tab's Schedule and Rules views (#1006; spec/12, My team's tabs; Craig's answers on
// #1006, 6 Nov 2026). The view picker itself: squadWidgets.test.tsx.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SquadLimit } from "../../../../convex/squads/squadRulesView";
import {
  blankWeekWords,
  noScheduleWords,
  openPanelLabel,
  rulesTableLabel,
  scheduleTableLabel,
  squadViewWords,
  squadTableLabel,
} from "../../../../src/myTeam/squad/words";
import { ARSENAL, CHELSEA } from "../../../support/convex/footballRows.harness";
import { cells, KICKOFF, openSquad, PALMER, RAYA, SAKA, squadOf } from "../../../support/src/squadTab.harness";
import type { TeamSquad } from "../../../../src/myTeam/seam";

const DAY = 24 * 60 * 60 * 1000;
const showView = async (squad: TeamSquad, view: "schedule" | "rules") => {
  openSquad({ squad });
  await screen.findByRole("table", { name: squadTableLabel("Team 1") });
  await userEvent.click(screen.getByRole("radio", { name: squadViewWords[view] }));
};
const bodyRows = (name: string) => within(screen.getByRole("table", { name })).getAllByRole<HTMLTableRowElement>("row").slice(1);

describe("the Schedule view", () => {
  it("heads a column for each of the next six gameweeks, an empty cell in a blank week and both matches in a double", async () => {
    const saka = {
      ...SAKA,
      schedule: [
        { gameweek: 10, kickoff: KICKOFF, opponent: CHELSEA, home: true },
        { gameweek: 12, kickoff: KICKOFF + 14 * DAY, opponent: CHELSEA, home: false },
        { gameweek: 12, kickoff: KICKOFF + 17 * DAY, opponent: CHELSEA, home: true },
      ],
    };
    await showView(squadOf([saka]), "schedule");
    const table = screen.getByRole("table", { name: scheduleTableLabel("Team 1") });
    expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Pos", "Player", "GW10", "GW11", "GW12", "GW13", "GW14", "GW15"]);
    const [row] = bodyRows(scheduleTableLabel("Team 1"));
    expect(cells(row).slice(2)).toEqual(["CHE (H)", blankWeekWords, "CHE (A)CHE (H)", blankWeekWords, blankWeekWords, blankWeekWords]);
  });

  it("stops at the gameweeks the server sends, as near the season's end", async () => {
    await showView({ ...squadOf([SAKA]), scheduleGameweeks: [37, 38] }, "schedule");
    const table = screen.getByRole("table", { name: scheduleTableLabel("Team 1") });
    expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Pos", "Player", "GW37", "GW38"]);
  });

  it("says so with no gameweek left to set", async () => {
    await showView({ ...squadOf([SAKA]), scheduleGameweeks: [] }, "schedule");
    expect(screen.getByText(noScheduleWords)).toBeTruthy();
  });

  it("opens his season panel from his row, as the Stats view does", async () => {
    await showView(squadOf([SAKA, PALMER]), "schedule");
    await userEvent.click(screen.getByRole("button", { name: openPanelLabel("Palmer") }));
    expect(screen.getByRole("region", { name: "Palmer" })).toBeTruthy();
  });
});

describe("the Rules view", () => {
  const limits: SquadLimit[] = [
    { kind: "size", players: [SAKA.code, PALMER.code, RAYA.code], count: 3, minimum: 2, maximum: 2 },
    { kind: "area", area: "goalkeeper", players: [RAYA.code], minimum: 2 },
    { kind: "area", area: "attackingMidfield", players: [SAKA.code, PALMER.code], minimum: 1 },
    { kind: "club", club: ARSENAL, players: [SAKA.code, RAYA.code], maximum: 3 },
  ];

  it("holds one row per limit, naming the players each counts, and flags a row the squad is outside with how far out", async () => {
    await showView({ ...squadOf([SAKA, PALMER, RAYA], 9, [], 2), limits }, "rules");
    expect(bodyRows(rulesTableLabel("Team 1")).map(cells)).toEqual([
      ["Squad size", "3", "2 to 2", "1 over", "Saka, Palmer, Raya"],
      ["Goalkeeper", "1", "at least 2", "1 short", "Raya"],
      ["Attacking midfield", "2", "at least 1", "", "Saka, Palmer"],
      [`From ${ARSENAL.name}`, "2", "at most 3", "", "Saka, Raya"],
    ]);
  });

  it("flags a club over its maximum, and counts a player the football sync no longer holds without a name", async () => {
    const over: SquadLimit[] = [
      { kind: "size", players: [SAKA.code], count: 2, minimum: 3, maximum: 5 },
      { kind: "club", club: ARSENAL, players: [SAKA.code, RAYA.code], maximum: 1 },
    ];
    await showView({ ...squadOf([SAKA, RAYA], 9, [99]), limits: over }, "rules");
    expect(bodyRows(rulesTableLabel("Team 1")).map(cells)).toEqual([
      ["Squad size", "2", "3 to 5", "1 short", "Saka, and 1 not held"],
      [`From ${ARSENAL.name}`, "2", "at most 1", "1 over", "Saka, Raya"],
    ]);
  });
});
