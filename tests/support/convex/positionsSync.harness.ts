/// <reference types="vite/client" />
// The positions tests' shared setup: both feeds faked from the recorded payloads, one sync run
// against them, the line it logs, and a player's positions read back.

import { vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { FPL_BOOTSTRAP_URL, plFixturesUrl, plFixtureUrl, plSquadUrl } from "../../../convex/football/football";
import { ADMIN, actingAs } from "./leagues.harness";
import { SHEET, type PositionsPayloads } from "../recorded/positions.payloads";
import { fakeFetch, type TestConvex } from "./test.harness";

/** The recorded payloads' one match whose sheet doesn't add up, as a run reports it refused. */
export const REFUSED_MATCH = `PL fixture ${SHEET.cityCoventryRefused}, team 11's 4-2-3-1 does not draw the 11 men it lists as starting`;

/** The line a run logs for what it could not place: the recorded payloads' refused match, and any
 *  formation or label the table does not know. */
export function reported(unknown: { unknownFormations?: string[]; unknownLabels?: string[] } = {}): string {
  return `positions sync: ${JSON.stringify({ unknownFormations: [], unknownLabels: [], matchesRefused: [REFUSED_MATCH], ...unknown })}`;
}

/** Both feeds answering with `payloads`, and refusing the `refuse` URL as `fakeFetch` does. */
function fakeFeeds(payloads: PositionsPayloads, refuse?: string) {
  const bodies = new Map<string, unknown>([[FPL_BOOTSTRAP_URL, { elements: payloads.fplElements }]]);
  for (const [season, content] of Object.entries(payloads.fixtureLists)) {
    bodies.set(plFixturesUrl(undefined, Number(season)), { content });
  }
  for (const sheet of payloads.sheets) bodies.set(plFixtureUrl(sheet.id), sheet);
  for (const [team, squad] of Object.entries(payloads.squads)) bodies.set(plSquadUrl(Number(team)), squad);
  return fakeFetch(bodies, (url) => url === refuse);
}

/** One sync against `payloads`, run at `at` when given (the feeds are faked first, at the real
 *  time): the outcome it recorded, and the URLs it asked for. */
export async function syncPositionsWith(t: TestConvex, payloads: PositionsPayloads, refuse?: string, at?: number) {
  const fetch = fakeFeeds(payloads, refuse);
  vi.stubGlobal("fetch", fetch);
  if (at !== undefined) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
  }
  await t.action(internal.positions.positionsSync.run, { trigger: "manual" });
  const [latest] = await t.query(internal.positions.positionsSync.latest, {});
  return { outcome: latest.outcome, urls: fetch.mock.calls.map(([url]) => url) };
}

/** The admin, signed in: every function in playerPositions.ts is his alone. */
export function asAdmin(t: TestConvex) {
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  return actingAs(t, ADMIN);
}

/** A player's positions, as `{position: source}` with "?" on each unconfirmed, e.g. `{W: "label?"}`. */
export async function heldPositions(t: TestConvex, code: number): Promise<Record<string, string>> {
  const { positions } = await (await asAdmin(t)).query(api.positions.playerPositions.ofPlayer, { code });
  return Object.fromEntries(positions.map((held) => [held.position, held.source + (held.confirmed ? "" : "?")]));
}
