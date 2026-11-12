// A waiver run in the manager's own zone on My team's claims, as Scouting and the player card tell
// it (#1751; spec/12, Times: every time a person reads on a screen is in their own zone).

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAY_MS } from "../../../convex/shared/time";
import { MY_TEAM_TRANSACTIONS_PATH } from "../../../src/frame/menu";
import { RUNS_TITLE } from "../../../src/myTeam/claims/words";
import { NO_WAIVERS } from "../../support/src/myTeam.harness";
import { manager, openApp } from "../../support/src/shell.harness";

/** Wednesday's 18:00 run in London, winter, so 13:00 in New York. */
const WED = Date.parse("2026-11-11T18:00:00Z");
const NEW_YORK = "America/New_York";

describe("a run in the manager's own zone", () => {
  const zone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = zone;
    vi.resetModules();
  });

  it("a manager in New York reads Wednesday's 18:00 UK run as 13:00, the same on My team as elsewhere", async () => {
    process.env.TZ = NEW_YORK;
    vi.resetModules();
    const claims = await import("../../../src/myTeam/claims/words");
    const shared = await import("../../../src/shared/words");
    expect(claims.runShort(WED)).toBe("Wed 13:00");
    expect(claims.runShort(WED)).toBe(shared.weekdayTimeWords(WED));
    expect(claims.runWords(WED)).toBe(shared.whenWords(WED));
    expect(claims.runDayWords(WED)).toBe(shared.weekdayWords(WED));
  });

  it("the runs panel names no zone", async () => {
    openApp(MY_TEAM_TRANSACTIONS_PATH, manager, { myTeam: { waivers: { ...NO_WAIVERS, runs: [{ at: WED, skippedIf: null }], windowShuts: { gameweek: 12, at: WED + DAY_MS } } } });
    expect((await screen.findByRole("region", { name: RUNS_TITLE })).textContent).not.toContain("UK time");
  });
});
