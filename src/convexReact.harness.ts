// A fake of convex/react for a seam's live-wiring tests, routed by function name, so a test sees
// which server function a seam reads or calls and not only what it sent. A function the test
// didn't give throws, naming it, so a mis-wired seam fails rather than passing on a shared fake.
//
// Use it from vi.mock's factory, with the fakes made by vi.hoisted:
//   vi.mock("convex/react", async () =>
//     (await import("../convexReact.harness")).fakeConvexReact({ mutations: { "squads:move": move } }));

import { getFunctionName, type FunctionReference } from "convex/server";

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
  const pick = (kind: string, fakes: Fakes) => (fn: FunctionReference<"query" | "mutation" | "action">) => {
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
