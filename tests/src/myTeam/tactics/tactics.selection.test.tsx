// The Tactics tab's Selection table and toolbar (the approved Tactics picture; plate.md, Tables and
// panels): each row's position chip, next fixture, role fit, role and points; the bench's places and
// best roles; data not held yet as its placeholder; the Formation keys and the formation window.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { contrast } from "../../../../convex/football/clubColours";
import { DAY_MS } from "../../../../convex/shared/time";
import { FORMATION_KEYS, keyedPresets } from "../../../../src/myTeam/tactics/TacticsControls";
import { backGroups } from "../../../../src/myTeam/tactics/formationWindow/formationGroups";
import { previewLabel } from "../../../../src/myTeam/tactics/formationWindow/words";
import { benchBestRole, placeOf, presetInUse } from "../../../../src/myTeam/tactics/lineupDraft";
import {
  allFormationsWords,
  BEST_ROLE_HEAD,
  nextPlaceholder,
  pitchTitle,
  presetLabel,
  roleFitPlaceholder,
  squadTableLabel,
} from "../../../../src/myTeam/tactics/words";
import { nextFixtureLong, whenWords } from "../../../../src/myTeam/words";
import type { TeamSquad } from "../../../../src/myTeam/seam";
import { FIRST_RULES } from "../../../../convex/rules/firstRules";
import { colorToken } from "../../../support/src/colorTokens";
import { openTactics } from "../../../support/src/tactics.harness";
import { ARRIZABALAGA, HAVERTZ, RAYA, SAVED, SQUAD, STARTERS, WHITE, member, openedPitch, rowOf, type Member } from "../../../support/src/tacticsScreen.harness";

const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
const KICKOFF = Date.now() + 2 * DAY_MS;
const seasonRow = (player: Member, seasonPoints: number | null, last: number | null) => ({
  code: player.playerCode,
  name: player.name,
  fullName: player.name,
  positions: player.positions,
  club: { code: 3, name: "Arsenal", shortName: "ARS" },
  gone: false,
  number: null,
  nextFixture: { gameweek: 9, kickoff: KICKOFF, opponent: CHELSEA, home: false },
  seasonPoints,
  lastGameweekPoints: last,
});
const TEAM_SQUAD: TeamSquad = { teamName: "Team 1", lastGameweek: 8, unheld: [], players: [seasonRow(RAYA, 41, 6), seasonRow(WHITE, 12, null)] };

describe("the Selection table", () => {
  it("gives each player his next fixture, outlined until its difficulty colour comes, and his season's and last gameweek's points", async () => {
    await openedPitch({ tactics: SAVED, squad: TEAM_SQUAD });
    const raya = within(rowOf(RAYA));
    expect(raya.getByRole("img", { name: nextPlaceholder(nextFixtureLong(CHELSEA.name, false, whenWords(KICKOFF))) }).textContent).toBe("CHE (A)");
    expect(rowOf(RAYA).textContent).toMatch(/416$/);
    expect(rowOf(WHITE).textContent).toMatch(/12—$/);
  });

  it("leads each starter with his slot's position chip, and each bench player with his place and main position", async () => {
    await openedPitch();
    expect(within(rowOf(HAVERTZ)).getByTitle("Striker").textContent).toBe("ST");
    expect(within(rowOf(ARRIZABALAGA)).getByTitle("Substitute 1").textContent).toBe("S1");
    // White plays FB and WB: the chip is his first.
    expect(within(rowOf(WHITE)).getByTitle("Full-back").textContent).toBe("FB");
  });

  it("heads the bench's Role column Best role, each bench player's best role muted", async () => {
    await openedPitch();
    expect(within(screen.getByRole("table", { name: squadTableLabel })).getByText(BEST_ROLE_HEAD)).toBeTruthy();
    expect(within(rowOf(WHITE)).getByText("Defensive full-back").className).toContain("text-muted");
  });

  it("draws each row's role fit as a placeholder: stars aren't on screen yet (#11, #375)", async () => {
    await openedPitch();
    expect(within(screen.getByRole("table", { name: squadTableLabel })).getAllByRole("img", { name: roleFitPlaceholder })).toHaveLength(SQUAD.length);
  });
});

describe("the bench's best role", () => {
  it("is his best-star role at his main position's slot, the slot's first with no stars", () => {
    expect(benchBestRole({ positions: ["FB", "WB"], stars: [] })?.role.name).toBe("Defensive full-back");
    expect(benchBestRole({ positions: ["FB"], stars: [{ area: "defence", role: "attackingFullBack", stars: 4 }] })?.role.name).toBe("Attacking full-back");
  });

  it("skips a support striker, who has no slot of his own, for his next position", () => {
    expect(benchBestRole({ positions: ["SS", "ST"], stars: [] })?.cell.area).toBe("attack");
    expect(benchBestRole({ positions: ["SS"], stars: [] })).toBeUndefined();
  });
});

describe("where a player stands, for his panel", () => {
  it("is his slot, his place on the bench, or nowhere", () => {
    const draft = { starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode] };
    expect(placeOf(draft, RAYA.playerCode)).toEqual({ starter: STARTERS[0] });
    expect(placeOf(draft, WHITE.playerCode)).toEqual({ benchIndex: 1, benchLast: 1 });
    expect(placeOf(draft, 99)).toBeNull();
  });
});

describe("the Formation keys", () => {
  const ELEVEN = FIRST_RULES.presets[6].cells.map((cell, index) => ({ playerCode: index + 1, ...cell }));

  it("name the preset the eleven stand in, cell for cell, and none for a shape that is no preset", () => {
    expect(presetInUse({ starters: ELEVEN, bench: [] }, FIRST_RULES.presets)?.name).toBe(FIRST_RULES.presets[6].name);
    expect(presetInUse({ starters: ELEVEN.slice(1), bench: [] }, FIRST_RULES.presets)).toBeUndefined();
  });

  it("show the league's first presets, and the one in use where it isn't one of them", () => {
    const first = FIRST_RULES.presets.slice(0, FORMATION_KEYS).map(({ name }) => name);
    expect(keyedPresets(FIRST_RULES.presets, null)).toEqual(first);
    expect(keyedPresets(FIRST_RULES.presets, first[1])).toEqual(first);
    expect(keyedPresets(FIRST_RULES.presets, "5-3-2")).toEqual([...first, "5-3-2"]);
  });

  it("press in the one the eleven stand in, which heads the pitch", async () => {
    const squad = ELEVEN.map(({ playerCode, area }) => member(playerCode, `Player ${playerCode}`, area === "goalkeeper" ? ["GK"] : area === "defence" ? ["CB", "FB"] : area === "attack" ? ["ST"] : ["CDM", "CM", "WB"]));
    await openedPitch({ tactics: openTactics({ squad, lineup: { ...SAVED.lineup, starters: ELEVEN, bench: [] } }) });
    const name = FIRST_RULES.presets[6].name;
    expect((within(screen.getByRole("radiogroup", { name: presetLabel })).getByRole("radio", { name }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("heading", { name: pitchTitle(name) })).toBeTruthy();
  });
});

describe("the formation window", () => {
  it("groups the league's presets by their back line", () => {
    const groups = backGroups(FIRST_RULES.presets);
    expect(groups.map(({ back }) => back)).toEqual([3, 4, 5]);
    expect(groups.flatMap(({ shapes }) => shapes).length).toBe(FIRST_RULES.presets.length);
    // 3-5-2's wing-backs stand in a midfield row: a back three.
    expect(groups[0].shapes.map(({ name }) => name)).toContain("3-5-2");
  });

  it("previews the picked formation with each slot's role, and Cancel changes nothing", async () => {
    const app = await openedPitch();
    await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
    await userEvent.click(screen.getByRole("button", { name: /^Back 5/ }));
    await userEvent.click(screen.getByRole("radio", { name: "5-4-1" }));
    expect(screen.getByRole("img", { name: previewLabel("5-4-1") })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("img", { name: previewLabel("5-4-1") })).toBeNull();
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
  });
});

describe("the position chips (plate.md, Marks: position chips)", () => {
  it("each read at AA on its area's colour", () => {
    const pairs: [string, string][] = [
      ["area-goalkeeper", "ground"],
      ["area-defence", "fact"],
      ["area-defensive-midfield", "fact"],
      ["area-midfield", "ground"],
      ["area-attacking-midfield", "fact"],
      ["area-attack", "ground"],
    ];
    for (const [fill, ink] of pairs) expect(contrast(colorToken(fill), colorToken(ink))).toBeGreaterThanOrEqual(4.5);
  });
});
