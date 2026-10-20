// The football sync's tests' shared setup: a faked FPL, one sync run against it, and what it left
// held. For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import type { Infer } from "convex/values";
import { vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL } from "./football";
import { BATCH_SIZE } from "./footballSync";
import { recordedFpl, type FplPayloads } from "./recorded/fpl.payloads";
import type { syncTrigger } from "./schema";
import { fakeFetch, type TestConvex } from "./test.harness";

const UNLISTED_CLUB_ID = 99;

/** FPL answering with `payloads`; the `refuse` URL answers `REFUSED_STATUS`. */
function fakeFpl(payloads: FplPayloads, refuse?: string) {
  const bodies = new Map<string, unknown>([
    [FPL_BOOTSTRAP_URL, payloads.bootstrap],
    [FPL_FIXTURES_URL, payloads.fixtures],
  ]);
  return fakeFetch(bodies, (url) => url === refuse);
}

/** One sync against `payloads`, started by hand unless `trigger` says the cron, and the run row it
 *  recorded. */
export async function syncRun(
  t: TestConvex,
  payloads: FplPayloads,
  refuse?: string,
  trigger: Infer<typeof syncTrigger> = "manual",
) {
  vi.stubGlobal("fetch", fakeFpl(payloads, refuse));
  await t.action(internal.footballSync.run, { trigger });
  const [latest] = await t.query(internal.footballSync.latest, {});
  return latest;
}

/** One sync against `payloads`, and the outcome on its run row. */
export async function syncWith(t: TestConvex, payloads: FplPayloads, refuse?: string) {
  return (await syncRun(t, payloads, refuse)).outcome;
}

/** Every held row of the football tables, system fields and all. */
export function held(t: TestConvex) {
  return t.run(async (ctx) => ({
    clubs: await ctx.db.query("clubs").collect(),
    players: await ctx.db.query("players").collect(),
    fixtures: await ctx.db.query("fixtures").collect(),
    gameweeks: await ctx.db.query("gameweeks").collect(),
  }));
}

/** How many rows each football table holds. */
export async function heldCounts(t: TestConvex) {
  const rows = await held(t);
  return {
    clubs: rows.clubs.length,
    players: rows.players.length,
    fixtures: rows.fixtures.length,
    gameweeks: rows.gameweeks.length,
  };
}

/** A table's share of a sync that wrote nothing: no row new, changed, marked or unmarked. */
export const NOTHING_CHANGED = { inserted: 0, updated: 0, marked: 0, unmarked: 0 };

/** Changes `payloads` so its first match names a club bootstrap-static does not list, which
 *  refuses the payload as changed; returns the failure the sync records. */
export function nameAnUnlistedClub(payloads: FplPayloads): string {
  payloads.fixtures[0].team_h = UNLISTED_CLUB_ID;
  return `FPL names club id ${UNLISTED_CLUB_ID}, which bootstrap-static does not list`;
}

/** The recording with its players swapped for more than two batches' worth, codes 1 upward. */
export function crowdedFpl(): { payloads: FplPayloads; count: number } {
  const payloads = recordedFpl();
  const template = payloads.bootstrap.elements[0];
  const count = BATCH_SIZE * 2 + 50;
  payloads.bootstrap.elements = Array.from({ length: count }, (_, index) => {
    const idAndCode = index + 1;
    return { ...template, id: idAndCode, code: idAndCode };
  });
  return { payloads, count };
}
