/// <reference types="vite/client" />
// The football sync's tests' shared setup: a faked FPL, one sync run against it, and what it left
// held. For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import type { convexTest } from "convex-test";
import { vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL } from "./football";
import type { FplPayloads } from "./recorded/fpl.payloads";

type TestConvex = ReturnType<typeof convexTest>;

export const modules = import.meta.glob("./**/*.ts");

/** FPL answering with `payloads`; the `refuse` URL answers 503. */
function fakeFpl(payloads: FplPayloads, refuse?: string) {
  return vi.fn(async (url: string) => {
    if (url === refuse) return new Response("Service Unavailable", { status: 503 });
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

export const NOTHING_CHANGED = { inserted: 0, updated: 0 };
