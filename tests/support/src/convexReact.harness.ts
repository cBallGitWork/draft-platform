// A fake of convex/react for a seam's live-wiring tests, routed by function name, so a test sees
// which server function a seam reads or calls and not only what it sent. A function the test
// didn't give throws, naming it, so a mis-wired seam fails rather than passing on a shared fake.
//
// Use it from vi.mock's factory, with the fakes made by vi.hoisted:
//   vi.mock("convex/react", async () =>
//     (await import("../../support/src/convexReact.harness")).fakeConvexReact({ mutations: { "squads/squads:move": move } }));

import { getFunctionName, type FunctionReference, type FunctionType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";

/** The made-up league every live-wiring test reads and writes in. */
export const A_LEAGUE_ID = "league-1" as Id<"leagues">;

type Fakes = Record<string, (...args: never[]) => unknown>;

export interface ConvexReactFakes {
  /** Each is called with the query's args (or "skip"), and its return is what useQuery gives. */
  queries?: Fakes;
  /** Each is what useMutation gives for that name. */
  mutations?: Fakes;
  /** Each is what useAction gives for that name. */
  actions?: Fakes;
}

export function fakeConvexReact({ queries = {}, mutations = {}, actions = {} }: ConvexReactFakes) {
  const pick = (kind: FunctionType, fakes: Fakes) => (fn: FunctionReference<FunctionType>) => {
    const name = getFunctionName(fn);
    const fake = fakes[name];
    if (!fake) throw new Error(`The convex/react fake was given no ${kind} named ${name}.`);
    return fake as (...args: unknown[]) => unknown;
  };
  const query = pick("query", queries);
  return {
    useQuery: (fn: FunctionReference<"query">, ...args: unknown[]) => query(fn)(...args),
    useMutation: pick("mutation", mutations),
    useAction: pick("action", actions),
  };
}
