// A seeded draw for the tests that run on random inputs, so a failure names a seed that runs it
// again: the C library's linear congruential steps.

const MULTIPLIER = 1103515245;
const INCREMENT = 12345;
const MODULUS = 2 ** 31;

/** A draw from `seed`: each call gives a whole number from 0 to below `count`. */
export function drawn(seed: number): (count: number) => number {
  let state = seed;
  return (count: number) => {
    state = (state * MULTIPLIER + INCREMENT) % MODULUS;
    return state % count;
  };
}

/** One of `items`, by the draw. */
export const drawnFrom = <Item>(draw: (count: number) => number, items: readonly Item[]): Item => items[draw(items.length)];
