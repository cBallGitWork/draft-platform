// The convex/react fake routes by function name, and a name it wasn't given throws, naming it.

import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { A_LEAGUE_ID, fakeConvexReact } from "../support/src/convexReact.harness";

test("each hook gives the fake named for its function", () => {
  const squads = vi.fn(() => "the squads");
  const move = vi.fn();
  const action = vi.fn();
  const args = { leagueId: A_LEAGUE_ID };
  const convex = fakeConvexReact({ queries: { "squads/squads:squads": squads }, mutations: { "squads/squads:move": move }, actions: { "signIn/signInLinks:ask": action } });

  expect(convex.useQuery(api.squads.squads.squads, args)).toBe("the squads");
  expect(squads).toHaveBeenCalledExactlyOnceWith(args);
  expect(convex.useMutation(api.squads.squads.move)).toBe(move);
  expect(convex.useAction(api.signIn.signInLinks.ask)).toBe(action);
});

test("a function it wasn't given throws, naming the function", () => {
  const convex = fakeConvexReact({ mutations: { "squads/squads:move": vi.fn() } });
  expect(() => convex.useMutation(api.squads.squads.assign)).toThrow("no mutation named squads/squads:assign");
  expect(() => convex.useQuery(api.squads.squads.squads, {})).toThrow("no query named squads/squads:squads");
  expect(() => convex.useAction(api.joining.inviteLink.signInToJoin)).toThrow("no action named joining/inviteLink:signInToJoin");
});
