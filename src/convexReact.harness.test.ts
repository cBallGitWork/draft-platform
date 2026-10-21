// The convex/react fake routes by function name, and a name it wasn't given throws, naming it.

import { expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { fakeConvexReact } from "./convexReact.harness";

test("each hook gives the fake named for its function", () => {
  const squads = vi.fn(() => "the squads");
  const move = vi.fn();
  const action = vi.fn();
  const convex = fakeConvexReact({ queries: { "squads:squads": squads }, mutations: { "squads:move": move }, actions: { "squads:release": action } });

  expect(convex.useQuery(api.squads.squads, { leagueId: "league-1" })).toBe("the squads");
  expect(squads).toHaveBeenCalledExactlyOnceWith({ leagueId: "league-1" });
  expect(convex.useMutation(api.squads.move)).toBe(move);
  expect(convex.useAction(api.squads.release as never)).toBe(action);
});

test("a function it wasn't given throws, naming the function", () => {
  const convex = fakeConvexReact({ mutations: { "squads:move": vi.fn() } });
  expect(() => convex.useMutation(api.squads.assign)).toThrow("no mutation named squads:assign");
  expect(() => convex.useQuery(api.squads.squads, {})).toThrow("no query named squads:squads");
  expect(() => convex.useAction(api.squads.move as never)).toThrow("no action named squads:move");
});
