import { describe, expect, test } from "vitest";
import { autoPickOrder, fallbackRanking, type AutoPickPlayer } from "../../../convex/draft/autoPickOrder";

// Whom auto-pick tries first (spec/04, Auto-pick; #1094): the queue, then the admin's ranking,
// then last season's points with level players and newcomers A to Z, the do-not-draft list last.

const PALMER: AutoPickPlayer = { code: 1, name: "Palmer" };
const SAKA: AutoPickPlayer = { code: 2, name: "Saka" };
const HAALAND: AutoPickPlayer = { code: 3, name: "Haaland" };
const ZUBIMENDI: AutoPickPlayer = { code: 4, name: "Zubimendi" };
const ADEYEMI: AutoPickPlayer = { code: 5, name: "Adeyemi" };
const PLAYERS = [PALMER, SAKA, HAALAND, ZUBIMENDI, ADEYEMI];
const NO_LISTS = { queue: [], doNotDraft: [] };
const POINTS = new Map([
  [PALMER.code, 180],
  [SAKA.code, 180],
  [HAALAND.code, 220],
  [ZUBIMENDI.code, -1],
]);

describe("auto-pick's order", () => {
  test("takes the queue first, in its order", () => {
    expect(autoPickOrder(PLAYERS, { queue: [ZUBIMENDI.code, SAKA.code], doNotDraft: [] }, [HAALAND.code], POINTS).slice(0, 3)).toEqual([
      ZUBIMENDI.code,
      SAKA.code,
      HAALAND.code,
    ]);
  });

  test("takes the admin's ranking when the queue is out, then the rest by last season's points", () => {
    expect(autoPickOrder(PLAYERS, NO_LISTS, [ADEYEMI.code, SAKA.code], POINTS)).toEqual([ADEYEMI.code, SAKA.code, HAALAND.code, PALMER.code, ZUBIMENDI.code]);
  });

  test("with no ranking, goes by last season's points, level players A to Z, newcomers last", () => {
    expect(autoPickOrder(PLAYERS, NO_LISTS, [], POINTS)).toEqual([HAALAND.code, PALMER.code, SAKA.code, ZUBIMENDI.code, ADEYEMI.code]);
  });

  test("puts newcomers A to Z after every player in last season's data, negative points too", () => {
    const newcomers = [{ code: 9, name: "Ugarte" }, { code: 8, name: "Bowen" }, ZUBIMENDI];
    expect(autoPickOrder(newcomers, NO_LISTS, [], POINTS)).toEqual([ZUBIMENDI.code, 8, 9]);
  });

  test("puts the do-not-draft list after everyone else, in the same order", () => {
    const lists = { queue: [SAKA.code], doNotDraft: [HAALAND.code, ADEYEMI.code] };
    expect(autoPickOrder(PLAYERS, lists, [ADEYEMI.code], POINTS)).toEqual([SAKA.code, PALMER.code, ZUBIMENDI.code, ADEYEMI.code, HAALAND.code]);
  });

  test("leaves out listed and ranked codes for players who aren't there to take", () => {
    expect(autoPickOrder([PALMER], { queue: [77], doNotDraft: [] }, [78], POINTS)).toEqual([PALMER.code]);
  });
});

describe("the fallback ranking (#1114)", () => {
  test("goes by points high to low, players level on points A to Z", () => {
    expect(fallbackRanking([SAKA, PALMER, HAALAND], POINTS)).toEqual([HAALAND.code, PALMER.code, SAKA.code]);
  });

  test("puts a 0 or negative player, and one in the data who never played (on 0), above every newcomer, newcomers A to Z", () => {
    const benched = { code: 6, name: "Zabarnyi" };
    const points = new Map([...POINTS, [benched.code, 0]]);
    const newcomers = [{ code: 9, name: "Ugarte" }, { code: 8, name: "Bowen" }];
    expect(fallbackRanking([...newcomers, ZUBIMENDI, benched], points)).toEqual([benched.code, ZUBIMENDI.code, 8, 9]);
  });
});
