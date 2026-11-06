// Every public mutation given a league, found from the deployed modules, and a call of each that
// would change the league: shared by the sweeps that check each is refused, while the league is
// being deleted (leagueDeletion.test.ts, #75) and to a signed-out caller or an outsider
// (leagueAccess.test.ts, #141).

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { tablesKeyedToLeague } from "../../../convex/leagues/leagueDeletion";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf } from "../../../convex/rules/leagueSettingsPart";
import { DAY_MS } from "../../../convex/shared/time";
import { askToJoin, invite, makeLink } from "./joining.harness";
import { ANN, CAT, DAN } from "./leagueDeletion.harness";
import { rulesRevision } from "./leagueRules.harness";
import { teamsIn } from "./leagues.harness";
import { publicFunctions, type TestConvex } from "./test.harness";

/** Someone in no league, whom `changesTo` adds as a manager and invites. */
const NEWCOMER = "new@example.com";

/** Whoever calls a mutation: someone signed in, or the deployment itself when no one is. */
export type Caller = Pick<TestConvex, "mutation">;

/** Who makes each change in `changesTo`: the admin, ANN who manages a team, and the commissioner. */
export type Callers = { admin: Caller; ann: Caller; commissioner: Caller };

/** The rows of a league that `changesTo` names besides the league itself. */
export type RowsToChange = Awaited<ReturnType<typeof rowsToChange>>;

/** Gives a league from `leagueWithPeople` an invite to CAT and DAN's request to join, and reads
 *  what else `changesTo` names: ANN's team, the rules' revision and its teams. */
export async function rowsToChange(t: TestConvex, leagueId: Id<"leagues">) {
  const teams = await teamsIn(t, leagueId);
  const [annsTeam] = teams;
  if (annsTeam.managerEmail !== ANN) throw new Error(`the league's first team isn't ${ANN}'s: rowsToChange needs a league from leagueWithPeople`);
  const inviteId = await invite(t, leagueId, CAT);
  const requestId = await askToJoin(t, leagueId, await makeLink(t, leagueId), DAN);
  const revision = await rulesRevision(t, leagueId);
  /** Its teams in reverse: a draft order its commissioner could set. */
  const reversedTeamIds = teams.map((team) => team._id).reverse();
  /** A pending waiver claim of ANN's, written straight in. */
  const claimId = await t.run((ctx) => ctx.db.insert("waiverClaims", { leagueId, teamId: annsTeam._id, playerCode: 1, dropCode: null, rank: 0, by: ANN }));
  return { leagueId, annsTeam, inviteId, requestId, revision, reversedTeamIds, claimId };
}

/** A call of each public mutation given a league that would change it, by whoever might be let
 *  in to make it, keyed by its name in `mutationsGivenALeague`. */
export function changesTo(
  { admin, ann, commissioner }: Callers,
  { leagueId, annsTeam, inviteId, requestId, revision, reversedTeamIds, claimId }: RowsToChange,
): Record<string, () => Promise<unknown>> {
  return {
    "leagues/leagues:setMaxTeams": () => admin.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 6 }),
    "leagues/leagues:nameCommissioner": () => admin.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: ANN }),
    "leagues/leagues:nameCoCommissioner": () => admin.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: null }),
    "leagues/teams:addManager": () => admin.mutation(api.leagues.teams.addManager, { leagueId, email: NEWCOMER }),
    "leagues/teams:removeManager": () => admin.mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam._id }),
    "leagues/teams:rename": () => ann.mutation(api.leagues.teams.rename, { teamId: annsTeam._id, name: "Saka Potatoes" }),
    "leagues/teams:leave": () => ann.mutation(api.leagues.teams.leave, { leagueId }),
    "leagues/leagueDeletion:deleteLeague": () => admin.mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId }),
    "joining/invites:send": () => admin.mutation(api.joining.invites.send, { leagueId, email: NEWCOMER }),
    "joining/invites:resend": () => admin.mutation(api.joining.invites.resend, { inviteId }),
    "joining/invites:cancel": () => admin.mutation(api.joining.invites.cancel, { inviteId }),
    "joining/inviteLink:make": () => admin.mutation(api.joining.inviteLink.make, { leagueId }),
    "joining/inviteLink:switchOff": () => admin.mutation(api.joining.inviteLink.switchOff, { leagueId }),
    "joining/joinRequests:approve": () => admin.mutation(api.joining.joinRequests.approve, { requestId }),
    "joining/joinRequests:refuseRequest": () => admin.mutation(api.joining.joinRequests.refuseRequest, { requestId }),
    "gameweeks/leagueGameweeks:setUsed": () => admin.mutation(api.gameweeks.leagueGameweeks.setUsed, { leagueId, gameweek: 38, used: false }),
    "gameweeks/scoringStart:setScoringStart": () => admin.mutation(api.gameweeks.scoringStart.setScoringStart, { leagueId, gameweek: 38 }),
    "rules/leagueRules:change": () => admin.mutation(api.rules.leagueRules.change, { leagueId, rules: structuredClone(FIRST_RULES), revision }),
    "rules/leagueSettings:changeSettings": () =>
      admin.mutation(api.rules.leagueSettings.changeSettings, { leagueId, settings: { ...leagueSettingsOf(FIRST_RULES), oddTeamOut: "bye", gamesPerGameweek: 2 }, revision }),
    "draft/draftOrder:setTeamOrder": () => admin.mutation(api.draft.draftOrder.setTeamOrder, { leagueId, teamIds: reversedTeamIds }),
    "draft/draftOrder:drawTeamOrder": () => admin.mutation(api.draft.draftOrder.drawTeamOrder, { leagueId }),
    "draft/draftStart:setStart": () => admin.mutation(api.draft.draftStart.setStart, { leagueId, startsAt: Date.now() + DAY_MS }),
    "draft/draftStart:start": () => admin.mutation(api.draft.draftStart.start, { leagueId }),
    "draft/draftPause:pause": () => admin.mutation(api.draft.draftPause.pause, { leagueId }),
    "draft/draftPause:resume": () => admin.mutation(api.draft.draftPause.resume, { leagueId }),
    "draft/draftPicks:makePick": () => ann.mutation(api.draft.draftPicks.makePick, { leagueId, playerCode: 1 }),
    "draft/draftPicks:takeControlBack": () => ann.mutation(api.draft.draftPicks.takeControlBack, { leagueId }),
    "draft/draftPicks:pickFor": () => admin.mutation(api.draft.draftPicks.pickFor, { leagueId, playerCode: 1 }),
    "draft/draftCommissioner:undoPick": () => admin.mutation(api.draft.draftCommissioner.undoPick, { leagueId }),
    "draft/draftCommissioner:setPickTime": () => admin.mutation(api.draft.draftCommissioner.setPickTime, { leagueId, pickSeconds: 60 }),
    "draft/draftCommissioner:markForCommissioner": () =>
      admin.mutation(api.draft.draftCommissioner.markForCommissioner, { leagueId, teamId: annsTeam._id, marked: true }),
    "lineup/autoTeam:set": () => ann.mutation(api.lineup.autoTeam.set, { leagueId, teamId: annsTeam._id, on: true }),
    "lineup/lineups:save": () => ann.mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: [], bench: [] } }),
    "lineup/lineupDue:openedTactics": () => ann.mutation(api.lineup.lineupDue.openedTactics, { leagueId, gameweek: 1 }),
    "leagues/lastLeague:switchTo": () => commissioner.mutation(api.leagues.lastLeague.switchTo, { leagueId }),
    "mail/mail:writeToLeague": () => admin.mutation(api.mail.mail.writeToLeague, { leagueId, subject: "Still here?", body: "It's being deleted." }),
    "squads/squads:assign": () => admin.mutation(api.squads.squads.assign, { leagueId, playerCode: 1, teamId: annsTeam._id }),
    "squads/squads:move": () => admin.mutation(api.squads.squads.move, { leagueId, playerCode: 1, teamId: annsTeam._id }),
    "squads/squads:release": () => admin.mutation(api.squads.squads.release, { leagueId, playerCode: 1 }),
    "waivers/waivers:drop": () => ann.mutation(api.waivers.waivers.drop, { leagueId, playerCode: 1 }),
    "waivers/freeAgents:pickUp": () => ann.mutation(api.waivers.freeAgents.pickUp, { leagueId, playerCode: 1, dropCode: null }),
    "waivers/waiverClaims:putIn": () => ann.mutation(api.waivers.waiverClaims.putIn, { leagueId, playerCode: 1, dropCode: null }),
    "waivers/waiverClaims:withdraw": () => ann.mutation(api.waivers.waiverClaims.withdraw, { leagueId, claimId }),
    "waivers/waiverClaims:rank": () => ann.mutation(api.waivers.waiverClaims.rank, { leagueId, claimIds: [claimId] }),
    "squads/squadNumbers:set": () => ann.mutation(api.squads.squadNumbers.set, { leagueId, playerCode: 1, number: 7 }),
    "table/fixtureEdits:swap": () =>
      admin.mutation(api.table.fixtureEdits.swap, {
        leagueId,
        gameweek: 1,
        one: { moves: annsTeam._id, against: "leagueAverage" },
        other: { moves: "leagueAverage", against: annsTeam._id },
      }),
    "table/pointsOverrides:override": () =>
      admin.mutation(api.table.pointsOverrides.override, { leagueId, fixtureCode: 1, playerCode: 1, points: 10, reason: "A goal the feed gave someone else" }),
    "scouting/shortlist:add": () => ann.mutation(api.scouting.shortlist.add, { leagueId, playerCode: 1 }),
    "scouting/shortlist:remove": () => ann.mutation(api.scouting.shortlist.remove, { leagueId, playerCode: 1 }),
    "draft/draftLists:add": () => ann.mutation(api.draft.draftLists.add, { leagueId, playerCode: 1, list: "queue" }),
    "draft/draftLists:remove": () => ann.mutation(api.draft.draftLists.remove, { leagueId, playerCode: 1, list: "queue" }),
    "draft/draftLists:move": () => ann.mutation(api.draft.draftLists.move, { leagueId, playerCode: 1, place: 1 }),
    "draft/draftLists:addFromShortlist": () => ann.mutation(api.draft.draftLists.addFromShortlist, { leagueId, playerCode: 1 }),
    "draft/draftLists:addShortlist": () => ann.mutation(api.draft.draftLists.addShortlist, { leagueId }),
  };
}

/** Every public mutation given the id of a league, or of a row keyed to one, as "folder/module:name".
 *  Read from the deployed modules, so a mutation added later is found without anyone listing it. */
export async function mutationsGivenALeague(): Promise<string[]> {
  const keyedTables = new Set(["leagues", ...tablesKeyedToLeague]);
  const names: string[] = [];
  for (const [name, fn] of await publicFunctions()) {
    if (fn.isMutation && givesIdOf(JSON.parse(fn.exportArgs!()), keyedTables)) names.push(name);
  }
  return names.sort();
}

/** Whether an argument validator, as Convex exports it, takes an id of one of `tables` anywhere. */
function givesIdOf(validator: unknown, tables: Set<string>): boolean {
  if (typeof validator !== "object" || validator === null) return false;
  const { type, tableName } = validator as { type?: unknown; tableName?: unknown };
  if (type === "id" && typeof tableName === "string" && tables.has(tableName)) return true;
  return Object.values(validator).some((inner) => givesIdOf(inner, tables));
}
