import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { TEAM_COLOURS_MOST } from "../../../convex/leagues/leagueLimits";
import { startingColours, TEAM_COLOURS, type TeamColour } from "../../../convex/leagues/teamColours";
import { ADMIN, ANN, BOB, COMMISSIONER, actingAs, addManagers, freshLeague, teamsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";

// A team's colours (spec/12, Team colours; #2684): the palette, the random start, and setting them.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  ({ t, leagueId } = await freshLeague());
});

const coloursOf = async (teamId: Id<"teams">) => (await teamsIn(t, leagueId)).find((team) => team._id === teamId)?.colours;
const teamOn = (first: TeamColour) => ({ colours: [first, "white"] }) as Doc<"teams">;

describe("the palette and the random start", () => {
  test("S12.32: the palette is 16 different colours", () => {
    expect(new Set(TEAM_COLOURS).size).toBe(16);
  });

  test("S12.33: a new team starts on two different colours from the palette", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN]);
    const [first, second, ...rest] = (await coloursOf(annsTeam)) ?? [];
    expect(TEAM_COLOURS).toContain(first);
    expect(TEAM_COLOURS).toContain(second);
    expect(first).not.toBe(second);
    expect(rest).toEqual([]);
  });

  test("S12.33: a new team's first colour is one no other team starts on, while one is free", () => {
    const teams = TEAM_COLOURS.slice(1).map(teamOn);
    for (const random of [0, 0.5, 0.999]) expect(startingColours(teams, () => random)[0]).toBe(TEAM_COLOURS[0]);
  });

  test("S12.33: with every colour taken, a new team's first colour may repeat one", () => {
    const [first, second] = startingColours(TEAM_COLOURS.map(teamOn), () => 0.999);
    expect(first).toBe(TEAM_COLOURS[15]);
    expect(second).not.toBe(first);
  });
});

describe("setting a team's colours", () => {
  let annsTeam: Id<"teams">;
  beforeEach(async () => {
    [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  });

  test("S12.32: its manager sets one, two or three, and the same colour may fill two", async () => {
    const ann = await actingAs(t, ANN);
    for (const colours of [["red"], ["red", "white"], ["red", "red", "black"]] satisfies TeamColour[][]) {
      await ann.mutation(api.leagues.teams.setColours, { teamId: annsTeam, colours });
      expect(await coloursOf(annsTeam)).toEqual(colours);
    }
  });

  test(`S12.32: none, or more than ${TEAM_COLOURS_MOST}, is refused`, async () => {
    const ann = await actingAs(t, ANN);
    await expectRefused(ann.mutation(api.leagues.teams.setColours, { teamId: annsTeam, colours: [] }), refusals.colourCount);
    const four: TeamColour[] = ["red", "white", "black", "navy"];
    await expectRefused(ann.mutation(api.leagues.teams.setColours, { teamId: annsTeam, colours: four }), refusals.colourCount);
  });

  test("S12.32: a colour off the palette is refused", async () => {
    const before = await coloursOf(annsTeam);
    const offPalette = ["red", "lime"] as TeamColour[];
    await expect((await actingAs(t, ANN)).mutation(api.leagues.teams.setColours, { teamId: annsTeam, colours: offPalette })).rejects.toThrow(/lime/);
    expect(await coloursOf(annsTeam)).toEqual(before);
  });

  test("S12.32: another manager, or the commissioner, can't set them; the admin can", async () => {
    for (const email of [BOB, COMMISSIONER]) {
      await expectRefused((await actingAs(t, email)).mutation(api.leagues.teams.setColours, { teamId: annsTeam, colours: ["navy"] }), refusals.notManager);
    }
    await (await actingAs(t, ADMIN)).mutation(api.leagues.teams.setColours, { teamId: annsTeam, colours: ["navy"] });
    expect(await coloursOf(annsTeam)).toEqual(["navy"]);
  });
});
