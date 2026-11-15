// The seeded random source for the tests that run on random inputs (#2127): the same seed gives
// the same cases on every run, so a failure names a seed that runs it again.

/** A random source from `seed`: each call of `next` a number in [0, 1), as Math.random gives
 *  (mulberry32, whose low bits are as random as its high ones). */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
  /** A whole number from `low` to `high`, both included. */
  const between = (low: number, high: number): number => low + Math.floor(next() * (high - low + 1));
  /** One of `items`, which mustn't be empty. */
  const oneOf = <Item>(items: readonly Item[]): Item => items[between(0, items.length - 1)];
  return { next, between, oneOf };
}

const MULTIPLIER = 1103515245;
const INCREMENT = 12345;
const MODULUS = 2 ** 31;

/** A draw from `seed`: each call gives a whole number from 0 to below `count`, by the C library's
 *  linear congruential steps. Its low bits are weak (a draw of 2 alternates); it stays so the
 *  tests on it keep their cases. */
export function drawn(seed: number): (count: number) => number {
  let state = seed;
  return (count: number) => {
    state = (state * MULTIPLIER + INCREMENT) % MODULUS;
    return state % count;
  };
}

/** One of `items`, by the draw. */
export const drawnFrom = <Item>(draw: (count: number) => number, items: readonly Item[]): Item => items[draw(items.length)];
