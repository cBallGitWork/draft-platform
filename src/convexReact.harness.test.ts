// The convex/react fake routes by function name, and a name it wasn't given throws, naming it.

import { expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { fakeConvexReact } from "./convexReact.harness";

test("each hook gives the fake named for its function", () => {
  const squads = vi.fn(() => "the squads");
  const move = vi.fn();
  const action = vi.fn();
  const args = { leagueId: "league-1" };
  const convex = fakeConvexReact({ queries: { "squads:squads": squads }, mutations: { "squads:move": move }, actions: { "signInLinks:ask": action } });

  expect(convex.useQuery(api.squads.squads, args)).toBe("the squads");
  expect(squads).toHaveBeenCalledExactlyOnceWith(args);
  expect(convex.useMutation(api.squads.move)).toBe(move);
  expect(convex.useAction(api.signInLinks.ask)).toBe(action);
});

test("a function it wasn't given throws, naming the function", () => {
  const convex = fakeConvexReact({ mutations: { "squads:move": vi.fn() } });
  expect(() => convex.useMutation(api.squads.assign)).toThrow("no mutation named squads:assign");
  expect(() => convex.useQuery(api.squads.squads, {})).toThrow("no query named squads:squads");
  expect(() => convex.useAction(api.inviteLink.signInToJoin)).toThrow("no action named inviteLink:signInToJoin");
});
