// The shortlist seam's live wiring, with Convex faked by name: what it asks the server, and that a
// refusal comes back as the server's words.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { liveShortlist } from "../../../../src/scouting/shortlist/liveShortlist";
import { shortlistChangeFailedWords } from "../../../../src/scouting/shortlist/shortlistWords";
import { silenceConsoleError } from "../../../support/console.setup";

const convex = vi.hoisted(() => ({ mine: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/shortlist:mine": convex.mine },
    mutations: { "scouting/shortlist:add": convex.add, "scouting/shortlist:remove": convex.remove },
  }),
);

const leagueId = "league-1" as Id<"leagues">;
const changes = () => renderHook(() => liveShortlist.useShortlistChanges()).result.current;

test("it asks scouting/shortlist:mine with the league, and hands on what comes back", () => {
  const list = [{ code: 1 }];
  convex.mine.mockReturnValue(list);
  expect(renderHook(() => liveShortlist.useShortlist(leagueId)).result.current).toBe(list);
  expect(convex.mine).toHaveBeenCalledWith({ leagueId });
});

test("add and remove ask their mutations with the league and the player", async () => {
  convex.add.mockResolvedValue(null);
  convex.remove.mockResolvedValue(null);
  expect(await changes().add(leagueId, 7)).toBeNull();
  expect(await changes().remove(leagueId, 7)).toBeNull();
  expect(convex.add).toHaveBeenCalledWith({ leagueId, playerCode: 7 });
  expect(convex.remove).toHaveBeenCalledWith({ leagueId, playerCode: 7 });
});

test("a refusal comes back as the server's words; any other failure is said plainly", async () => {
  convex.add.mockRejectedValue(new ConvexError("You don't run a team in this league."));
  expect(await changes().add(leagueId, 7)).toBe("You don't run a team in this league.");
  convex.remove.mockRejectedValue(new Error("offline"));
  const logged = silenceConsoleError();
  expect(await changes().remove(leagueId, 7)).toBe(shortlistChangeFailedWords);
  expect(logged).toHaveBeenCalledOnce();
});
