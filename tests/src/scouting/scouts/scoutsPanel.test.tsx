// Scouting's Scouts panel (#375, spec/19 Scouts; Craig, 6 Nov 2026, answer 4; the approved Scouting
// picture): each of the team's three scouts out with the time left, back with a report in, or free,
// then the team's other reports; Read › opens one above the shortlist, where Scout him again sends a
// scout to him and Player card › opens his card. Someone who runs no team has no scouts.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS, DAY_MS, MINUTE_MS } from "../../../../convex/shared/time";
import { SCOUTING_PATH } from "../../../../src/frame/menu";
import { playerCardPath } from "../../../../src/playerCard/paths";
import type { MyScouts } from "../../../../src/scouting/scouts/seam";
import {
  closeReportLabel,
  earlierReportWords,
  freeScoutWords,
  outOnWords,
  readNamedLabel,
  reportInOnWords,
  reportTitle,
  reportsListLabel,
  scoutAgainWords,
  SCOUTS_TITLE,
  scoutsOutWords,
  writtenWords,
} from "../../../../src/scouting/scouts/words";
import type { ScoutsData } from "../../../support/src/scouts.harness";
import { league, manager, openApp } from "../../../support/src/shell.harness";

const PALMER = 4;
const WOOD = 7;
const SAKA = 9;
const now = Date.now();
const WOOD_REPORT = { playerCode: WOOD, name: "Wood", sentAt: now - 2 * DAY_MS, writtenAt: now - DAY_MS, text: "A natural target man." };
const SAKA_REPORT = { playerCode: SAKA, name: "Saka", sentAt: now - 9 * DAY_MS, writtenAt: now - 8 * DAY_MS, text: "Starts every week." };
const MINE: MyScouts = {
  scouts: 3,
  out: [{ playerCode: PALMER, name: "Palmer", sentAt: now - 10 * HOUR_MS, dueAt: now + 14 * HOUR_MS + 30 * MINUTE_MS }],
  reports: [WOOD_REPORT, SAKA_REPORT],
};

const openScouting = (scouts: ScoutsData, session = manager) => openApp(SCOUTING_PATH, session, { scouting: { scouts } });
const scoutsPanel = () => screen.findByRole("region", { name: SCOUTS_TITLE });

describe("the Scouts panel", () => {
  it("shows each scout: out with the time left, back with the newest report in, or free", async () => {
    const app = openScouting({ mine: MINE });
    const panel = await scoutsPanel();
    expect(panel.textContent).toContain(scoutsOutWords(1, 3));
    const rows = within(within(panel).getByRole("list", { name: SCOUTS_TITLE })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain(outOnWords("Palmer"));
    expect(rows[0].textContent).toContain("report in 14h 29m");
    expect(rows[1].textContent).toContain(reportInOnWords("Wood"));
    expect(rows[2].textContent).toContain(reportInOnWords("Saka"));
    expect(app.scouting.useMyScouts.mock.lastCall).toEqual([league.leagueId]);
  });

  it("says a scout with nothing to do is free", async () => {
    openScouting({ mine: { scouts: 3, out: [], reports: [WOOD_REPORT] } });
    const rows = within(await scoutsPanel()).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent?.includes(freeScoutWords))).toEqual([false, true, true]);
  });

  it("lists the team's earlier reports under the scouts", async () => {
    openScouting({ mine: { ...MINE, scouts: 2 } });
    const earlier = within(await scoutsPanel()).getByRole("list", { name: reportsListLabel });
    expect(within(earlier).getAllByRole("listitem").map((row) => row.textContent)).toEqual([expect.stringContaining(earlierReportWords("Saka", SAKA_REPORT.writtenAt))]);
  });

  it("Read › opens the report, dated, with Scout him again and his card; ✕ closes it", async () => {
    const app = openScouting({ mine: MINE });
    await userEvent.click(within(await scoutsPanel()).getByRole("button", { name: readNamedLabel("Wood", WOOD_REPORT.writtenAt) }));
    const report = screen.getByRole("region", { name: reportTitle("Wood") });
    expect(report.textContent).toContain(writtenWords(WOOD_REPORT.writtenAt));
    expect(report.textContent).toContain(WOOD_REPORT.text);

    await userEvent.click(within(report).getByRole("button", { name: scoutAgainWords }));
    expect(app.scouting.sendScout).toHaveBeenCalledWith(league.leagueId, WOOD);

    await userEvent.click(within(report).getByRole("button", { name: closeReportLabel }));
    expect(screen.queryByRole("region", { name: reportTitle("Wood") })).toBeNull();
  });

  it("Player card › opens his card", async () => {
    const app = openScouting({ mine: MINE });
    await userEvent.click(within(await scoutsPanel()).getByRole("button", { name: readNamedLabel("Saka", SAKA_REPORT.writtenAt) }));
    await userEvent.click(within(screen.getByRole("region", { name: reportTitle("Saka") })).getByRole("link", { name: /Player card/ }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, SAKA));
  });

  it("can't send a scout again to a player one is already out on", async () => {
    openScouting({ mine: { ...MINE, out: [{ playerCode: WOOD, name: "Wood", sentAt: now, dueAt: now + DAY_MS }] } });
    await userEvent.click(within(await scoutsPanel()).getByRole("button", { name: readNamedLabel("Wood", WOOD_REPORT.writtenAt) }));
    expect(within(screen.getByRole("region", { name: reportTitle("Wood") })).getByRole("button", { name: scoutAgainWords }).hasAttribute("disabled")).toBe(true);
  });

  it("doesn't show for someone who runs no team", async () => {
    openScouting({ mine: null });
    await screen.findByRole("region", { name: "Players" });
    expect(screen.queryByRole("region", { name: SCOUTS_TITLE })).toBeNull();
  });
});
