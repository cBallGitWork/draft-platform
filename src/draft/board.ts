import { pickOwner, snakeOrder, type TradedPick } from "../../convex/draft/snakeOrder";

// Where each pick sits on the board (spec/04, The picks and The draft room): a column a team in
// the draft order, a row a round, each round running the other way from the one before (snake
// only). Pure: no I/O.

/** How many rounds the board shows unless the whole board is asked for (Craig, 4 Nov 2026). */
export const BOARD_ROUNDS = 6;

/** The rounds the board shows: every round for the whole board, otherwise BOARD_ROUNDS of them
 *  around `round`, the one on the clock, which sits as near the fourth row as the rounds allow, as
 *  the approved picture has it (round 4 of 20 shows rounds 1 to 6). */
export function roundsShown(rounds: number, round: number, whole: boolean): number[] {
  const count = whole ? rounds : Math.min(BOARD_ROUNDS, rounds);
  const first = whole ? 1 : Math.max(1, Math.min(round - 3, rounds - count + 1));
  return Array.from({ length: count }, (_, index) => first + index);
}

/** Whether `round` runs left to right: the first does, and each after turns. */
export const runsLeftToRight = (round: number) => round % 2 === 1;

/** Which pick of its round the team in `column`, from 0, makes in `round`. */
export const pickInRoundAt = (round: number, column: number, teams: number) => (runsLeftToRight(round) ? column + 1 : teams - column);

/** The pick number, from 1, that the team in `column` makes in `round`. */
export const pickAt = (round: number, column: number, teams: number) => (round - 1) * teams + pickInRoundAt(round, column, teams);

/** Which pick of its round pick number `pick` is. */
export const pickInRoundOf = (pick: number, teams: number) => ((pick - 1) % teams) + 1;

/** The round pick number `pick` falls in. */
export const roundOf = (pick: number, teams: number) => Math.floor((pick - 1) / teams) + 1;

/** Who makes each pick, first to last, over `rounds` rounds of `order`: the team whose turn it is,
 *  or the team holding its pick in that round after a trade (#1096). */
export function pickMakers<Team>(order: readonly Team[], rounds: number, traded: readonly TradedPick<Team>[]): Team[] {
  return snakeOrder(order, rounds).map((turn, index) => pickOwner(traded, roundOf(index + 1, order.length), turn));
}

/** The pick numbers `team` makes, first first, over `rounds` rounds of `order`, counting the picks
 *  it holds after a trade and leaving out those it traded away. */
export function picksOf<Team>(team: Team, order: readonly Team[], rounds: number, traded: readonly TradedPick<Team>[]): number[] {
  return pickMakers(order, rounds, traded).flatMap((each, index) => (each === team ? [index + 1] : []));
}
