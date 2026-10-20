/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL } from "./football";
import { BATCH_SIZE } from "./footballSync";
import { recordedFpl, type FplPayloads } from "./recorded/fpl.payloads";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SAKA = 223340;
const MAN_CITY = { id: 15, code: 43 } as const;

/** FPL answering with `payloads`; the `refuse` URL answers 503. */
function fakeFpl(payloads: FplPayloads, refuse?: string) {
  return vi.fn(async (url: string) => {
    if (url === refuse) return new Response("Service Unavailable", { status: 503 });
    if (url === FPL_BOOTSTRAP_URL) return Response.json(payloads.bootstrap);
    if (url === FPL_FIXTURES_URL) return Response.json(payloads.fixtures);
    throw new Error(`no fake for ${url}`);
  });
}

async function syncWith(t: ReturnType<typeof convexTest>, payloads: FplPayloads, refuse?: string) {
  vi.stubGlobal("fetch", fakeFpl(payloads, refuse));
  await t.action(internal.footballSync.run, { trigger: "manual" });
  const [latest] = await t.query(internal.footballSync.latest, {});
  return latest.outcome;
}

/** Every held row of the football tables, system fields and all. */
function held(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    clubs: await ctx.db.query("clubs").collect(),
    players: await ctx.db.query("players").collect(),
    fixtures: await ctx.db.query("fixtures").collect(),
    gameweeks: await ctx.db.query("gameweeks").collect(),
  }));
}

const NOTHING_CHANGED = { inserted: 0, updated: 0 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a sync fills clubs, players, fixtures and gameweeks, and records what it wrote", async () => {
  const t = convexTest(schema, modules);

  const outcome = await syncWith(t, recordedFpl());

  expect(outcome).toEqual({
    ok: true,
    clubs: { received: 20, inserted: 20, updated: 0 },
    players: { received: 7, inserted: 7, updated: 0 },
    fixtures: { received: 3, inserted: 3, updated: 0 },
    gameweeks: { received: 3, inserted: 3, updated: 0 },
  });
  const rows = await held(t);
  expect([rows.clubs.length, rows.players.length, rows.fixtures.length, rows.gameweeks.length]).toEqual([20, 7, 3, 3]);
});

test("a re-run of the same payloads writes nothing and leaves every row as it was", async () => {
  const t = convexTest(schema, modules);
  await syncWith(t, recordedFpl());
  const before = await held(t);

  const outcome = await syncWith(t, recordedFpl());

  expect(outcome).toMatchObject({
    ok: true,
    clubs: NOTHING_CHANGED,
    players: NOTHING_CHANGED,
    fixtures: NOTHING_CHANGED,
    gameweeks: NOTHING_CHANGED,
  });
  expect(await held(t)).toEqual(before);
});

test("a new season's ids change nothing, because every row is keyed on its code", async () => {
  const t = convexTest(schema, modules);
  await syncWith(t, recordedFpl());
  const before = await held(t);

  // Next season FPL numbers everything afresh: every player, club and match gets a new id.
  const renumbered = recordedFpl();
  const newClubId = (id: number) => 21 - id;
  for (const team of renumbered.bootstrap.teams) team.id = newClubId(team.id);
  for (const player of renumbered.bootstrap.elements) {
    player.id += 1000;
    player.team = newClubId(player.team);
  }
  for (const fixture of renumbered.fixtures) {
    fixture.id += 1000;
    fixture.team_h = newClubId(fixture.team_h);
    fixture.team_a = newClubId(fixture.team_a);
  }
  const outcome = await syncWith(t, renumbered);

  expect(outcome).toMatchObject({ ok: true, clubs: NOTHING_CHANGED, players: NOTHING_CHANGED, fixtures: NOTHING_CHANGED });
  expect(await held(t)).toEqual(before);
});

test("a player who changes clubs is updated in his own row, not added again", async () => {
  const t = convexTest(schema, modules);
  await syncWith(t, recordedFpl());

  const transfer = recordedFpl();
  const saka = transfer.bootstrap.elements.find((player) => player.code === SAKA)!;
  saka.team = MAN_CITY.id;
  const outcome = await syncWith(t, transfer);

  expect(outcome).toMatchObject({ ok: true, players: { received: 7, inserted: 0, updated: 1 } });
  const sakas = (await held(t)).players.filter((player) => player.code === SAKA);
  expect(sakas).toHaveLength(1);
  expect(sakas[0].clubCode).toBe(MAN_CITY.code);
});

test("a failed fetch is recorded and logged, and nothing is written", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const t = convexTest(schema, modules);

  const outcome = await syncWith(t, recordedFpl(), FPL_BOOTSTRAP_URL);

  expect(outcome).toEqual({ ok: false, error: `${FPL_BOOTSTRAP_URL} answered 503` });
  expect(error).toHaveBeenCalledWith(expect.stringContaining("football sync failed"));
  expect(await held(t)).toEqual({ clubs: [], players: [], fixtures: [], gameweeks: [] });
});

test("a payload whose shape has changed is recorded as a failure too", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const t = convexTest(schema, modules);
  const changed = recordedFpl();
  changed.fixtures[0].team_h = 99;

  const outcome = await syncWith(t, changed);

  expect(outcome).toEqual({ ok: false, error: "FPL names club id 99, which bootstrap-static does not list" });
  expect((await held(t)).fixtures).toEqual([]);
});

test("more players than one batch holds are all written, each once", async () => {
  const t = convexTest(schema, modules);
  const crowded = recordedFpl();
  const template = crowded.bootstrap.elements[0];
  const count = BATCH_SIZE * 2 + 50;
  crowded.bootstrap.elements = Array.from({ length: count }, (_, index) => ({ ...template, id: index + 1, code: index + 1 }));

  const outcome = await syncWith(t, crowded);

  expect(outcome).toMatchObject({ ok: true, players: { received: count, inserted: count, updated: 0 } });
  const codes = (await held(t)).players.map((player) => player.code);
  expect(new Set(codes).size).toBe(count);
  expect(codes).toHaveLength(count);
});
