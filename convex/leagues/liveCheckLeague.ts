import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { begin } from "../draft/draftStart";
import { pauseForDeletion } from "../draft/draftPause";
import { draftIsOver, draftOf } from "../draft/draftRow";
import { afterChoosing } from "../draft/draftTimeouts";
import { saveGameweekOf } from "../gameweeks/saveGameweek";
import { standingProblems } from "../lineup/autoSubs";
import { heldPositionsOf, lineupInGameweek } from "../lineup/lineups";
import { recordEvent } from "../mail/letters";
import { giveDefaultRules } from "../rules/leagueRules";
import { everyLeague } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { adminEmail } from "../signIn/allowedEmails";
import { testAccount } from "../signIn/testAccount";
import { TEST_ACCOUNT_EMAIL_SETTING } from "../outbound/deploymentSettings";
import { squadCodes } from "../squads/squadPlace";
import { checkSoon } from "./leagueChecks";
import { FEWEST_TEAMS } from "./leagueLimits";
import { putOnTeam } from "./teams";

// The first live-data check's test league (spec/20, The first live-data check, S20.12; #2114): two
// teams, Craig's (the admin's) and the after-release check's test account's, its draft run by
// auto-pick for both and each lineup set by the auto team. A script makes it before the round's
// deadline and deletes it once the check passes (scripts/live-check-league.mjs). It is made once:
// a second `make` finds it and says so.

/** The test league's name, by which a second run finds it. */
export const LIVE_CHECK_LEAGUE_NAME = "Live-data check";

/** The test league, or null while there is none. More than one is an error: one run made it. */
async function liveCheckLeague(ctx: QueryCtx): Promise<Doc<"leagues"> | null> {
  const found = (await everyLeague(ctx, `so the "${LIVE_CHECK_LEAGUE_NAME}" league could be missed`)).filter(
    (league) => league.name === LIVE_CHECK_LEAGUE_NAME,
  );
  if (found.length > 1) throw new Error(`${found.length} leagues are named "${LIVE_CHECK_LEAGUE_NAME}": delete them by hand, then run this again`);
  return found[0] ?? null;
}

/** Makes the test league, with Craig as its commissioner and manager of one team and the test
 *  account manager of the other, both on auto-pick and the auto team, and starts its draft, which
 *  then runs itself. A league already there is left as it is. */
export const make = internalMutation({
  args: {},
  returns: v.object({ made: v.boolean(), leagueId: v.id("leagues") }),
  handler: async (ctx) => {
    const existing = await liveCheckLeague(ctx);
    if (existing !== null) return { made: false, leagueId: existing._id };
    const account = testAccount();
    if (account === null) throw new Error(`The test account isn't set up on this deployment (${TEST_ACCOUNT_EMAIL_SETTING} and its secret): the test league needs it`);
    const craig = adminEmail();

    const leagueId = await ctx.db.insert("leagues", { name: LIVE_CHECK_LEAGUE_NAME, maxTeams: FEWEST_TEAMS, commissionerEmail: craig });
    await recordEvent(ctx, leagueId, craig, { kind: "created", name: LIVE_CHECK_LEAGUE_NAME, maxTeams: FEWEST_TEAMS });
    await giveDefaultRules(ctx, leagueId, FEWEST_TEAMS);
    await checkSoon(ctx, leagueId);
    const league = (await ctx.db.get("leagues", leagueId))!;
    const teamIds = [];
    for (const email of [craig, account.email]) {
      const { teamId, teamName } = await putOnTeam(ctx, league, email, undefined);
      await recordEvent(ctx, leagueId, craig, { kind: "managerAdded", email, teamId, teamName });
      // The auto team sets its lineup at each deadline, until switched off (lineup/autoTeam.ts).
      await ctx.db.patch("teams", teamId, { autoTeam: { by: craig } });
      teamIds.push(teamId);
    }

    // Both on auto-pick, as a manager chooses it, so every pick is made as its clock starts.
    const timeouts = teamIds.reduce<Doc<"drafts">["timeouts"]>((held, teamId) => afterChoosing(held, teamId), undefined);
    const draftId = await ctx.db.insert("drafts", { leagueId, timeouts });
    const refusal = await begin(ctx, league, (await ctx.db.get("drafts", draftId))!);
    if (refusal !== null) throw new Error(`The test league's draft didn't start: ${refusal}`);
    return { made: true, leagueId };
  },
});

const teamState = v.object({
  name: v.string(),
  managerEmail: v.union(v.string(), v.null()),
  players: v.number(),
  onAutoTeam: v.boolean(),
  /** Whether the lineup for the next gameweek not yet begun can stand (lineup/autoSubs.ts). */
  lineupStands: v.boolean(),
});

/** The test league as the script reports it: whether its draft is over, the squad size it drafts
 *  to, and each team. Null while there is none. */
export const state = internalQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ leagueId: v.id("leagues"), draftOver: v.boolean(), squadSize: v.union(v.number(), v.null()), gameweek: v.union(v.number(), v.null()), teams: v.array(teamState) }),
  ),
  handler: async (ctx) => {
    const league = await liveCheckLeague(ctx);
    if (league === null) return null;
    const draft = await draftOf(ctx, league._id);
    const next = await saveGameweekOf(ctx, league._id, Date.now());
    const gameweek = next.kind === "open" ? next.gameweek : null;
    const teams = [];
    for (const team of await teamsOf(ctx, league._id)) {
      const squad = await squadCodes(ctx, team._id);
      let lineupStands = false;
      if (next.kind === "open") {
        const held = await lineupInGameweek(ctx, league._id, team._id, next.gameweek);
        const positions = await heldPositionsOf(ctx, league._id, squad);
        lineupStands = held.starters.length > 0 &&standingProblems(held, positions, next.season.inGameweek(next.gameweek)).length === 0;
      }
      teams.push({ name: team.name, managerEmail: team.managerEmail ?? null, players: squad.length, onAutoTeam: team.autoTeam !== undefined, lineupStands });
    }
    return { leagueId: league._id, draftOver: await draftIsOver(ctx, league._id), squadSize: draft?.started?.rounds ?? null, gameweek, teams };
  },
});

/** Deletes the test league at once, with every row keyed to it (leagueDeletion.ts `deleteForGood`),
 *  and emails no one: it was only ever a test. Whether there was one to delete. */
export const remove = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const league = await liveCheckLeague(ctx);
    if (league === null) return false;
    if (league.deletion !== undefined) return true;
    const scheduledId = await ctx.scheduler.runAfter(0, internal.leagues.leagueDeletion.deleteForGood, { leagueId: league._id, tell: [] });
    await ctx.db.patch("leagues", league._id, { deletion: { by: adminEmail(), deletesAt: Date.now(), scheduledId } });
    await pauseForDeletion(ctx, league._id);
    return true;
  },
});
