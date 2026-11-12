import { describe, expect, it } from "vitest";
import { defaultPairOf, FIRST_INSTRUCTIONS, keptOrSwitched, offeredOn, pairRefusal, type Instruction } from "../../../convex/lineup/instructions";
import { switchedWords } from "../../../convex/lineup/instructionsWords";
import { FIRST_PRESETS } from "../../../convex/lineup/presets";
import { presetNamed } from "../../support/convex/lineup.harness";

// Team instructions (spec/05, Team instructions; #990): each offered only where the formation's
// shape allows it, by Craig's answers on #990 (6 Nov 2026), and kept or switched on a change of
// formation.

const cellsOf = (name: string) => presetNamed(name).cells;
const offers = (name: string, key: string) =>
  [...offeredOn("attacking", cellsOf(name), FIRST_INSTRUCTIONS), ...offeredOn("defensive", cellsOf(name), FIRST_INSTRUCTIONS)].some((each) => each.key === key);
const offeredBy = (key: string) => FIRST_PRESETS.filter(({ name }) => offers(name, key)).map(({ name }) => name);
const ALL = FIRST_PRESETS.map(({ name }) => name);

describe("each instruction's shape gate", () => {
  it("offers the any-shape instructions everywhere", () => {
    for (const key of ["playOutFromTheBack", "shootOnSight", "clearIt", "getStuckIn", "keepItTightEarly"]) expect(offeredBy(key)).toEqual(ALL);
  });

  it("offers Park the bus only with five at the back, wing-backs not counted", () => {
    expect(offeredBy("parkTheBus")).toEqual(["5-3-2", "5-4-1", "5-2-3", "5-3-1-1"]);
  });

  it("offers Gung-ho only with two at the back", () => {
    expect(offeredBy("gungHo")).toEqual(["2-3-5", "2-3-2-3"]);
  });

  it("offers Hold a high line with a back three or four: a 3-5-2 is a back three", () => {
    expect(offers("3-5-2", "holdAHighLine")).toBe(true);
    expect(offers("4-4-2", "holdAHighLine")).toBe(true);
    expect(offers("5-3-2", "holdAHighLine")).toBe(false);
    expect(offers("2-3-5", "holdAHighLine")).toBe(false);
  });

  it("offers Boot it with one up top and no winger wide in attacking midfield or attack", () => {
    for (const name of ["4-4-1-1", "4-5-1", "4-1-4-1", "5-4-1"]) expect(offers(name, "bootItToTheBigMan")).toBe(true);
    expect(offers("4-2-3-1", "bootItToTheBigMan")).toBe(false);
    expect(offers("4-4-2", "bootItToTheBigMan")).toBe(false);
  });

  it("offers Get it wide with both flanks filled above the defence, full-backs not counted", () => {
    for (const name of ["4-4-2", "4-3-3", "3-5-2"]) expect(offers(name, "getItWide")).toBe(true);
    for (const name of ["4-3-1-2", "4-1-2-1-2"]) expect(offers(name, "getItWide")).toBe(false);
  });

  it("offers Press high with three in one row of midfield, attacking midfield or attack", () => {
    expect(offers("4-4-2", "pressHigh")).toBe(true);
    expect(offers("4-2-3-1", "pressHigh")).toBe(true);
    expect(offers("4-2-2-2", "pressHigh")).toBe(false);
  });
});

describe("each formation's defaults", () => {
  it("start most on Play out from the back and Keep it tight early, five at the back on Park the bus, two at the back on Gung-ho", () => {
    expect(defaultPairOf(cellsOf("4-4-2"), FIRST_PRESETS, FIRST_INSTRUCTIONS)).toEqual({ attacking: "playOutFromTheBack", defensive: "keepItTightEarly" });
    expect(defaultPairOf(cellsOf("5-3-2"), FIRST_PRESETS, FIRST_INSTRUCTIONS)).toEqual({ attacking: "playOutFromTheBack", defensive: "parkTheBus" });
    expect(defaultPairOf(cellsOf("2-3-5"), FIRST_PRESETS, FIRST_INSTRUCTIONS)).toEqual({ attacking: "gungHo", defensive: "keepItTightEarly" });
  });

  it("are the league's preset's own pair, held as a rule", () => {
    const presets = [{ cells: cellsOf("4-4-2"), instructions: { attacking: "getItWide", defensive: "pressHigh" } }];
    expect(defaultPairOf(cellsOf("4-4-2"), presets, FIRST_INSTRUCTIONS)).toEqual({ attacking: "getItWide", defensive: "pressHigh" });
  });

  it("are each offered by the preset's own shape", () => {
    for (const { name, cells, instructions } of FIRST_PRESETS) expect([name, pairRefusal(instructions!, cells, FIRST_INSTRUCTIONS)]).toEqual([name, null]);
  });
});

describe("keep or switch on a formation change", () => {
  it("keeps a pick the new shape offers", () => {
    const { pair, switched } = keptOrSwitched({ attacking: "getItWide", defensive: "pressHigh" }, cellsOf("3-5-2"), FIRST_PRESETS, FIRST_INSTRUCTIONS);
    expect(pair).toEqual({ attacking: "getItWide", defensive: "pressHigh" });
    expect(switched).toEqual([]);
  });

  it("switches one it blocks to the new formation's default, and says so", () => {
    const { pair, switched } = keptOrSwitched({ attacking: "shootOnSight", defensive: "parkTheBus" }, cellsOf("4-4-2"), FIRST_PRESETS, FIRST_INSTRUCTIONS);
    expect(pair).toEqual({ attacking: "shootOnSight", defensive: "keepItTightEarly" });
    expect(switchedWords(switched)).toBe("Park the bus needs 5 at the back: switched to Keep it tight early");
  });

  it("takes the defaults without a word for no pick, or one the league no longer holds", () => {
    expect(keptOrSwitched(undefined, cellsOf("5-4-1"), FIRST_PRESETS, FIRST_INSTRUCTIONS)).toEqual({ pair: { attacking: "playOutFromTheBack", defensive: "parkTheBus" }, switched: [] });
    expect(keptOrSwitched({ attacking: "gone", defensive: "clearIt" }, cellsOf("4-4-2"), FIRST_PRESETS, FIRST_INSTRUCTIONS).switched).toEqual([]);
  });
});

describe("a pair refused", () => {
  it("names a key the league doesn't hold on that side, or one the shape blocks", () => {
    expect(pairRefusal({ attacking: "pressHigh", defensive: "clearIt" }, cellsOf("4-4-2"), FIRST_INSTRUCTIONS)).toEqual({ side: "attacking", key: "pressHigh" });
    expect(pairRefusal({ attacking: "gungHo", defensive: "clearIt" }, cellsOf("4-4-2"), FIRST_INSTRUCTIONS)).toEqual({ side: "attacking", key: "gungHo", blockedBy: "twoAtTheBack" });
  });

  it("offers a shape none of a side fits the whole side, so a team always has one to pick", () => {
    const set: Instruction[] = [{ key: "bus", side: "defensive", name: "Bus", description: "", needs: "fiveAtTheBack" }];
    expect(offeredOn("defensive", cellsOf("4-4-2"), set).map(({ key }) => key)).toEqual(["bus"]);
  });
});
