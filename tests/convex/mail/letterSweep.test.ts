import { describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { wholeLeague } from "../../../convex/mail/letters";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { leagueSettingsOf } from "../../../convex/rules/leagueSettingsPart";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { scheduleOf } from "../../../convex/table/playedFixtures";
import { draftSteps, midfielder } from "../../support/convex/draft.harness";
import { ARSENAL, insertClubs, insertPlayers, PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { GAMEWEEK, HULL_SCORER } from "../../support/convex/gameweekScores.harness";
import { storedLeague } from "../../support/convex/gameweekScoresMatch.harness";
import { askToJoin, invite, makeLink } from "../../support/convex/joining.harness";
import { changesTo, NEWCOMER, type Caller, type RowsToChange } from "../../support/convex/leagueMutations.harness";
import { rulesRevision } from "../../support/convex/leagueRules.harness";
import { leagueWithPeople } from "../../support/convex/leagueDeletion.harness";
import { actingAs, addManagers, ADMIN, adminCreatesLeague, COMMISSIONER, teamsIn, type TestConvex, ANN, BOB, CAT, DAN } from "../../support/convex/leagues.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { NEXT, PALMER, SAKA } from "../../support/convex/waivers.harness";
import { tradeLeague } from "../../support/convex/trades.harness";

// The letter sweep (#2133): every change the commissioner or the admin makes in a league files a
// Mail letter to the whole league, "nothing changes quietly" (spec/15, The commissioner; spec/16
// S16.5), bar the exceptions the spec names. Each runs for real, once by the commissioner and once
// by the admin, in a league where it can go through. A change to the league the shared sweep list
// (leagueMutations.harness.ts) gives the commissioner or the admin and this file doesn't name fails
// the last test, so a new one can't change a league quietly.
//
// The admin's changes outside any league aren't swept here: a patch to the site's scoring files
// its own letter to every manager (siteScoring tests); a position correction files none, as its
// warning tells managers already (spec/15, The admin); the site's settings, club colours,
// feedback, the draft ranking and a player's availability change no league's score, squad or who
// runs a team.

/** A league to make a change in. */
type World = { t: TestConvex; leagueId: Id<"leagues"> };

/** One change: the league it runs in, anything that must happen first, and the change itself, by
 *  `by`. Its letter goes to the whole league unless `told` names who, as the spec says. */
type Sweep<W extends World> = {
  world: () => Promise<W>;
  first?: (w: W, by: Caller) => Promise<unknown>;
  change: (w: W, by: Caller) => Promise<unknown>;
  told?: readonly string[];
  /** Who alone makes it, where only one of the two can. */
  onlyBy?: string;
};
const sweep = <W extends World>(row: Sweep<W>) => row as unknown as Sweep<World>;

/** A league before its draft, with room for a team: leagueWithPeople's, an invite to CAT, DAN
 *  asking to join and the invite link he used. */
async function joiningLeague() {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await leagueWithPeople(t);
  const inviteId = await invite(t, leagueId, CAT);
  const requestId = await askToJoin(t, leagueId, await makeLink(t, leagueId), DAN);
  const [annsTeam] = await teamsIn(t, leagueId);
  return { t, leagueId, annsTeam: annsTeam._id, inviteId, requestId };
}

/** A league mid-season, its draft over and squads held: tradeLeague's. */
const seasonLeague = tradeLeague;
type Season = Awaited<ReturnType<typeof seasonLeague>>;

/** Two midfielders to draft. */
const DRAFTABLE = [701, 702].map((code) => midfielder(code));

/** A league of five teams before its draft, ANN and BOB managing, DRAFTABLE held and each squad two. */
async function draftLeague() {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t, 5);
  const teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, DRAFTABLE);
  });
  const steps = draftSteps(() => ({ t, leagueId }));
  await steps.setSquadSize(2);
  return { t, leagueId, teams, steps };
}

/** Gameweek 6 scored and stored, Hull v Everton, ANN fielding Hull. */
const scoredLeague = storedLeague;
type Scored = Awaited<ReturnType<typeof scoredLeague>>;

const overridesScorer = ({ leagueId }: Scored, by: Caller) =>
  by.mutation(api.table.pointsOverrides.override, { leagueId, fixtureCode: HULL_EVERTON, playerCode: HULL_SCORER, points: 12, reason: "A goal the feed gave someone else" });
const overridesAnnsTeam = ({ leagueId, annsTeam }: Scored, by: Caller) =>
  by.mutation(api.table.teamOverrides.overrideTeam, { leagueId, gameweek: GAMEWEEK, teamId: annsTeam, points: 40, reason: "Two subs the auto-subs missed" });

/** The first gameweek after the season league's next that its fixtures can still be edited in. */
const OPEN_GAMEWEEK = NEXT + 1;
/** The two games of the season league's open gameweek, read from its schedule. */
const openGames = ({ t, leagueId }: Season) =>
  t.run(async (ctx) => {
    const league = (await ctx.db.get("leagues", leagueId))!;
    return (await scheduleOf(ctx, league, (await seasonRules(ctx, leagueId))!)).find(({ gameweek }) => gameweek === OPEN_GAMEWEEK)!.fixtures;
  });

/** Every change swept, by its name in the shared sweep list. */
const SWEPT: Record<string, Sweep<World>> = {
  "leagues/leagues:setMaxTeams": sweep({ world: joiningLeague, change: ({ leagueId }, by) => by.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 6 }) }),
  "leagues/leagues:nameCommissioner": sweep({ world: joiningLeague, change: ({ leagueId }, by) => by.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: NEWCOMER }) }),
  "leagues/leagues:nameCoCommissioner": sweep({ world: joiningLeague, change: ({ leagueId }, by) => by.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: NEWCOMER }) }),
  "leagues/teams:addManager": sweep({ world: joiningLeague, onlyBy: ADMIN, change: ({ leagueId }, by) => by.mutation(api.leagues.teams.addManager, { leagueId, email: NEWCOMER }) }),
  "leagues/teams:removeManager": sweep({ world: joiningLeague, change: ({ leagueId, annsTeam }, by) => by.mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam }) }),
  // A league being deleted is hidden from its managers, so only its commissioner hears (spec/13, Deleting).
  "leagues/leagueDeletion:deleteLeague": sweep({ world: joiningLeague, told: [COMMISSIONER], change: ({ leagueId }, by) => by.mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId }) }),
  "joining/invites:send": sweep({ world: joiningLeague, change: ({ leagueId }, by) => by.mutation(api.joining.invites.send, { leagueId, email: NEWCOMER }) }),
  "joining/invites:resend": sweep({ world: joiningLeague, change: ({ inviteId }, by) => by.mutation(api.joining.invites.resend, { inviteId }) }),
  "joining/invites:cancel": sweep({ world: joiningLeague, change: ({ inviteId }, by) => by.mutation(api.joining.invites.cancel, { inviteId }) }),
  "joining/inviteLink:make": sweep({ world: joiningLeague, change: ({ leagueId }, by) => by.mutation(api.joining.inviteLink.make, { leagueId }) }),
  "joining/inviteLink:switchOff": sweep({ world: joiningLeague, change: ({ leagueId }, by) => by.mutation(api.joining.inviteLink.switchOff, { leagueId }) }),
  "joining/joinRequests:approve": sweep({ world: joiningLeague, change: ({ requestId }, by) => by.mutation(api.joining.joinRequests.approve, { requestId }) }),
  "gameweeks/leagueGameweeks:setUsed": sweep({
    world: seasonLeague,
    change: ({ leagueId }, by) => by.mutation(api.gameweeks.leagueGameweeks.setUsed, { leagueId, gameweek: PL_GAMEWEEKS, used: false }),
  }),
  "gameweeks/scoringStart:setScoringStart": sweep({
    world: seasonLeague,
    change: ({ leagueId }, by) => by.mutation(api.gameweeks.scoringStart.setScoringStart, { leagueId, gameweek: OPEN_GAMEWEEK }),
  }),
  "rules/leagueSettings:changeSettings": sweep({
    world: joiningLeague,
    change: async ({ t, leagueId }, by) =>
      by.mutation(api.rules.leagueSettings.changeSettings, { leagueId, settings: { ...leagueSettingsOf(FIRST_RULES), gamesPerGameweek: 2 }, revision: await rulesRevision(t, leagueId) }),
  }),
  "squads/squads:assign": sweep({
    world: seasonLeague,
    first: ({ t }) => t.run((ctx) => insertPlayers(ctx, [midfielder(DRAFTABLE[0].code)])),
    change: ({ leagueId, annsTeam }, by) => by.mutation(api.squads.squads.assign, { leagueId, playerCode: DRAFTABLE[0].code, teamId: annsTeam }),
  }),
  "squads/squads:move": sweep({ world: seasonLeague, change: ({ leagueId, annsTeam }, by) => by.mutation(api.squads.squads.move, { leagueId, playerCode: SAKA, teamId: annsTeam }) }),
  "squads/squads:release": sweep({ world: seasonLeague, change: ({ leagueId }, by) => by.mutation(api.squads.squads.release, { leagueId, playerCode: PALMER }) }),
  "lineup/autoTeam:set": sweep({ world: seasonLeague, change: ({ leagueId, catsTeam }, by) => by.mutation(api.lineup.autoTeam.set, { leagueId, teamId: catsTeam, on: true }) }),
  // Only the trade's reviewer may block it, not the admin: whether he should is Craig's call, #2148.
  "trades/tradeReview:block": sweep({
    world: seasonLeague,
    onlyBy: COMMISSIONER,
    first: ({ annTradesForSaka }) => annTradesForSaka(),
    change: async ({ leagueId, offers }, by) => by.mutation(api.trades.tradeReview.block, { leagueId, offerId: (await offers())[0]._id }),
  }),
  "table/fixtureEdits:swap": sweep({
    world: seasonLeague,
    change: async (w, by) => {
      const [one, other] = await openGames(w);
      return by.mutation(api.table.fixtureEdits.swap, {
        leagueId: w.leagueId,
        gameweek: OPEN_GAMEWEEK,
        one: { moves: one.team, against: one.opponent },
        other: { moves: other.opponent, against: other.team },
      });
    },
  }),
  "mail/mail:writeToLeague": sweep({ world: seasonLeague, change: ({ leagueId }, by) => by.mutation(api.mail.mail.writeToLeague, { leagueId, subject: "Kick-off", body: "Good luck all." }) }),
  // The draft's own letters are spec/04's (Mail): starting it tells the first pick's manager he's up.
  "draft/draftStart:start": sweep({ world: draftLeague, told: [ANN], change: ({ leagueId }, by) => by.mutation(api.draft.draftStart.start, { leagueId }) }),
  "draft/draftPause:pause": sweep({ world: draftLeague, first: ({ steps }) => steps.start(), change: ({ leagueId }, by) => by.mutation(api.draft.draftPause.pause, { leagueId }) }),
  "draft/draftPicks:pickFor": sweep({
    world: draftLeague,
    first: ({ steps }) => steps.start(),
    change: ({ leagueId, teams }, by) => by.mutation(api.draft.draftPicks.pickFor, { leagueId, teamId: teams[0], playerCode: DRAFTABLE[0].code }),
  }),
  "draft/draftCommissioner:undoPick": sweep({
    world: draftLeague,
    first: async ({ steps }) => {
      await steps.start();
      await steps.pick(ANN, DRAFTABLE[0].code);
    },
    change: ({ leagueId }, by) => by.mutation(api.draft.draftCommissioner.undoPick, { leagueId }),
  }),
  "draft/draftCommissioner:setPickTime": sweep({ world: joiningLeague, change: ({ leagueId }, by) => by.mutation(api.draft.draftCommissioner.setPickTime, { leagueId, pickSeconds: 60 }) }),
  "table/pointsOverrides:override": sweep({ world: scoredLeague, change: overridesScorer }),
  "table/pointsOverrides:removeOverride": sweep({
    world: scoredLeague,
    first: overridesScorer,
    change: ({ leagueId }, by) => by.mutation(api.table.pointsOverrides.removeOverride, { leagueId, fixtureCode: HULL_EVERTON, playerCode: HULL_SCORER }),
  }),
  "table/teamOverrides:overrideTeam": sweep({ world: scoredLeague, change: overridesAnnsTeam }),
  "table/teamOverrides:removeTeamOverride": sweep({
    world: scoredLeague,
    first: overridesAnnsTeam,
    change: ({ leagueId, annsTeam }, by) => by.mutation(api.table.teamOverrides.removeTeamOverride, { leagueId, gameweek: GAMEWEEK, teamId: annsTeam }),
  }),
};

/** The commissioner's and the admin's changes the spec says file no letter, each with where. */
const NO_LETTER: Record<string, string> = {
  "joining/joinRequests:refuseRequest": "Refusing a join request files none (spec/13, Joining; spec/15)",
  "draft/draftPause:resume": "Resume sends none (spec/04, Mail)",
  "leagues/lastLeague:switchTo": "Not a change to the league: which league the caller's own screens open (spec/13)",
};

/** Changes that file no letter today, where the spec's draft letters (spec/04) and "every
 *  commissioner action" (spec/15) disagree: Craig's call, #2149. */
const AWAITING_CRAIG: Record<string, string> = {
  "draft/draftOrder:setTeamOrder": "the commissioner puts the teams in draft order",
  "draft/draftOrder:drawTeamOrder": "the commissioner draws the draft order at random",
  "draft/draftStart:setStart": "the commissioner sets or clears the draft's start date",
  "draft/draftCommissioner:markForCommissioner": "the commissioner marks a team with no manager for him to pick for",
};

/** Each letter filed in the league, oldest first, as who it went to. */
const lettersIn = ({ t, leagueId }: World) => t.run(async (ctx) => (await ctx.db.query("letters").collect()).filter((letter) => letter.leagueId === leagueId).map(({ to }) => to));
/** Everyone with a part in the league as it is now. */
const everyoneIn = ({ t, leagueId }: World) => t.run(async (ctx) => wholeLeague(ctx, (await ctx.db.get("leagues", leagueId))!));

describe.each([
  { who: "the commissioner", email: COMMISSIONER },
  { who: "the admin", email: ADMIN },
])("$who's change", ({ email }) => {
  const rows = Object.entries(SWEPT).filter(([, { onlyBy }]) => onlyBy === undefined || onlyBy === email);
  test.each(rows)("%s files a letter", async (_name, { world, first, change, told }) => {
    const w = await world();
    const by = await actingAs(w.t, email);
    if (first) await first(w, by);
    const before = (await lettersIn(w)).length;
    await change(w, by);

    const to = new Set((await lettersIn(w)).slice(before));
    const missed = (told ?? (await everyoneIn(w))).filter((reader) => !to.has(reader));
    expect(to.size).toBeGreaterThan(0);
    expect(missed).toEqual([]);
  });
});

test("every change the sweep list gives the commissioner or the admin is swept, or the spec says it files no letter", () => {
  let caller = "";
  const tagged = (who: string): Caller => ({ mutation: (async () => (caller = who)) as unknown as Caller["mutation"] });
  // Only who each call goes through is read, so the rows it names needn't exist.
  const rows = { annsTeam: { _id: "ann" }, otherTeam: { _id: "other" } } as unknown as RowsToChange;
  const calls = changesTo({ admin: tagged("admin"), ann: tagged("ann"), commissioner: tagged("commissioner") }, rows);
  const theirs = Object.entries(calls)
    .filter(([, call]) => {
      void call();
      return caller !== "ann";
    })
    .map(([name]) => name);

  const named = new Set([...Object.keys(SWEPT), ...Object.keys(NO_LETTER), ...Object.keys(AWAITING_CRAIG)]);
  expect(theirs.filter((name) => !named.has(name))).toEqual([]);
});
