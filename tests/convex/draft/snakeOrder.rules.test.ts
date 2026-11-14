import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { pickOnTheClock, pickOwner, picksLeftFor, roundOf, snakeOrder, type TradedPick } from "../../../convex/draft/snakeOrder";
import { MODEL_RUNS, RULE_RUNS } from "../../support/ruleRuns";

// Rule tests on random drafts (#2126): the snake order (spec/04, The picks; #1088), whose pick a
// traded one is (S04.2, one pick for one pick; S04.3, a team's pick in a round, not a slot), and
// the pick on the clock (#1089). Teams are numbers here; the draft runs with the teams that exist,
// 1 to 20 (spec/04, Starting it), over 0 to 20 rounds.

const teamsArb = fc.uniqueArray(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 });
const roundsArb = fc.integer({ min: 0, max: 20 });

/** A draft's teams and rounds, with the picks traded before it starts: each a team's pick in a
 *  round, at most one entry for each, held now by any team, its own included. */
const tradedDraftArb = fc
  .record({ teams: teamsArb, rounds: fc.integer({ min: 1, max: 20 }) })
  .chain(({ teams, rounds }) =>
    fc.record({
      teams: fc.constant(teams),
      rounds: fc.constant(rounds),
      traded: fc.uniqueArray(
        fc.record({ round: fc.integer({ min: 1, max: rounds }), teamId: fc.constantFrom(...teams), ownerId: fc.constantFrom(...teams) }),
        { selector: ({ round, teamId }) => `${round}:${teamId}`, maxLength: rounds * teams.length },
      ),
    }),
  );

describe("the snake order, on random drafts (spec/04, The picks)", () => {
  test("every round has each team once, in the draft order or reversed, every other round reversed", () => {
    fc.assert(
      fc.property(teamsArb, roundsArb, (teams, rounds) => {
        const order = snakeOrder(teams, rounds);
        expect(order).toHaveLength(teams.length * rounds);
        for (let round = 0; round < rounds; round++) {
          const picks = order.slice(round * teams.length, (round + 1) * teams.length);
          expect(picks).toEqual(round % 2 === 0 ? teams : [...teams].reverse());
        }
      }),
      RULE_RUNS,
    );
  });

  test("the team picking last in a round picks first in the next", () => {
    fc.assert(
      fc.property(teamsArb, fc.integer({ min: 2, max: 20 }), (teams, rounds) => {
        const order = snakeOrder(teams, rounds);
        for (let round = 1; round < rounds; round++) expect(order[round * teams.length]).toBe(order[round * teams.length - 1]);
      }),
      RULE_RUNS,
    );
  });

  test("each pick's round is the one it falls in", () => {
    fc.assert(
      fc.property(teamsArb, fc.integer({ min: 1, max: 20 }), (teams, rounds) => {
        snakeOrder(teams, rounds).forEach((_, index) => expect(roundOf(index + 1, teams.length)).toBe(Math.floor(index / teams.length) + 1));
      }),
      RULE_RUNS,
    );
  });
});

describe("a traded pick's owner, on random trades (S04.2, S04.3)", () => {
  test("a pick nobody traded stays its team's, and a traded one is its new owner's", () => {
    fc.assert(
      fc.property(tradedDraftArb, ({ teams, rounds, traded }) => {
        for (let round = 1; round <= rounds; round++)
          for (const team of teams) {
            const trade = traded.find((each) => each.round === round && each.teamId === team);
            expect(pickOwner(traded, round, team)).toBe(trade?.ownerId ?? team);
          }
      }),
      RULE_RUNS,
    );
  });

  test("the order the trades are listed in changes no owner", () => {
    fc.assert(
      fc.property(
        tradedDraftArb.chain((draft) => fc.record({ draft: fc.constant(draft), shuffled: fc.shuffledSubarray(draft.traded, { minLength: draft.traded.length }) })),
        ({ draft: { teams, rounds, traded }, shuffled }) => {
          for (let round = 1; round <= rounds; round++) for (const team of teams) expect(pickOwner(shuffled, round, team)).toBe(pickOwner(traded, round, team));
        },
      ),
      RULE_RUNS,
    );
  });

  test("trades move picks between teams but never make or lose one: every team's picks left add up to the draft's", () => {
    fc.assert(
      fc.property(tradedDraftArb, fc.nat(), ({ teams, rounds, traded }, made) => {
        const picksMade = made % (teams.length * rounds + 1);
        const left = teams.reduce((sum, team) => sum + picksLeftFor(teams, rounds, picksMade, traded, team), 0);
        expect(left).toBe(teams.length * rounds - picksMade);
      }),
      RULE_RUNS,
    );
  });

  test("a new draft order moves a traded pick with its team, within its round (S04.3)", () => {
    fc.assert(
      fc.property(
        tradedDraftArb.chain((draft) => fc.record({ draft: fc.constant(draft), reordered: fc.shuffledSubarray(draft.teams, { minLength: draft.teams.length }) })),
        ({ draft: { teams, rounds, traded }, reordered }) => {
          const picksOf = (order: number[]) =>
            snakeOrder(order, rounds)
              .map((_, made) => pickOnTheClock(order, rounds, made, traded)!)
              .map(({ round, team, via }) => `${round}:${team}:${via}`)
              .sort();
          expect(picksOf(reordered)).toEqual(picksOf(teams));
        },
      ),
      RULE_RUNS,
    );
  });

  test("the pick on the clock is its owner's, via the team whose turn it is, and none once every pick is made", () => {
    fc.assert(
      fc.property(tradedDraftArb, ({ teams, rounds, traded }) => {
        const order = snakeOrder(teams, rounds);
        order.forEach((turn, made) => {
          const round = roundOf(made + 1, teams.length);
          const owner = pickOwner(traded, round, turn);
          expect(pickOnTheClock(teams, rounds, made, traded)).toEqual({ pick: made + 1, round, team: owner, via: owner === turn ? null : turn });
        });
        expect(pickOnTheClock(teams, rounds, order.length, traded)).toBeNull();
      }),
      RULE_RUNS,
    );
  });
});

// The model-based run: random trades, new draft orders and picks, in any order a commissioner and
// managers could make them, against a plain model that holds each pick's owner by round and team.
// Trades and a new order come only before the first pick, as a pick trade still open when the
// draft starts closes (S04.4).

type Model = { teams: number[]; rounds: number; owners: Map<string, number>; made: number };
type Real = { traded: TradedPick<number>[] };

const slot = (round: number, team: number) => `${round}:${team}`;

/** Every pick left in the model, in turn: its round, whose turn it is and who holds it. */
function modelPicks({ teams, rounds, owners }: Model) {
  const picks = [];
  for (let round = 1; round <= rounds; round++) {
    const inTurn = round % 2 === 1 ? teams : [...teams].reverse();
    for (const turn of inTurn) picks.push({ round, turn, owner: owners.get(slot(round, turn)) ?? turn });
  }
  return picks;
}

/** The real functions agree with the model: the pick on the clock and every team's picks left. */
function agree(model: Model, real: Real) {
  const pick = modelPicks(model)[model.made];
  expect(pickOnTheClock(model.teams, model.rounds, model.made, real.traded)).toEqual(
    pick === undefined ? null : { pick: model.made + 1, round: pick.round, team: pick.owner, via: pick.owner === pick.turn ? null : pick.turn },
  );
  for (const team of model.teams)
    expect(picksLeftFor(model.teams, model.rounds, model.made, real.traded, team)).toBe(modelPicks(model).filter((each, index) => index >= model.made && each.owner === team).length);
}

/** Who holds `team`'s pick in `round` in the model. */
const holderIn = (model: Model, round: number, team: number) => model.owners.get(slot(round, team)) ?? team;

/** The real list after `team`'s pick in `round` goes to `owner`: one entry a pick, none once it is home. */
function tradedTo(traded: TradedPick<number>[], round: number, team: number, owner: number): TradedPick<number>[] {
  const others = traded.filter((each) => !(each.round === round && each.teamId === team));
  return owner === team ? others : [...others, { round, teamId: team, ownerId: owner }];
}

class SwapPicks implements fc.Command<Model, Real> {
  constructor(
    readonly one: { round: number; team: number },
    readonly other: { round: number; team: number },
  ) {}
  check = (model: Readonly<Model>) =>
    model.made === 0 &&
    model.teams.includes(this.one.team) &&
    model.teams.includes(this.other.team) &&
    holderIn(model, this.one.round, this.one.team) !== holderIn(model, this.other.round, this.other.team);
  run(model: Model, real: Real) {
    const [oneHolder, otherHolder] = [holderIn(model, this.one.round, this.one.team), holderIn(model, this.other.round, this.other.team)];
    model.owners.set(slot(this.one.round, this.one.team), otherHolder);
    model.owners.set(slot(this.other.round, this.other.team), oneHolder);
    real.traded = tradedTo(tradedTo(real.traded, this.one.round, this.one.team, otherHolder), this.other.round, this.other.team, oneHolder);
    agree(model, real);
  }
  toString = () => `swap ${slot(this.one.round, this.one.team)} for ${slot(this.other.round, this.other.team)}`;
}

class NewOrder implements fc.Command<Model, Real> {
  constructor(readonly keys: number[]) {}
  check = (model: Readonly<Model>) => model.made === 0;
  run(model: Model, real: Real) {
    model.teams = [...model.teams].sort((one, other) => this.keyOf(model, one) - this.keyOf(model, other) || one - other);
    agree(model, real);
  }
  private keyOf = (model: Model, team: number) => this.keys[model.teams.indexOf(team) % this.keys.length];
  toString = () => `new order by ${this.keys.join(",")}`;
}

class MakePick implements fc.Command<Model, Real> {
  check = (model: Readonly<Model>) => model.made < model.teams.length * model.rounds;
  run(model: Model, real: Real) {
    model.made += 1;
    agree(model, real);
  }
  toString = () => "pick";
}

describe("random trades, new orders and picks against a model (S04.2, S04.3, S04.4)", () => {
  test("the pick on the clock and every team's picks left match the model after each step", () => {
    const draftArb = fc.record({ size: fc.integer({ min: 2, max: 12 }), rounds: fc.integer({ min: 1, max: 8 }) }).chain(({ size, rounds }) => {
      const pickArb = fc.record({ round: fc.integer({ min: 1, max: rounds }), team: fc.integer({ min: 1, max: size }) });
      return fc.record({
        size: fc.constant(size),
        rounds: fc.constant(rounds),
        steps: fc.commands(
          [
            fc.tuple(pickArb, pickArb).map(([one, other]) => new SwapPicks(one, other)),
            fc.array(fc.nat(), { minLength: 1, maxLength: size }).map((keys) => new NewOrder(keys)),
            fc.constant(new MakePick()),
          ],
          { maxCommands: size * rounds + 20 },
        ),
      });
    });
    fc.assert(
      fc.property(draftArb, ({ size, rounds, steps }) => {
        const model: Model = { teams: Array.from({ length: size }, (_, index) => index + 1), rounds, owners: new Map(), made: 0 };
        const real: Real = { traded: [] };
        fc.modelRun(() => ({ model, real }), steps);
      }),
      MODEL_RUNS,
    );
  });
});
