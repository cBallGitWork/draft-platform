/// <reference types="vite/client" />
// Every Convex test's shared setup: a fresh Convex, a faked fetch and a refused read, and a quiet
// console for the failures a test sets out to cause. Each test file's own harness builds its feeds
// on these. For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import { convexTest, type TestConvex as TestConvexOf } from "convex-test";
import { vi } from "vitest";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.ts");

export type TestConvex = TestConvexOf<typeof schema>;

/** A test's own Convex, empty, on the real schema and functions. */
export function freshConvex(): TestConvex {
  return convexTest(schema, modules);
}

/** What a faked feed answers a URL it refuses. */
export const REFUSED_STATUS = 503;

/** A fetch answering each URL with its body in `bodies`, and each URL `refuses` picks with
 *  `REFUSED_STATUS`. Any other URL is the test's mistake: it throws, naming the URL. */
export function fakeFetch(bodies: ReadonlyMap<string, unknown>, refuses: (url: string) => boolean = () => false) {
  return vi.fn(async (url: string) => {
    if (refuses(url)) return new Response("Service Unavailable", { status: REFUSED_STATUS });
    if (!bodies.has(url)) throw new Error(`no fake for ${url}`);
    return Response.json(bodies.get(url));
  });
}

/** The failure a read records when a faked feed refuses `url`. */
export function refusedError(url: string): string {
  return `${url} answered ${REFUSED_STATUS}`;
}

/** Keeps console.error quiet for the test, where a logged failure is what it causes; the spy is
 *  returned to check what was logged. Vitest restores it after the test (vitest.config.ts). */
export function silenceConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}
