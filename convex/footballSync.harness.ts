/// <reference types="vite/client" />
// The football sync's tests' shared setup: a faked FPL, one sync run against it, and what it left
// held. For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import type { convexTest } from "convex-test";
import { vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL } from "./football";
import { BATCH_SIZE } from "./footballSync";
import { recordedFpl, type FplPayloads } from "./recorded/fpl.payloads";

type TestConvex = ReturnType<typeof convexTest>;

export const modules = import.meta.glob("./**/*.ts");

const REFUSED_STATUS = 503;
const UNLISTED_CLUB_ID = 99;

/** FPL answering with `payloads`; the `refuse` URL answers `REFUSED_STATUS`. */
function fakeFpl(payloads: FplPayloads, refuse?: string) {
  return vi.fn(async (url: string) => {
    if (url === refuse) return new Response("Service Unavailable", { status: REFUSED_STATUS });
    if (url === FPL_BOOTSTRAP_URL) return Response.json(payloads.bootstrap);
    if (url === FPL_FIXTURES_URL) return Response.json(payloads.fixtures);
    throw new Error(`no fake for ${url}`);
  });
}

/** One sync against `payloads`, and the run row it recorded. */
export async function syncRun(t: TestConvex, payloads: FplPayloads, refuse?: string) {
  vi.stubGlobal("fetch", fakeFpl(payloads, refuse));
  await t.action(internal.footballSync.run, { trigger: "manual" });
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

export const NOTHING_CHANGED = { inserted: 0, updated: 0 };

/** The failure a sync records when FPL refuses `url`. */
export function refusedError(url: string): string {
  return `${url} answered ${REFUSED_STATUS}`;
}

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
