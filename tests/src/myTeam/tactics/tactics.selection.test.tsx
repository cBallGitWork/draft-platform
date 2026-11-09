// The Tactics tab's Selection table and toolbar (the approved Tactics picture; plate.md, Tables and
// panels): each row's position chip, role, player, role fit and next fixture; the bench's places and
// best roles; data not held yet as its placeholder; the Formation keys and the formation window.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { contrast } from "../../../../convex/football/clubColours";
import { FORMATION_KEYS, keyedPresets } from "../../../../src/myTeam/tactics/TacticsControls";
import { backGroups } from "../../../../src/myTeam/tactics/formationWindow/formationGroups";
import { previewLabel } from "../../../../src/myTeam/tactics/formationWindow/words";
import { benchBestRole, placeOf, presetInUse } from "../../../../src/myTeam/tactics/lineupEdits";
import {
  allFormationsWords,
  BEST_ROLE_HEAD,
  pitchTitle,
  presetLabel,
  ROLE_FIT_SUBJECT,
  selectionTableLabel,
} from "../../../../src/myTeam/tactics/words";
import { roleIn, rolesOfSlot } from "../../../../convex/lineup/roles";
import { UNSURE } from "../../../../convex/stars/starsShape";
import { noFigureWords } from "../../../../src/shared/words";
import { noDataLabel, starsLabel, unsureGlyph, unsureLabel } from "../../../../src/ui/StarRating";
import { nextFixtureShort, statusNotSettledLabel } from "../../../../src/myTeam/words";
import { SAKA, squadOf } from "../../../support/src/squadTab.harness";
import { FIRST_RULES } from "../../../../convex/rules/firstRules";
import { colorToken } from "../../../support/src/colorTokens";
import { openTactics } from "../../../support/src/tactics.harness";
import { ARRIZABALAGA, HAVERTZ, RAYA, RICE, SALIBA, SAVED, SQUAD, STARTERS, WHITE, member, openPanel, openedPitch, rowOf, type Member } from "../../../support/src/tacticsScreen.harness";

/** The Squad tab's read for Raya and White: his next match and points (squadTab.harness.ts's rows). */
const seasonRow = (player: Member, seasonPoints: number | null, last: number | null) => ({ ...SAKA, code: player.playerCode, name: player.name, positions: player.positions, seasonPoints, lastGameweekPoints: last });
const TEAM_SQUAD = squadOf([seasonRow(RAYA, 41, 6), { ...seasonRow(WHITE, 12, null), chanceOfPlaying: 75 }]);

/** Saliba 4.5 stars for the role he plays, White 4 as a defensive full-back, Rice too few matches
 *  to be sure, the rest with none. */
const STARRED: Member[] = SQUAD.map((player) =>
  player === SALIBA
    ? { ...player, stars: [{ area: "defence", role: roleIn(STARTERS[1], undefined).key, stars: 4.5 }] }
    : player === WHITE
      ? { ...player, stars: [{ area: "defence", role: "defensiveFullBack", stars: 4 }] }
      : player === RICE
        ? { ...player, stars: [{ area: "midfield", role: roleIn(STARTERS[2], undefined).key, stars: UNSURE }] }
        : player,
);

describe("the Selection table", () => {
  it("gives each player his next fixture, outlined until its difficulty colour comes, and a status chip only where FPL has news", async () => {
    await openedPitch({ tactics: SAVED, squad: TEAM_SQUAD });
    expect(within(rowOf(RAYA)).getByText(nextFixtureShort(SAKA.nextFixtures[0].opponent.shortName, true)).className).toContain("border-muted");
    expect(within(rowOf(RAYA)).queryByRole("img", { name: statusNotSettledLabel })).toBeNull();
    expect(within(rowOf(WHITE)).getByRole("img", { name: statusNotSettledLabel })).toBeTruthy();
  });

  it("opens each row with the chip, then the role, the player, his stars and his next fixture, and no points: those stay on the Squad tab (#847)", async () => {
    await openedPitch({ tactics: SAVED, squad: TEAM_SQUAD });
    const table = screen.getByRole("table", { name: selectionTableLabel });
    const heads = within(table).getAllByRole("columnheader").map((head) => head.textContent);
    expect(heads.slice(0, 5)).toEqual(["Pos", "Role", "Player", "Role fit", "Next"]);
    const [chip, role, player, stars, next] = Array.from(rowOf(RAYA).cells);
    expect(chip.textContent).toBe("GK");
    expect(within(role).getByRole("combobox").textContent).toContain(roleIn(STARTERS[0], undefined).name);
    expect(within(player as HTMLElement).getByRole("button", { name: RAYA.name })).toBeTruthy();
    expect(within(stars).getByRole("img", { name: noDataLabel(ROLE_FIT_SUBJECT) })).toBeTruthy();
    expect(within(next).getByText(nextFixtureShort(SAKA.nextFixtures[0].opponent.shortName, true))).toBeTruthy();
    expect(rowOf(RAYA).cells).toHaveLength(5);
    expect(rowOf(RAYA).textContent).not.toContain("41");
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
    expect(within(screen.getByRole("table", { name: selectionTableLabel })).getByText(BEST_ROLE_HEAD)).toBeTruthy();
    expect(within(rowOf(WHITE)).getByText("Overlapping full-back").className).toContain("text-muted");
  });

  it("gives each starter his stars for the role he plays, each bench player his for his best role, and ? or — unrated (#11)", async () => {
    await openedPitch({ tactics: openTactics({ ...SAVED, squad: STARRED }) });
    expect(within(rowOf(SALIBA)).getByRole("img", { name: starsLabel(ROLE_FIT_SUBJECT, 4.5) })).toBeTruthy();
    expect(within(rowOf(WHITE)).getByText("Defensive full-back")).toBeTruthy();
    expect(within(rowOf(WHITE)).getByRole("img", { name: starsLabel(ROLE_FIT_SUBJECT, 4) })).toBeTruthy();
    expect(within(rowOf(RICE)).getByRole("img", { name: unsureLabel(ROLE_FIT_SUBJECT) }).textContent).toBe(unsureGlyph);
    expect(within(rowOf(HAVERTZ)).getByRole("img", { name: noDataLabel(ROLE_FIT_SUBJECT) }).textContent).toBe(noFigureWords);
  });
});

describe("the selected player's panel (#11)", () => {
  it("gives each role his slot offers his stars for it", async () => {
    await openedPitch({ tactics: openTactics({ ...SAVED, squad: STARRED }) });
    await openPanel(SALIBA);
    const [playing, other] = rolesOfSlot(STARTERS[1], STARTERS);
    // His chip on the pitch shows the stars for the role he plays too (#845), so read the panel's.
    const panel = within(screen.getByRole("region", { name: SALIBA.name }));
    expect(panel.getByRole("img", { name: starsLabel(playing.name, 4.5) })).toBeTruthy();
    expect(panel.getByRole("img", { name: noDataLabel(other.name) })).toBeTruthy();
  });
});

describe("the bench's best role", () => {
  it("is his best-star role at his main position's slot, the slot's first with no stars", () => {
    expect(benchBestRole({ positions: ["FB", "WB"], stars: [] })?.role.name).toBe("Overlapping full-back");
    expect(benchBestRole({ positions: ["FB"], stars: [{ area: "defence", role: "defensiveFullBack", stars: 4 }] })?.role.name).toBe("Defensive full-back");
    // He stands in no formation, so a centre-back's best may be a back three's sweeper.
    expect(benchBestRole({ positions: ["CB"], stars: [{ area: "defence", role: "sweeper", stars: 4 }] })?.role.name).toBe("Sweeper");
  });

  it("skips a support striker, who has no slot of his own, for his next position", () => {
    expect(benchBestRole({ positions: ["SS", "ST"], stars: [] })?.cell.area).toBe("attack");
    expect(benchBestRole({ positions: ["SS"], stars: [] })).toBeUndefined();
  });
});

describe("where a player stands, for his panel", () => {
  it("is his slot, his place on the bench, or nowhere", () => {
    const draft = { starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode] };
    expect(placeOf(draft, RAYA.playerCode)).toEqual({ starter: STARTERS[0], formation: STARTERS });
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
    expect(groups.map(({ back }) => back)).toEqual([2, 3, 4, 5]);
    expect(groups.flatMap(({ shapes }) => shapes).length).toBe(FIRST_RULES.presets.length);
    expect(groups[0].shapes.map(({ name }) => name)).toEqual(["2-3-5", "2-3-2-3"]);
    // 3-5-2's wing-backs stand in a midfield row: a back three.
    expect(groups[1].shapes.map(({ name }) => name)).toContain("3-5-2");
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
