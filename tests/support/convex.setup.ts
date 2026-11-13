// The convex project's setup (vitest.config.ts): its tests run as the live site does, with the timed
// feed, waiver and trade jobs on (#1997, heartbeats/heartbeat.ts's `timedJobsOn`). A test of them off
// stubs the setting empty, and the project puts this back after it.

import { TIMED_JOBS_SETTING } from "../../convex/outbound/deploymentSettings";

process.env[TIMED_JOBS_SETTING] = "on";
