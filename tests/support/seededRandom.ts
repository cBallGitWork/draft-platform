// A seeded random source for the tests that try many generated cases (#2127): the same seed gives
// the same cases on every run, so a failing seed can be run again and named in the test.

/** A random source from `seed`: each call of `next` a number in [0, 1), as Math.random gives
 *  (mulberry32). */
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
