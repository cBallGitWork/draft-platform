// The shortlist seam's live wiring, with Convex faked by name: what it asks the server, and that a
// refusal comes back as the server's words.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { liveShortlist } from "../../../../src/scouting/shortlist/liveShortlist";
import { shortlistChangeFailedWords } from "../../../../src/scouting/shortlist/shortlistWords";
import { silenceConsoleError } from "../../../support/console.setup";
import { refusals } from "../../../../convex/shared/leagueAccess";
import { A_LEAGUE_ID } from "../../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ mine: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/shortlist:mine": convex.mine },
    mutations: { "scouting/shortlist:add": convex.add, "scouting/shortlist:remove": convex.remove },
  }),
);

const changes = () => renderHook(() => liveShortlist.useShortlistChanges()).result.current;

test("it asks scouting/shortlist:mine with the league, and hands on what comes back", () => {
  const list = [{ code: 1 }];
  convex.mine.mockReturnValue(list);
  expect(renderHook(() => liveShortlist.useShortlist(A_LEAGUE_ID)).result.current).toBe(list);
  expect(convex.mine).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID });
});

test("add and remove ask their mutations with the league and the player", async () => {
  convex.add.mockResolvedValue(null);
  convex.remove.mockResolvedValue(null);
  expect(await changes().add(A_LEAGUE_ID, 7)).toBeNull();
  expect(await changes().remove(A_LEAGUE_ID, 7)).toBeNull();
  expect(convex.add).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: 7 });
  expect(convex.remove).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: 7 });
});

test("a refusal comes back as the server's words; any other failure is said plainly", async () => {
  convex.add.mockRejectedValue(new ConvexError(refusals.runsNoTeam));
  expect(await changes().add(A_LEAGUE_ID, 7)).toBe(refusals.runsNoTeam);
  convex.remove.mockRejectedValue(new Error("offline"));
  const logged = silenceConsoleError();
  expect(await changes().remove(A_LEAGUE_ID, 7)).toBe(shortlistChangeFailedWords);
  expect(logged).toHaveBeenCalledOnce();
});
