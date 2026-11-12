import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { pickFirstLineupAgain, storeAutoTeamLineup } from "../../../convex/lineup/lineups";
import type { Area, Lane } from "../../../convex/lineup/pitch";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { FOUR_FOUR_TWO, holdSquad, NEXT, SQUAD, STARTERS } from "../../support/convex/lineupSquad.harness";

// The three writers of a team's lineup row, each through lineupRows.ts's one writer (#1759): the
// whole row each leaves, adding a row from the gameweek and replacing the one already from it.
// Each keeps or clears the rest of the row as it did before #1759.

const [ANN] = MANAGERS;
/** The gameweek before the next, from which a row rolls over into it. */
const BEFORE = NEXT - 1;
/** Every optional field of a row, set, as an earlier save or the auto team could leave them. */
const EXTRAS = {
  classic: "4-4-2",
  instructions: { attacking: "direct", defensive: "press" },
  keptOutOfPosition: [STARTERS[0]],
} as const;
/** The 4-4-2's starters as a row stores them: every cell one on the pitch. */
const ROW_STARTERS = FOUR_FOUR_TWO.starters.map(({ area, lane, ...starter }) => ({ ...starter, area: area as Area, lane: lane as Lane }));

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdSquad(t, leagueId, annsTeam);
});

/** Ann's rows replaced by one from `fromGameweek` holding the extras, a first lineup or not. */
const seedRow = (fromGameweek: number, { firstLineup }: { firstLineup: boolean }) =>
  t.run(async (ctx) => {
    for (const row of await ctx.db.query("lineups").collect()) if (row.teamId === annsTeam) await ctx.db.delete("lineups", row._id);
    await ctx.db.insert("lineups", {
      leagueId,
      teamId: annsTeam,
      fromGameweek,
      starters: ROW_STARTERS,
      bench: [...FOUR_FOUR_TWO.bench].toReversed(),
      ...EXTRAS,
      instructions: { ...EXTRAS.instructions },
      keptOutOfPosition: [...EXTRAS.keptOutOfPosition],
      ...(firstLineup && { firstLineup: true as const }),
    });
  });

/** Ann's row from the next gameweek, all of it but Convex's own fields. */
const nextRow = () =>
  t.run(async (ctx) => {
    const row = (await ctx.db.query("lineups").collect()).find((row) => row.teamId === annsTeam && row.fromGameweek === NEXT);
    if (row === undefined) return undefined;
    const { _id, _creationTime, ...fields } = row;
    return fields;
  });
/** The row's fields besides its players. */
const besidesPlayers = (row: Partial<Doc<"lineups">> | undefined) => {
  const { starters: _starters, bench: _bench, ...rest } = row ?? {};
  return rest;
};
/** The fields naming the row: Ann's, from the next gameweek. */
const rowKeys = () => ({ leagueId, teamId: annsTeam, fromGameweek: NEXT });
/** Every player in the row, sorted: the whole squad, starting or benched. */
const playersOf = (row: Partial<Doc<"lineups">> | undefined) => [...(row?.starters ?? []).map(({ playerCode }) => playerCode), ...(row?.bench ?? [])].toSorted();

describe("a manager's save", () => {
  const save = async () =>
    (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: [...FOUR_FOUR_TWO.starters], bench: [...FOUR_FOUR_TWO.bench] } });

  test("adds a row holding only what it was sent", async () => {
    await seedRow(BEFORE, { firstLineup: true });
    await save();
    expect(await nextRow()).toEqual({ ...rowKeys(), starters: FOUR_FOUR_TWO.starters, bench: FOUR_FOUR_TWO.bench });
  });

  test("replaces the gameweek's row, clearing the rest of it", async () => {
    await seedRow(NEXT, { firstLineup: true });
    await save();
    expect(await nextRow()).toEqual({ ...rowKeys(), starters: FOUR_FOUR_TWO.starters, bench: FOUR_FOUR_TWO.bench });
  });
});

describe("the first lineup, picked again", () => {
  const pickAgain = () => t.run((ctx) => pickFirstLineupAgain(ctx, leagueId, annsTeam));

  test("adds a row holding only the players, marked first", async () => {
    await seedRow(BEFORE, { firstLineup: true });
    await pickAgain();
    const row = await nextRow();
    expect(besidesPlayers(row)).toEqual({ ...rowKeys(), firstLineup: true });
    expect(playersOf(row)).toEqual(SQUAD.toSorted());
  });

  test("replaces only the players of the gameweek's row, leaving the rest", async () => {
    await seedRow(NEXT, { firstLineup: true });
    await pickAgain();
    const row = await nextRow();
    expect(besidesPlayers(row)).toEqual({ ...rowKeys(), ...EXTRAS, firstLineup: true });
    expect(playersOf(row)).toEqual(SQUAD.toSorted());
  });
});

describe("the auto team's lineup", () => {
  const AUTO = { starters: ROW_STARTERS, bench: [...FOUR_FOUR_TWO.bench] };
  const store = () => t.run((ctx) => storeAutoTeamLineup(ctx, leagueId, annsTeam, NEXT, AUTO));

  // Who the row in force kept out of position and still stands where he was stays kept (#1789).
  test("adds a row carrying on the instructions and who stays kept out of position", async () => {
    await seedRow(BEFORE, { firstLineup: true });
    await store();
    expect(await nextRow()).toEqual({ ...rowKeys(), ...AUTO, instructions: EXTRAS.instructions, keptOutOfPosition: EXTRAS.keptOutOfPosition });
  });

  test("replaces the gameweek's row, keeping its instructions and out-of-position list", async () => {
    await seedRow(NEXT, { firstLineup: true });
    await store();
    expect(await nextRow()).toEqual({ ...rowKeys(), ...AUTO, instructions: EXTRAS.instructions, keptOutOfPosition: EXTRAS.keptOutOfPosition });
  });
});
