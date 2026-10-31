// A side's formation on the matchup, read from where its men stand (spec/10, The matchup, as a live
// match: "the formation"; #799): the shape on the pitch now, so a sub who comes on in his own area
// changes it (spec/05, Auto-subs).

import { describe, expect, it } from "vitest";
import type { Area } from "../../../convex/lineup/pitch";
import { formationOf } from "../../../src/matchup/formation";
import { slot, teamSide } from "../../support/src/matchup.harness";

/** Men named by their area and place, so each is his own. */
const men = (area: Area, count: number) => Array.from({ length: count }, (_, index) => slot(`${area} ${index}`, { area }));
const lineupOf = (...parts: Parameters<typeof teamSide>[1][]) => teamSide("Team 1", parts.flat(), []).lineup;

describe("a side's formation", () => {
  it("counts each outfield area back to front, the keeper left out", () => {
    expect(formationOf(lineupOf(men("goalkeeper", 1), men("defence", 4), men("midfield", 4), men("attack", 2)))).toEqual([4, 4, 2]);
  });

  it("names the holding and attacking midfield lines, and leaves out an area no one stands in", () => {
    const lineup = lineupOf(men("goalkeeper", 1), men("defence", 4), men("defensiveMidfield", 2), men("attackingMidfield", 3), men("attack", 1));
    expect(formationOf(lineup)).toEqual([4, 2, 3, 1]);
  });

  it("changes when a sub comes on in his own area, and loses a slot no one could fill", () => {
    const off = slot("Off", { area: "defence", counts: false, autoSub: { kind: "off", playerName: "On" } });
    const unreplaced = slot("Unreplaced", { area: "attack", counts: true, autoSub: { kind: "unreplaced" } });
    const on = slot("On", { area: "midfield", autoSub: { kind: "on", playerName: "Off" } });
    const notOn = slot("Not on", { area: "attack", counts: false });
    const { lineup } = teamSide("Team 1", [...men("defence", 3), off, ...men("midfield", 4), unreplaced, ...men("attack", 1)], [on, notOn]);
    expect(formationOf(lineup)).toEqual([3, 5, 1]);
  });

  it("is empty with no one outfield", () => {
    expect(formationOf(lineupOf(men("goalkeeper", 1)))).toEqual([]);
  });
});
