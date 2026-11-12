// The role card (spec/05 Roles; #848; the approved role card): opened by a starter's Role ▾ or his
// role on the pitch, every role his slot offers with his stars, what it rewards and punishes in the
// site's set and his last matches played priced under it; a role previewed, then played, saves.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { rolesOfSlot } from "../../../../../convex/lineup/roles";
import { FIRST_SCORING_WITH_ROLES } from "../../../../../convex/scoring/draftedRoleAdjustments";
import { categoryName } from "../../../../../convex/scoring/categories";
import { scoreMatch } from "../../../../../convex/scoring/scoring";
import { ROLE_CHIP_MARK } from "../../../../../src/myTeam/tactics/pitch/Pitch";
import { cancelWords, lastSeasonWords, noMatchesWords, notTestedWords, playAsWords, showMatchLabel } from "../../../../../src/myTeam/tactics/roleCard/words";
import { CHELSEA } from "../../../../support/convex/footballRows.harness";
import {
  HAVERTZ,
  RAYA,
  SALIBA,
  SAVED,
  STARTERS,
  blockOf,
  openedPitch,
  roleButton,
  roleCard,
  rolesOnCard,
  roleShown,
} from "../../../../support/src/tacticsScreen.harness";

const SET = FIRST_SCORING_WITH_ROLES;
const SALIBAS_CELL = STARTERS[1];
const HAVERTZS_CELL = STARTERS[3];
/** A goal in 90 minutes away at Chelsea in gameweek 8, then 20 minutes in one of last season's. */
const GOAL = { minutes: 90, goals_scored: 1 };
const CAMEO = { minutes: 20 };
const MATCHES = [
  { stats: GOAL, set: SET, gameweek: 8, pastSeason: null, opponent: { club: CHELSEA, home: false } },
  { stats: CAMEO, set: SET, gameweek: null, pastSeason: 2025, opponent: null },
];
/** The row of the card's roles table naming `role`. */
const roleRow = (name: string, role: string) => within(roleCard(name)).getByRole("button", { name: role }).closest("tr")!;

describe("the role card (#848)", () => {
  it("opens from a starter's Role ▾ on exactly his slot's roles, the one in use marked", async () => {
    await openedPitch();
    await userEvent.click(roleButton(SALIBA.name));
    expect(rolesOnCard(SALIBA.name)).toEqual(rolesOfSlot(SALIBAS_CELL, STARTERS).map(({ name }) => name));
    expect(roleRow(SALIBA.name, "Stopper").getAttribute("aria-current")).toBe("true");
    expect(within(roleCard(SALIBA.name)).getByRole("button", { name: playAsWords("Stopper") })).toBeTruthy();
  });

  // S05.29
  it("offers only the roles he may take: a CAM up front, the false 9 alone", async () => {
    const cam = { ...HAVERTZ, positions: ["CAM" as const] };
    await openedPitch({ tactics: { ...SAVED, squad: SAVED.squad.map((each) => (each.playerCode === HAVERTZ.playerCode ? cam : each)) } });
    await userEvent.click(roleButton(HAVERTZ.name));
    expect(rolesOnCard(HAVERTZ.name)).toEqual(["False 9"]);
  });

  // S05.30
  it("marks the sweeper keeper not tested, and no role a real read has shown", async () => {
    await openedPitch();
    await userEvent.click(roleButton(RAYA.name));
    expect(roleRow(RAYA.name, "Sweeper keeper").textContent).toContain(notTestedWords);
    expect(roleRow(RAYA.name, "Shot-stopper").textContent).not.toContain(notTestedWords);
  });

  it("opens from his role on the pitch, while a tap on the rest of him opens his panel", async () => {
    await openedPitch();
    await userEvent.click(blockOf(SALIBA, SALIBAS_CELL).querySelector(`[${ROLE_CHIP_MARK}]`)!);
    expect(roleCard(SALIBA.name)).toBeTruthy();
  });

  it("says what each role rewards and punishes as the site's set scores it", async () => {
    await openedPitch();
    await userEvent.click(roleButton(SALIBA.name));
    const stopper = SET.roles!.find(({ role }) => role === "stopper")!;
    const cells = roleRow(SALIBA.name, "Stopper").cells;
    expect(cells[2].textContent).toBe(stopper.bonus.parts.map(({ stat }) => categoryName(stat, SET.ownStats)).join(", "));
    expect(cells[3].textContent).toBe(stopper.cost.parts.map(({ stat }) => categoryName(stat, SET.ownStats)).join(", "));
  });

  it("shows the role's description, and its matches under it: what the scoring gives each, against his base points", async () => {
    await openedPitch({ tactics: SAVED, cardMatches: MATCHES });
    await userEvent.click(roleButton(HAVERTZ.name));
    await userEvent.click(within(roleCard(HAVERTZ.name)).getByRole("button", { name: "Poacher" }));
    const preview = within(roleCard(HAVERTZ.name)).getByRole("region", { name: "Poacher" });
    expect(within(preview).getByText(rolesOfSlot(HAVERTZS_CELL, STARTERS)[0].description)).toBeTruthy();
    const rows = within(preview).getAllByRole<HTMLTableRowElement>("row").map((row) => Array.from(row.cells).map((cell) => cell.textContent));
    const base = scoreMatch(GOAL, SET, HAVERTZS_CELL).total!;
    const total = scoreMatch(GOAL, SET, HAVERTZS_CELL, "poacher").total!;
    expect(rows[1]).toEqual(["GW8", "CHE (A)", "90", String(base), total === base ? "0" : `+${total - base}`, String(total)]);
    expect(rows[2][0]).toBe("25/26");
    expect(rows[2][1]).toBe(lastSeasonWords);
  });

  it("a match tapped shows what earned the role's points", async () => {
    await openedPitch({ tactics: SAVED, cardMatches: MATCHES });
    await userEvent.click(roleButton(HAVERTZ.name));
    // S05.2: the role's line, with the net and each side that moved him.
    await userEvent.click(within(roleCard(HAVERTZ.name)).getByRole("button", { name: showMatchLabel("GW8") }));
    expect(within(roleCard(HAVERTZ.name)).getByText(/^Poacher:/)).toBeTruthy();
  });

  it("says when he has no matches yet", async () => {
    await openedPitch();
    await userEvent.click(roleButton(SALIBA.name));
    expect(within(roleCard(SALIBA.name)).getByText(noMatchesWords)).toBeTruthy();
  });

  it("previewing a role saves nothing, and Cancel closes it with nothing changed", async () => {
    const app = await openedPitch();
    await userEvent.click(roleButton(SALIBA.name));
    await userEvent.click(within(roleCard(SALIBA.name)).getByRole("button", { name: "Ball-playing centre-back" }));
    await userEvent.click(within(roleCard(SALIBA.name)).getByRole("button", { name: cancelWords }));
    expect(screen.queryByRole("region", { name: /his role$/ })).toBeNull();
    expect(roleShown(SALIBA.name)).toBe("Stopper");
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
  });

  it("picking a role on it changes his role and saves, and closes it", async () => {
    const app = await openedPitch();
    await userEvent.click(roleButton(SALIBA.name));
    await userEvent.click(within(roleCard(SALIBA.name)).getByRole("button", { name: "Ball-playing centre-back" }));
    await userEvent.click(within(roleCard(SALIBA.name)).getByRole("button", { name: playAsWords("Ball-playing centre-back") }));
    expect(roleShown(SALIBA.name)).toBe("Ball-playing centre-back");
    expect(screen.queryByRole("region", { name: /his role$/ })).toBeNull();
    const [, sent] = app.myTeam.lineupChanges.save.mock.lastCall!;
    expect(sent.starters.find(({ playerCode }) => playerCode === SALIBA.playerCode)?.role).toBe("ballPlayingDefender");
  });
});
