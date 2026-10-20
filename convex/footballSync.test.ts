import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { FPL_BOOTSTRAP_URL } from "./football";
import { BATCH_SIZE } from "./footballSync";
import { held, modules, NOTHING_CHANGED, syncWith } from "./footballSync.harness";
import { CLUB_CODE, RECORDED_COUNT, recordedFpl } from "./recorded/fpl.payloads";
import schema from "./schema";

const SAKA = 223340;
const MAN_CITY = { id: 15, code: CLUB_CODE.manCity } as const;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a sync fills clubs, players, fixtures and gameweeks, and records what it wrote", async () => {
  const t = convexTest(schema, modules);

  const outcome = await syncWith(t, recordedFpl());

  const { clubs, players, fixtures, gameweeks } = RECORDED_COUNT;
  expect(outcome).toEqual({
    ok: true,
    clubs: { received: clubs, inserted: clubs, updated: 0, marked: 0, unmarked: 0 },
    players: { received: players, inserted: players, updated: 0, marked: 0, unmarked: 0 },
    fixtures: { received: fixtures, inserted: fixtures, updated: 0, marked: 0, unmarked: 0 },
    gameweeks: { received: gameweeks, inserted: gameweeks, updated: 0, marked: 0, unmarked: 0 },
  });
  const rows = await held(t);
  expect({
    clubs: rows.clubs.length,
    players: rows.players.length,
    fixtures: rows.fixtures.length,
    gameweeks: rows.gameweeks.length,
  }).toEqual(RECORDED_COUNT);
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

  expect(outcome).toMatchObject({ ok: true, players: { received: RECORDED_COUNT.players, inserted: 0, updated: 1 } });
  const sakas = (await held(t)).players.filter((player) => player.code === SAKA);
  expect(sakas).toHaveLength(1);
  expect(sakas[0].clubCode).toBe(MAN_CITY.code);
});

test("a rescheduled match and its moved deadline are updated in their own rows", async () => {
  const t = convexTest(schema, modules);
  await syncWith(t, recordedFpl());

  // Gameweek 8's opener moves back a day, and FPL's deadline with it.
  const gameweekNumber = 8;
  const newKickoff = "2026-10-24T19:00:00Z";
  const newDeadline = "2026-10-24T17:30:00Z";
  const moved = recordedFpl();
  const opener = moved.fixtures.find((fixture) => fixture.event === gameweekNumber)!;
  const fplGameweek = moved.bootstrap.events.find((event) => event.id === gameweekNumber)!;
  opener.kickoff_time = newKickoff;
  fplGameweek.deadline_time = newDeadline;
  const outcome = await syncWith(t, moved);

  expect(outcome).toMatchObject({
    ok: true,
    fixtures: { received: RECORDED_COUNT.fixtures, inserted: 0, updated: 1 },
    gameweeks: { received: RECORDED_COUNT.gameweeks, inserted: 0, updated: 1 },
  });
  const rows = await held(t);
  expect(rows.fixtures.find((fixture) => fixture.code === opener.code)?.kickoff).toBe(Date.parse(newKickoff));
  expect(rows.gameweeks.find((gameweek) => gameweek.number === gameweekNumber)?.deadline).toBe(Date.parse(newDeadline));
});

test("a corrected name, a postponed match and a changed club are each updated on re-sync", async () => {
  const t = convexTest(schema, modules);
  await syncWith(t, recordedFpl());

  // One field per row, so each field's change is counted on its own.
  const corrected = recordedFpl();
  const [club1, club2] = corrected.bootstrap.teams;
  const [player1, player2] = corrected.bootstrap.elements;
  const [postponed, newHome, newAway] = corrected.fixtures;
  const playingIn = new Set(corrected.fixtures.flatMap((fixture) => [fixture.team_h, fixture.team_a]));
  const idleClub = corrected.bootstrap.teams.find((team) => !playingIn.has(team.id))!;
  club1.name = "Renamed FC";
  club2.short_name = "XXX";
  player1.web_name = "Corrected";
  player2.first_name = "Respelt";
  postponed.event = null;
  newHome.team_h = idleClub.id;
  newAway.team_a = idleClub.id;
  const outcome = await syncWith(t, corrected);

  expect(outcome).toMatchObject({
    ok: true,
    clubs: { inserted: 0, updated: 2 },
    players: { inserted: 0, updated: 2 },
    fixtures: { inserted: 0, updated: 3 },
    gameweeks: NOTHING_CHANGED,
  });
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
