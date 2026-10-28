/// <reference types="vite/client" />
// Every Convex test's shared setup: a fresh Convex, a faked fetch and a refused read, and a quiet
// console for the failures a test sets out to cause. Each test file's own harness builds its feeds
// on these.

import { convexTest, type TestConvex as TestConvexOf } from "convex-test";
import { vi } from "vitest";
import schema from "../../../convex/schema";

/** Every file in convex/, keyed by its path from here, as convex-test needs them: it finds
 *  convex/'s root by the `_generated` files among them. */
export const modules = import.meta.glob("../../../convex/**/*.ts");

export type TestConvex = TestConvexOf<typeof schema>;

/** A test's own Convex, empty, on the real schema and functions. */
export function freshConvex(): TestConvex {
  return convexTest(schema, modules);
}

/** What a faked feed answers a URL it refuses, unless the test names another status. */
export const REFUSED_STATUS = 503;

/** A fetch answering each URL with its body in `bodies`, and each URL `refuses` picks with
 *  `refusedStatus`. Any other URL is the test's mistake: it throws, naming the URL. */
export function fakeFetch(
  bodies: ReadonlyMap<string, unknown>,
  refuses: (url: string) => boolean = () => false,
  refusedStatus = REFUSED_STATUS,
) {
  return vi.fn(async (url: string) => {
    if (refuses(url)) return new Response(null, { status: refusedStatus });
    if (!bodies.has(url)) throw new Error(`no fake for ${url}`);
    return Response.json(bodies.get(url));
  });
}

/** The failure a read records when a faked feed refuses `url`. */
export function refusedError(url: string): string {
  return `${url} answered ${REFUSED_STATUS}`;
}

// Vitest loads the setup file and this import as one module, so the flag this sets reaches the
// guard. Were they ever two copies, every silenced test would fail loudly, not pass quietly.
export { silenceConsoleError } from "../console.setup";
