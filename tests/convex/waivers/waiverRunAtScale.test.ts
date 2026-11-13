import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { MINUTE_MS } from "../../../convex/shared/time";
import { draftStarted } from "../../support/convex/draft.harness";
import { insertClubs, insertPlayers, type Club, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, holdGameweeks, holdMatchState, NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";
import { addManagers, adminCreatesLeague, teamsIn } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { ROWS_TO_THE_CAP } from "../../support/convex/test.harness";
import { NEXT } from "../../support/convex/waivers.harness";

// A busy waiver run held to Convex's own limits (#1538): the first after a draft, every team with
// a full ranked list, the squad, club and area limits all on. Each team's squad and each player's
// club and positions are read once for the run, not once per claim tried, so the one job that
// tries every claim stays clear of the reads one transaction may make. Before #1538 a run this size
// threw, saved nothing and threw again at every check after.

const TEAMS = 14;
const CLAIMS = 30;
const SQUAD_SIZE = 15;
const POOL = 60;
const CLUBS: Club[] = Array.from({ length: 10 }, (_, index) => ({ code: 500 + index, name: `Club ${index}`, shortName: `C${index}` }));
const player = (code: number, index: number): HeldPlayer => ({
  code,
  name: `Player ${code}`,
  fullName: `Player ${code}`,
  clubCode: CLUBS[index % CLUBS.length].code,
  positions: [index === 0 ? "GK" : "CM"],
});
const squadCodes = (team: number) => Array.from({ length: SQUAD_SIZE }, (_, index) => 20_000 + team * 100 + index);
const poolCodes = Array.from({ length: POOL }, (_, index) => 30_000 + index);

test(`a run of ${TEAMS} teams with ${CLAIMS} claims each tries every claim and lands`, ROWS_TO_THE_CAP, async () => {
  const t = await signInDeployment(undefined, true);
  fakeResend();
  const leagueId = await adminCreatesLeague(t, TEAMS);
  const emails = Array.from({ length: TEAMS }, (_, index) => `manager${index}@example.com`);
  await addManagers(t, leagueId, emails);
  const teams = (await teamsIn(t, leagueId)).map(({ _id }) => _id);
  await holdGameweeks(t, { next: NEXT });
  await holdMatchState(t, NEXT - 1, "fullTime");
  await changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 11, maximum: 18 }, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 }, maxPerClub: 3 },
  }));
  await t.run(async (ctx) => {
    await insertClubs(ctx, CLUBS);
    await insertPlayers(ctx, poolCodes.map(player));
    for (const [team, teamId] of teams.entries()) {
      const codes = squadCodes(team);
      await insertPlayers(ctx, codes.map(player));
      for (const playerCode of codes) await ctx.db.insert("squadPlayers", { leagueId, teamId, playerCode });
      // Each team wants a run of the pool, overlapping its neighbours', every other claim with a drop.
      for (let rank = 0; rank < CLAIMS; rank++) {
        const playerCode = poolCodes[(team * 4 + rank) % POOL];
        const dropCode = rank % 2 === 0 ? null : codes[1 + (rank % (SQUAD_SIZE - 1))];
        await ctx.db.insert("waiverClaims", { leagueId, teamId, playerCode, dropCode, rank, by: emails[team] });
      }
    }
    for (const playerCode of poolCodes) await ctx.db.insert("waiverPlayers", { leagueId, playerCode, claimableFrom: Date.now() });
  });
  await draftStarted(t, leagueId, teams);

  vi.setSystemTime(Date.now() + MINUTE_MS);
  await t.mutation(internal.waivers.waiverRun.run, { leagueId, at: Date.now() });

  const { claims, onWaivers, squads, ran } = await t.run(async (ctx) => ({
    claims: await ctx.db.query("waiverClaims").collect(),
    onWaivers: await ctx.db.query("waiverPlayers").collect(),
    squads: await ctx.db.query("squadPlayers").collect(),
    ran: await ctx.db.query("waiverOrders").collect(),
  }));
  expect(claims).toEqual([]);
  expect(ran).toHaveLength(1);
  // Every pool player claimed is held by one team; the rest are free agents, and the dropped wait.
  const held = new Set(squads.map(({ playerCode }) => playerCode));
  const claimed = poolCodes.filter((code) => held.has(code));
  expect(claimed.length).toBeGreaterThan(TEAMS);
  expect(onWaivers.every(({ playerCode }) => !poolCodes.includes(playerCode))).toBe(true);
  for (const teamId of teams) expect(squads.filter((row) => row.teamId === teamId).length).toBeLessThanOrEqual(18);
});
