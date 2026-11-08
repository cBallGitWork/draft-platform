// The scouts seam's live wiring (#375), with Convex faked by name: what it asks the server, and that a
// refusal comes back as the server's words.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { scoutRefusals } from "../../../../convex/scouting/scoutWords";
import { liveScouts } from "../../../../src/scouting/scouts/liveScouts";
import { sendScoutFailedWords } from "../../../../src/scouting/scouts/words";
import { silenceConsoleError } from "../../../support/console.setup";
import { A_LEAGUE_ID } from "../../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ mine: vi.fn(), onPlayer: vi.fn(), send: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/scouts:mine": convex.mine, "scouting/scouts:onPlayer": convex.onPlayer },
    mutations: { "scouting/scouts:send": convex.send },
  }),
);

const send = () => renderHook(() => liveScouts.useSendScout()).result.current;

test("the team's scouts are read from scouting/scouts:mine with the league", () => {
  const mine = { scouts: 3, out: [], reports: [] };
  convex.mine.mockReturnValue(mine);
  expect(renderHook(() => liveScouts.useMyScouts(A_LEAGUE_ID)).result.current).toBe(mine);
  expect(convex.mine).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID });
});

test("the trips to one player are read from scouting/scouts:onPlayer with the league and the player", () => {
  const trips = [{ playerCode: 7 }];
  convex.onPlayer.mockReturnValue(trips);
  expect(renderHook(() => liveScouts.useScoutsOn(A_LEAGUE_ID, 7)).result.current).toBe(trips);
  expect(convex.onPlayer).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: 7 });
});

test("sending asks scouting/scouts:send with the league and the player; a refusal comes back as the server's words, any other failure plainly", async () => {
  convex.send.mockResolvedValue(null);
  expect(await send()(A_LEAGUE_ID, 7)).toBeNull();
  expect(convex.send).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: 7 });

  convex.send.mockRejectedValue(new ConvexError(scoutRefusals.allOut(3)));
  expect(await send()(A_LEAGUE_ID, 7)).toBe(scoutRefusals.allOut(3));
  convex.send.mockRejectedValue(new Error("offline"));
  const logged = silenceConsoleError();
  expect(await send()(A_LEAGUE_ID, 7)).toBe(sendScoutFailedWords);
  expect(logged).toHaveBeenCalledOnce();
});
