// A starter's chip on the pitch (spec/05 What the pitch shows; #845): his area's colour, his role's
// code and his stars for it, and his opponents this gameweek, two in a double gameweek and none in
// a blank one, each outlined until fixture difficulty is held (Craig, 6 Nov 2026: "Build now,
// colour later").

import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { roleIn } from "../../../../../convex/lineup/roles";
import { NO_DATA } from "../../../../../convex/stars/starsShape";
import { nextFixtureShort } from "../../../../../src/myTeam/squad/words";
import { pitchChipOf } from "../../../../../src/myTeam/tactics/pitch/pitchChip";
import { starsLabel } from "../../../../../src/ui/StarRating";
import { ARSENAL, CHELSEA } from "../../../../support/convex/footballRows.harness";
import { SAKA, squadOf } from "../../../../support/src/squadTab.harness";
import { openTactics, TACTICS_GAMEWEEK } from "../../../../support/src/tactics.harness";
import { blockOf, openedPitch, SALIBA, SALIBAS_CELL, SAVED, SQUAD, STARTERS } from "../../../../support/src/tacticsScreen.harness";

const match = (gameweek: number, day: number, opponent: typeof ARSENAL, home: boolean) => ({ gameweek, kickoff: day * 86_400_000, opponent, home });
const DOUBLE = [match(TACTICS_GAMEWEEK, 1, CHELSEA, true), match(TACTICS_GAMEWEEK, 4, ARSENAL, false), match(TACTICS_GAMEWEEK + 1, 8, CHELSEA, false)];
const chipWith = (nextFixtures: ReturnType<typeof match>[] | null | undefined) =>
  pitchChipOf({ cell: SALIBAS_CELL, role: undefined, player: { stars: [] }, season: nextFixtures && { nextFixtures }, gameweek: TACTICS_GAMEWEEK });

describe("a starter's chip", () => {
  it("carries his slot's position, his role's code and name, and his stars for it", () => {
    const role = roleIn(SALIBAS_CELL, "ballPlayingDefender");
    const chip = pitchChipOf({ cell: SALIBAS_CELL, role: role.key, player: { stars: [{ area: "defence", role: role.key, stars: 3.5 }] }, season: null, gameweek: TACTICS_GAMEWEEK });
    expect(chip).toMatchObject({ position: "CB", code: "BPD", roleName: role.name, stars: 3.5 });
  });

  it("plays the slot's first role, with no stars, where he was given none", () => {
    expect(chipWith(null)).toMatchObject({ code: roleIn(SALIBAS_CELL, undefined).code, stars: NO_DATA });
  });

  it("shows both opponents in a double gameweek, soonest first, and none from the next gameweek", () => {
    expect(chipWith(DOUBLE).opponents?.map(({ opponent }) => opponent.code)).toEqual([CHELSEA.code, ARSENAL.code]);
  });

  it("shows none in a blank gameweek, none where the read holds no row for him, and waits while it loads", () => {
    expect(chipWith([match(TACTICS_GAMEWEEK + 1, 8, CHELSEA, false)]).opponents).toEqual([]);
    expect(chipWith(null).opponents).toEqual([]);
    expect(chipWith(undefined).opponents).toBeUndefined();
  });
});

describe("the chip on the pitch", () => {
  it("draws the code in his area's colour, his stars, and each opponent this gameweek outlined, difficulty not rated yet", async () => {
    const role = roleIn(STARTERS[1], undefined);
    const squad = SQUAD.map((player) => (player === SALIBA ? { ...player, stars: [{ area: "defence" as const, role: role.key, stars: 4 }] } : player));
    await openedPitch({ tactics: openTactics({ ...SAVED, squad }), squad: squadOf([{ ...SAKA, code: SALIBA.playerCode, nextFixtures: DOUBLE }]) });
    const block = within(blockOf(SALIBA, SALIBAS_CELL));

    expect(block.getByTitle(role.name).className).toContain("bg-area-defence");
    expect(block.getByRole("img", { name: starsLabel(role.name, 4) })).toBeTruthy();
    const opponents = [nextFixtureShort(CHELSEA.shortName, true), nextFixtureShort(ARSENAL.shortName, false)].map((short) => block.getByText(short));
    for (const opponent of opponents) {
      expect(opponent.className).toContain("border-muted");
      expect(opponent.getAttribute("title")).toMatch(/difficulty not rated yet$/);
    }
    expect(block.queryByText(nextFixtureShort(CHELSEA.shortName, false))).toBeNull();
  });
});
