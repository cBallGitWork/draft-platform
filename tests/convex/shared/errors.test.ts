import { describe, expect, it } from "vitest";
import { leagueLabel, outcomeOf } from "../../../convex/shared/errors";
import { silenceConsoleError } from "../../support/convex/test.harness";

const FAILURE_WORDS = "test feed failed";

describe("outcomeOf", () => {
  it("gives a work's ok outcome unchanged", async () => {
    const ok = { ok: true as const, matches: [1, 2] };
    expect(await outcomeOf(FAILURE_WORDS, async () => ok)).toBe(ok);
  });

  it("gives { ok: false, error } when the work throws, and logs it under the failure words", async () => {
    const consoleError = silenceConsoleError();
    const outcome = await outcomeOf(FAILURE_WORDS, async (): Promise<{ ok: true }> => {
      throw new Error("feed down");
    });
    expect(outcome).toEqual({ ok: false, error: "feed down" });
    expect(consoleError.mock.calls).toEqual([[`${FAILURE_WORDS}: feed down`]]);
  });
});

describe("leagueLabel", () => {
  it("names a league in a failure line by its id and name", () => {
    expect(leagueLabel({ _id: "k123", name: "Sunday League" })).toBe("League k123 (Sunday League)");
  });
});
