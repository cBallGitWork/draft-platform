/// <reference types="vite/client" />
// Every Convex test's shared setup: a fresh Convex, a faked fetch and a refused read, and a quiet
// console for the failures a test sets out to cause. Each test file's own harness builds its feeds
// on these.

import { convexTest, type TestConvex as TestConvexOf } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, vi } from "vitest";
import schema from "../../../convex/schema";

/** Every file in convex/, keyed by its path from here, as convex-test needs them: it finds
 *  convex/'s root by the `_generated` files among them. */
export const modules = import.meta.glob("../../../convex/**/*.ts");

export type TestConvex = TestConvexOf<typeof schema>;

/** A registered function as Convex's runtime marks it, all a sweep reads of one. */
export type RegisteredFunction = { isMutation?: boolean; isPublic?: boolean; exportArgs?: () => string };

/** Every public query, mutation and action, keyed "folder/module:name". Read from the deployed
 *  modules, so a function added later is found without anyone listing it. */
export async function publicFunctions(): Promise<Map<string, RegisteredFunction>> {
  const found = new Map<string, RegisteredFunction>();
  for (const [path, load] of Object.entries(modules)) {
    // Convex deploys only files with one dot in their name, and none of _generated.
    const module = path.match(/^(?:\.\.\/)+convex\/((?!_generated\/)[^.]+)\.ts$/)?.[1];
    if (!module) continue;
    for (const [name, exported] of Object.entries((await load()) as Record<string, unknown>)) {
      const fn = exported as RegisteredFunction | undefined;
      if (fn?.isPublic) found.set(`${module}:${name}`, fn);
    }
  }
  return found;
}

/** A test's own Convex, empty, on the real schema and functions. */
export function freshConvex(): TestConvex {
  return convexTest(schema, modules);
}

/** Writing hundreds of rows is slow in convex-test, so a test that walks a read up to its cap and
 *  past it gets longer to run. */
export const ROWS_TO_THE_CAP = { timeout: 30_000 };

/** The clock runs on to `time` with nothing else happening, firing each scheduled function as it
 *  falls due, and those they schedule that are due by then. */
export async function clockRunsTo(t: TestConvex, time: number): Promise<void> {
  vi.advanceTimersByTime(time - Date.now());
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
}

/** Lets `ms` pass, and runs every scheduled function that falls due in it. */
export async function elapse(t: TestConvex, ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
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

/** A refusal the person is shown: a ConvexError carrying the reason. A plain Error reaches the
 *  browser as "Server Error", its message lost, so matching the message alone would pass it.
 *  `label` names the case in a failure, for a check run over several. */
export async function expectRefused(attempt: Promise<unknown>, reason: string, label?: string): Promise<void> {
  const error = await attempt.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error, label).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<string>).data, label).toBe(reason);
}

// Vitest loads the setup file and this import as one module, so the flag this sets reaches the
// guard. Were they ever two copies, every silenced test would fail loudly, not pass quietly.
export { silenceConsoleError } from "../console.setup";
