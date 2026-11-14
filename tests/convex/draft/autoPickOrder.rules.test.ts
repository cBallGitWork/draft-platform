import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { autoPickOrder, fallbackRanking, type AutoPickPlayer } from "../../../convex/draft/autoPickOrder";
import { RULE_RUNS } from "../../support/ruleRuns";

// Rule tests on random players and lists (#2126): whom auto-pick tries first (spec/04, Auto-pick
// and The queue and the ranking; #1094): the queue, then the admin's ranking, then the rest by last
// season's points, players level on points A to Z by name, newcomers after them all A to Z; the
// do-not-draft list after everyone else, by the same order (Craig, 4 and 5 Nov 2026, on #1094).

/** Players with unique codes, a few sharing a name or points; some missing from last season's
 *  points (newcomers), and queue, do-not-draft and ranking lists drawn from their codes and from
 *  codes of players who aren't there to take. */
const autoPickArb = fc
  .uniqueArray(fc.record({ code: fc.integer({ min: 1, max: 500 }), name: fc.constantFrom("Abbott", "Baines", "Carr", "Dunne", "Palmer", "Saka", "Zola", "Ødegaard") }), {
    selector: ({ code }) => code,
    maxLength: 40,
  })
  .chain((players) => {
    const codeArb = fc.oneof(players.length === 0 ? fc.integer({ min: 501, max: 600 }) : fc.constantFrom(...players.map(({ code }) => code)), fc.integer({ min: 501, max: 600 }));
    return fc.record({
      players: fc.constant(players as AutoPickPlayer[]),
      queue: fc.array(codeArb, { maxLength: 15 }),
      doNotDraft: fc.array(codeArb, { maxLength: 15 }),
      ranked: fc.uniqueArray(codeArb, { maxLength: 20 }),
      points: fc
        .array(fc.tuple(fc.boolean(), fc.integer({ min: -10, max: 30 })), { minLength: players.length, maxLength: players.length })
        .map((rows) => new Map(rows.flatMap(([inData, points], index) => (inData ? [[players[index].code, points] as const] : [])))),
    });
  });

describe("auto-pick's order, on random players and lists (spec/04, Auto-pick)", () => {
  test("tries every player there to take once, and no one else", () => {
    fc.assert(
      fc.property(autoPickArb, ({ players, queue, doNotDraft, ranked, points }) => {
        const order = autoPickOrder(players, { queue, doNotDraft }, ranked, points);
        expect([...order].sort((one, other) => one - other)).toEqual(players.map(({ code }) => code).sort((one, other) => one - other));
      }),
      RULE_RUNS,
    );
  });

  test("puts the do-not-draft list after everyone else, each part in the same order", () => {
    fc.assert(
      fc.property(autoPickArb, ({ players, queue, doNotDraft, ranked, points }) => {
        const shunned = new Set(doNotDraft);
        const order = autoPickOrder(players, { queue, doNotDraft }, ranked, points);
        const unlisted = autoPickOrder(players, { queue, doNotDraft: [] }, ranked, points);
        const firstShunned = order.findIndex((code) => shunned.has(code));
        if (firstShunned >= 0) expect(order.slice(firstShunned).every((code) => shunned.has(code))).toBe(true);
        expect(order).toEqual([...unlisted.filter((code) => !shunned.has(code)), ...unlisted.filter((code) => shunned.has(code))]);
      }),
      RULE_RUNS,
    );
  });

  test("takes the queue first in its order, then the admin's ranking in its order, then the fallback ranking", () => {
    fc.assert(
      fc.property(autoPickArb, ({ players, queue, ranked, points }) => {
        const here = new Set(players.map(({ code }) => code));
        const queued = [...new Set(queue.filter((code) => here.has(code)))];
        const rankedOnly = ranked.filter((code) => here.has(code) && !queued.includes(code));
        const rest = fallbackRanking(players, points).filter((code) => !queued.includes(code) && !rankedOnly.includes(code));
        expect(autoPickOrder(players, { queue, doNotDraft: [] }, ranked, points)).toEqual([...queued, ...rankedOnly, ...rest]);
      }),
      RULE_RUNS,
    );
  });

  test("the fallback goes by last season's points high to low, level players A to Z, newcomers after them all A to Z", () => {
    fc.assert(
      fc.property(autoPickArb, ({ players, points }) => {
        const byCode = new Map(players.map((player) => [player.code, player]));
        const ranking = fallbackRanking(players, points).map((code) => byCode.get(code)!);
        ranking.slice(1).forEach((player, index) => {
          const before = ranking[index];
          const [mine, theirs] = [points.get(before.code), points.get(player.code)];
          if (mine === undefined) expect(theirs).toBeUndefined();
          if (mine !== undefined && theirs !== undefined) expect(mine).toBeGreaterThanOrEqual(theirs);
          if (mine === theirs) expect(before.name.localeCompare(player.name)).toBeLessThanOrEqual(0);
        });
      }),
      RULE_RUNS,
    );
  });

  test("the order players are listed in changes only who comes first among players level on points and name", () => {
    fc.assert(
      fc.property(
        autoPickArb.chain((draft) => fc.record({ draft: fc.constant(draft), shuffled: fc.shuffledSubarray(draft.players, { minLength: draft.players.length }) })),
        ({ draft: { players, queue, doNotDraft, ranked, points }, shuffled }) => {
          const key = (code: number) => `${points.get(code) ?? "new"}:${players.find((player) => player.code === code)!.name}`;
          expect(autoPickOrder(shuffled, { queue, doNotDraft }, ranked, points).map(key)).toEqual(autoPickOrder(players, { queue, doNotDraft }, ranked, points).map(key));
        },
      ),
      RULE_RUNS,
    );
  });
});
