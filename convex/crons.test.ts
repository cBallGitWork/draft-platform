import { expect, test } from "vitest";
import crons from "./crons";

// Nothing else starts the sync: without this job the league's football data goes stale silently.
test("the football sync is registered to run unattended every six hours", () => {
  expect(Object.values(crons.crons)).toContainEqual({
    name: "footballSync:run",
    args: [{ trigger: "cron" }],
    schedule: { type: "interval", hours: 6 },
  });
});

// The live poller has no other trigger: without this job, points stand still during matches.
test("the live stats tick is registered to run unattended every minute", () => {
  expect(Object.values(crons.crons)).toContainEqual({
    name: "liveStatsSync:tick",
    args: [{}],
    schedule: { type: "interval", minutes: 1 },
  });
});
