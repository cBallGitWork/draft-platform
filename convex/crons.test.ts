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
