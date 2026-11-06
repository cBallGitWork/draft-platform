import { expect, test } from "vitest";
import crons from "../../convex/crons";

// spec/20, "Timed jobs": the same four run on the live site and on development, and nothing else
// starts any of them. Without the football sync the league's data goes stale silently; without the
// live tick points stand still during matches; without late stats a match still unsettled when
// the live window ends is never read again; without waiver runs no claim is ever made (spec/08,
// #1198); without the positions sync a player's positions and stars stand still (#1194); without
// the clean-up the run logs grow for ever.
test("exactly six timed jobs run: football every six hours, live stats every minute, late stats every 10 minutes, waiver runs every 5 minutes, positions daily at 06:00 UK, clean-up daily", () => {
  expect(crons.crons).toEqual({
    // 05:00 and 06:00 UTC, and only the one at 06:00 UK runs it (positionsSync.daily).
    "positions sync": { name: "positions/positionsSync:daily", args: [{}], schedule: { type: "cron", cron: "0 5,6 * * *" } },
    "football sync": { name: "football/footballSync:run", args: [{ trigger: "cron" }], schedule: { type: "interval", hours: 6 } },
    "live stats tick": { name: "stats/liveStatsSync:tick", args: [{}], schedule: { type: "interval", minutes: 1 } },
    "late stats": { name: "stats/matchStatsSync:run", args: [{ trigger: "cron" }], schedule: { type: "interval", minutes: 10 } },
    "waiver runs": { name: "waivers/waiverRun:runDue", args: [{}], schedule: { type: "interval", minutes: 5 } },
    "prune run logs": { name: "admin/runLogs:prune", args: [{}], schedule: { type: "interval", hours: 24 } },
  });
});
