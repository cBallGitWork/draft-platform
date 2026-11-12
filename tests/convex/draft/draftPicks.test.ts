import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { squadRefusals } from "../../../convex/squads/squads";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ARSENAL, CHELSEA, GONE, insertClubs, insertDroppedPlayer, insertPlayers, UNHELD, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, holdGameweeks, NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { draftSteps } from "../../support/convex/draft.harness";
import { addManagers, ADMIN, adminCreatesLeague, COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// Making a pick (spec/04, The picks; #1090): the manager on the clock picks a legal player, who
// joins his squad; a pick out of turn or breaking the squad's rules is refused; the turn runs the
// snake, and the draft is over once the last pick is made. A drafted player who leaves the Premier
// League keeps his place, shown gone.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

/** A player named for his code, at `club` in `position`: a central midfielder at Arsenal unless said. */
const player = (code: number, club = ARSENAL, position: HeldPlayer["positions"][number] = "CM"): HeldPlayer => ({
  code,
  name: `Player ${code}`,
  fullName: `Player ${code}`,
  clubCode: club.code,
  positions: [position],
});
const ARSENAL_MIDS = [101, 102, 103, 104, 105, 106].map((code) => player(code));
const CHELSEA_MID = player(201, CHELSEA);
const KEEPERS = [301, 302, 303].map((code) => player(code, CHELSEA, "GK"));
const [K1, K2, K3] = KEEPERS.map(({ code }) => code);
const [A1, A2, A3, A4, A5, A6] = ARSENAL_MIDS.map(({ code }) => code);

/** The league's squad rules become these, squads of 2 players unless said: the rules in force. */
const setSquadRules = (squad: Partial<LeagueRules["squad"]>) =>
  changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null, ...squad } }));

const { as, read, start, pickAndWait: pick } = draftSteps(() => ({ t, leagueId }));
const squadsNow = async () =>
  (await (await as(COMMISSIONER)).query(api.squads.squads.squads, { leagueId })).map(({ teamId, players }) => ({ teamId, players: players.map(({ code, gone }) => ({ code, gone })) }));
const [ANN, BOB, CAT] = MANAGERS;

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [...ARSENAL_MIDS, CHELSEA_MID, ...KEEPERS]);
    await insertDroppedPlayer(ctx, GONE, 0);
  });
  await setSquadRules({});
});

describe("a full draft", () => {
  test("runs the snake, each pick joining the picker's squad, and is over after the last", async () => {
    await start();
    const picks: [string, number, Id<"teams">][] = [
      [ANN, A1, teams[0]],
      [BOB, A2, teams[1]],
      [CAT, A3, teams[2]],
      [CAT, A4, teams[2]],
      [BOB, A5, teams[1]],
      [ANN, A6, teams[0]],
    ];
    for (const [index, [email, code, teamId]] of picks.entries()) {
      expect(await read()).toMatchObject({ status: "live", picksMade: index, onTheClock: { pick: index + 1, round: index < 3 ? 1 : 2, teamId } });
      await pick(email, code);
    }

    expect(await read()).toMatchObject({ status: "over", picksMade: 6, rounds: 2 });
    expect(await squadsNow()).toEqual([
      { teamId: teams[0], players: [{ code: A1, gone: false }, { code: A6, gone: false }] },
      { teamId: teams[1], players: [{ code: A2, gone: false }, { code: A5, gone: false }] },
      { teamId: teams[2], players: [{ code: A3, gone: false }, { code: A4, gone: false }] },
    ]);
    await expectRefused(pick(ANN, CHELSEA_MID.code), pickRefusals.over);
  });

  test("saves each team's lineup as its picks left it once the last pick is made, so a later squad change only joins the bench (#1040)", async () => {
    const lineupRows = () => t.run((ctx) => ctx.db.query("lineups").collect());
    // A season to come, so there is a gameweek for the lineups to be saved from (#1618).
    await holdGameweeks(t, { next: 1 });
    await start();
    const picks = [[ANN, A1], [BOB, A2], [CAT, A3], [CAT, A4], [BOB, A5]] as const;
    for (const [email, code] of picks) await pick(email, code);
    // Until the end, each team's lineup is still its first, picked again with each pick.
    expect((await lineupRows()).map(({ teamId, firstLineup }) => ({ teamId, firstLineup }))).toEqual(teams.map((teamId) => ({ teamId, firstLineup: true })));
    await pick(ANN, A6);

    const saved = await lineupRows();
    expect(saved.map(({ teamId, firstLineup }) => ({ teamId, firstLineup }))).toEqual(teams.map((teamId) => ({ teamId, firstLineup: undefined })));
    const anns = saved.find((row) => row.teamId === teams[0])!;
    expect([...anns.starters.map(({ playerCode }) => playerCode), ...anns.bench].sort()).toEqual([A1, A6]);
    // A player assigned since joins the end of the bench: the saved lineup isn't picked again.
    await (await as(COMMISSIONER)).mutation(api.squads.squads.assign, { leagueId, playerCode: CHELSEA_MID.code, teamId: teams[0] });
    expect((await lineupRows()).find((row) => row.teamId === teams[0])).toEqual(anns);
  });

  test("files each pick as the player joining the team, by its manager", async () => {
    await start();
    await pick(ANN, A1);

    expect((await eventsIn(t, leagueId)).filter(({ kind }) => kind === "playerAssigned")).toEqual([
      { by: ANN, kind: "playerAssigned", playerCode: A1, playerName: "Player 101", teamId: teams[0], teamName: teamNumbered(1) },
    ]);
  });
});

describe("a pick is refused", () => {
  test("before the draft starts", async () => {
    await expectRefused(pick(ANN, A1), pickRefusals.notStarted);
  });

  test("out of turn, naming the team on the clock, and nothing is written", async () => {
    await start();
    await expectRefused(pick(BOB, A1), pickRefusals.notYourTurn(teamNumbered(1)));
    expect(await read()).toMatchObject({ picksMade: 0 });
    expect((await squadsNow()).flatMap(({ players }) => players)).toEqual([]);
  });

  test("to anyone who runs no team in the league", async () => {
    await start();
    await expectRefused(pick(COMMISSIONER, A1), refusals.runsNoTeam);
  });

  test("for a player already drafted", async () => {
    await start();
    await pick(ANN, A1);
    await expectRefused(pick(BOB, A1), pickRefusals.taken("Player 101", teamNumbered(1)));
  });

  test("for a player who has left the Premier League, or none at all", async () => {
    await start();
    await expectRefused(pick(ANN, GONE.code), squadRefusals.playerGone(GONE.name));
    await expectRefused(pick(ANN, UNHELD), refusals.noPlayer);
  });

  test("past the league's most players from one club", async () => {
    await setSquadRules({ maxPerClub: 1 });
    await start();
    for (const [email, code] of [[ANN, A1], [BOB, A2], [CAT, A3], [CAT, CHELSEA_MID.code]] as const) await pick(email, code);
    await pick(BOB, K1);

    await expectRefused(pick(ANN, A4), pickRefusals.breaksSquadRules("Player 104"));
  });

  test("when it would leave too few picks to reach an area's minimum, while the area itself is open", async () => {
    await setSquadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    await start();
    for (const [email, code] of [[ANN, A1], [BOB, A2], [CAT, K1], [CAT, A3], [BOB, K2]] as const) await pick(email, code);

    await expectRefused(pick(ANN, A6), pickRefusals.breaksSquadRules("Player 106"));
    await pick(ANN, K3);
    expect(await read()).toMatchObject({ status: "over" });
  });

  test("by the picks the team holds, not the round: a team with two picks in round 1 makes its last there, and the other its first in round 2", async () => {
    await setSquadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    // Ann's round-2 pick is Cat's, and Cat's round-1 pick is Ann's: Ann picks 1st and 3rd, Cat 4th and 6th.
    await start();
    await t.run(async (ctx) => {
      const draft = (await ctx.db.query("drafts").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).unique())!;
      await ctx.db.patch("drafts", draft._id, {
        tradedPicks: [
          { round: 2, teamId: teams[0], ownerId: teams[2] },
          { round: 1, teamId: teams[2], ownerId: teams[0] },
        ],
      });
    });
    await pick(ANN, A1);
    await pick(BOB, A2);

    await expectRefused(pick(ANN, A3), pickRefusals.breaksSquadRules("Player 103"));
    await pick(ANN, K1);
    await pick(CAT, A3);
    await pick(BOB, K2);
    await pick(CAT, K3);
    expect(await read()).toMatchObject({ status: "over" });
  });

  test("when it would leave no legal finish from the players still undrafted", async () => {
    // Every keeper left plays for Chelsea: Ann at Chelsea's maximum could never pick one.
    await setSquadRules({ maxPerClub: 1, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    await start();

    await expectRefused(pick(ANN, CHELSEA_MID.code), pickRefusals.breaksSquadRules("Player 201"));
    await pick(ANN, A1);
  });
});

test("picks follow the squad rules the draft started under, not a change made since", async () => {
  await start();
  await setSquadRules({ maxPerClub: 1 });
  for (const [email, code] of [[ANN, A1], [BOB, A2], [CAT, A3], [CAT, A4]] as const) await pick(email, code);

  expect((await squadsNow())[2]).toEqual({ teamId: teams[2], players: [{ code: A3, gone: false }, { code: A4, gone: false }] });
});

describe("a drafted player who loses a position mid-draft (#1484)", () => {
  /** A defender who also plays central midfield, at Arsenal, and two who only defend, at Chelsea. */
  const DEFENDER: HeldPlayer = { ...player(401), positions: ["CB", "CM"] };
  const [D2, D3] = [402, 403].map((code) => player(code, CHELSEA, "CB"));
  const removeCentreBack = async () =>
    (await as(ADMIN)).mutation(api.positions.playerPositions.removePosition, { code: DEFENDER.code, position: "CB" });

  beforeEach(async () => {
    await t.run((ctx) => insertPlayers(ctx, [DEFENDER, D2, D3]));
    await setSquadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1, defence: 1 } });
    await start();
  });

  test("still counts at the positions he had when drafted, so his team's last pick is never left with none legal", async () => {
    await pick(ANN, DEFENDER.code);
    await removeCentreBack();
    for (const [email, code] of [[BOB, K1], [CAT, K2], [CAT, D2.code], [BOB, D3.code]] as const) await pick(email, code);

    await expectRefused(pick(ANN, A3), pickRefusals.breaksSquadRules("Player 103"));
    await pick(ANN, K3);
    expect(await read()).toMatchObject({ status: "over" });
  });

  test("keeps them on his pick", async () => {
    await pick(ANN, DEFENDER.code);
    await removeCentreBack();

    const held = await t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ playerCode, positions }) => ({ playerCode, positions })));
    expect(held).toEqual([{ playerCode: DEFENDER.code, positions: ["CB", "CM"] }]);
  });
});

describe("the commissioner's assign, move and release", () => {
  const commissioner = () => as(COMMISSIONER);
  const assign = async (playerCode: number, teamId: Id<"teams">) => (await commissioner()).mutation(api.squads.squads.assign, { leagueId, playerCode, teamId });
  const move = async (playerCode: number, teamId: Id<"teams">) => (await commissioner()).mutation(api.squads.squads.move, { leagueId, playerCode, teamId });
  const release = async (playerCode: number) => (await commissioner()).mutation(api.squads.squads.release, { leagueId, playerCode });

  test("are refused while the draft is live, and nothing is written", async () => {
    await start();
    await pick(ANN, A1);

    await expectRefused(assign(A2, teams[1]), squadRefusals.draftLive);
    await expectRefused(move(A1, teams[1]), squadRefusals.draftLive);
    await expectRefused(release(A1), squadRefusals.draftLive);
    expect((await squadsNow()).flatMap(({ players }) => players)).toEqual([{ code: A1, gone: false }]);
  });

  test("work again once the draft is over", async () => {
    await start();
    for (const [email, code] of [[ANN, A1], [BOB, A2], [CAT, A3], [CAT, A4], [BOB, A5], [ANN, A6]] as const) await pick(email, code);

    await release(A1);
    await move(A2, teams[0]);
    await assign(A1, teams[1]);
    expect((await squadsNow()).map(({ players }) => players.map(({ code }) => code).sort())).toEqual([[A2, A6], [A1, A5], [A3, A4]]);
  });
});

test("a drafted player who leaves the Premier League keeps his place, shown gone", async () => {
  await start();
  await pick(ANN, A1);
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", A1)).unique())!;
    await ctx.db.patch("players", row._id, { droppedAt: Date.now() });
  });

  expect((await squadsNow())[0]).toEqual({ teamId: teams[0], players: [{ code: A1, gone: true }] });
});
