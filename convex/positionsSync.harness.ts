/// <reference types="vite/client" />
// The positions tests' shared setup: both feeds faked from the recorded payloads, one sync run
// against them, and a player's positions read back. For the tests only: the second dot in this
// file's name keeps it out of Convex's deploy.

import type { TestConvex as TestConvexOf } from "convex-test";
import { vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, plFixturesUrl, plFixtureUrl, plSquadUrl } from "./football";
import type { PositionsPayloads } from "./recorded/positions.payloads";
import type schema from "./schema";

export type TestConvex = TestConvexOf<typeof schema>;

export const modules = import.meta.glob("./**/*.ts");

export const REFUSED_STATUS = 503;

/** Both feeds answering with `payloads`; the `refuse` URL answers `REFUSED_STATUS`. Any other URL
 *  is the test's mistake, and fails the read. */
function fakeFeeds(payloads: PositionsPayloads, refuse?: string) {
  const bodies = new Map<string, unknown>([[FPL_BOOTSTRAP_URL, { elements: payloads.fplElements }]]);
  for (const [season, content] of Object.entries(payloads.fixtureLists)) {
    bodies.set(plFixturesUrl(undefined, Number(season)), { content });
  }
  for (const sheet of payloads.sheets) bodies.set(plFixtureUrl(sheet.id), sheet);
  for (const [team, squad] of Object.entries(payloads.squads)) bodies.set(plSquadUrl(Number(team)), squad);
  return vi.fn(async (url: string) => {
    if (url === refuse) return new Response("Service Unavailable", { status: REFUSED_STATUS });
    if (!bodies.has(url)) throw new Error(`no fake for ${url}`);
    return Response.json(bodies.get(url));
  });
}

/** One sync against `payloads`, and the outcome it recorded. */
export async function syncPositionsWith(t: TestConvex, payloads: PositionsPayloads, refuse?: string) {
  const fetch = fakeFeeds(payloads, refuse);
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.positionsSync.run, { trigger: "manual" });
  const [latest] = await t.query(internal.positionsSync.latest, {});
  return { outcome: latest.outcome, urls: fetch.mock.calls.map(([url]) => url) };
}

/** A player's positions, as `{position: source}` with "?" on each unconfirmed, e.g. `{W: "label?"}`. */
export async function positionsOf(t: TestConvex, code: number): Promise<Record<string, string>> {
  const { positions } = await t.query(internal.playerPositions.ofPlayer, { code });
  return Object.fromEntries(positions.map((held) => [held.position, held.source + (held.confirmed ? "" : "?")]));
}
