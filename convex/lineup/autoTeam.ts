import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { availabilityOf } from "../availability/availability";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { usedGameweeksOf } from "../gameweeks/usedGameweeks";
import { fileLetter, recordEvent, wholeLeague } from "../mail/letters";
import { gameModeOf, type GameMode } from "../rules/gameMode";
import { seasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { callerEmail, getLeague, managerOf, powersIn, refuse, teamIn, teamsOf } from "../shared/leagueAccess";
import { starsLookupIn } from "../stars/playerStars";
import { closeOffersOfTeam } from "../trades/tradeClose";
import type { RoleStars } from "../stars/starsShape";
import { autoSubs, standingProblems, type GameweekPlay } from "./autoSubs";
import { firstLineup, withDroppedRoles, type FirstLineup, type FirstLineupRules } from "./firstLineup";
import { namedCodes, type Placement, type PlayerPositions } from "./lineup";
import { heldPositionsOf, lineupsInGameweek, storeAutoTeamLineup, type HeldLineup } from "./lineups";
import { saveGameweekOf } from "../gameweeks/saveGameweek";
import { heldCell } from "./pitch";
import { autoTeamLetters, autoTeamRefusals } from "./autoTeamWords";
import { onAutoTeam } from "./autoTeamSwitch";

// The auto team (spec/09, The auto team; #1207), for a manager who stops playing: it sets the
// lineup only, never dropping or adding a player. At each league deadline (deadlineRecorder.ts
// schedules `atDeadline`) it keeps the team's last lineup and swaps any starter who is out
// (spec/06, Availability; a doubtful one stays) for the first bench player who fits, as an auto-sub
// comes on (autoSubs.ts). The swapped lineup is saved from that gameweek, so it rolls over.
//
// A team is on it while a person has switched it on (`set`), until switched off or, if its manager
// named one, until the gameweek it ends after has begun; while it has no manager, until it is
// handed on (leagues/teams.ts clears the switch); and, for one gameweek, when its lineup can't
// stand at the deadline. Fixing that lineup takes the auto-subs' way first, and if it still can't
// stand, the lineup is picked from the squad as a first lineup is (firstLineup.ts), anyone out kept
// on the bench. Switching on or off files a Mail letter to the whole league (spec/16).

/** The auto team's lineup for the gameweek: `held` with each starter who is out, and each slot
 *  `vacated` by one who left the squad, filled as auto-subs fill them; and when that still can't
 *  stand, the squad's first lineup with anyone out kept on the bench. Pure. */
function autoTeamLineup(
  held: Pick<HeldLineup, "starters" | "bench" | "vacated">,
  positions: PlayerPositions,
  isOut: (playerCode: number) => boolean,
  rules: FirstLineupRules,
  ratingsOf: (playerCode: number) => readonly RoleStars[],
): FirstLineup {
  const squad = namedCodes(held);
  const plays = new Map<number, GameweekPlay>(squad.map((playerCode) => [playerCode, isOut(playerCode) ? "didNotPlay" : "played"]));
  const subbed = autoSubs(held, positions, plays, rules, held.vacated, ratingsOf).lineup;
  if (standingProblems(subbed, positions, rules).length === 0) return { starters: subbed.starters.map(onThePitch), bench: [...subbed.bench] };
  const outs = new Set(squad.filter(isOut));
  return withDroppedRoles(firstLineup(squad, positions, rules, outs), ratingsOf, positions, held.starters);
}

/** A starter auto-subs placed: every cell they hand back is on the pitch (lineupProblems refused
 *  any other before a sub). */
const onThePitch = ({ playerCode, area, lane, role }: Placement) => ({
  playerCode,
  ...heldCell({ area, lane }),
  ...(role === undefined ? {} : { role }),
});

/** Whether two lineups field the same starters in the same cells and roles, and the same bench. */
const sameLineup = (one: FirstLineup, other: Pick<HeldLineup, "starters" | "bench">) =>
  JSON.stringify([one.starters.map(onThePitch), one.bench]) === JSON.stringify([other.starters.map(onThePitch), other.bench]);

/** What the log says when one team's step at the deadline throws. A throw while working it out
 *  leaves the team as it was; one from a write (a letter's insert, say) can leave its new lineup
 *  saved or its switch off, so the log names both to check. */
export const autoTeamFailedLog = (teamName: string, teamId: string, gameweek: number) =>
  `The auto team's step for ${teamName} (team ${teamId}) at gameweek ${gameweek}'s deadline failed, maybe part-way; check its lineup and switch`;

/** Each team on the auto team at the league's deadline for `gameweek` has its lineup set, and a
 *  manager's switch that ends after this gameweek, or one before, goes off. One team whose step
 *  throws is logged and the others carry on. */
export const atDeadline = internalMutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    const league = await ctx.db.get("leagues", leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (league === null) return null;
    const rules = season.inGameweek(gameweek);
    const teams = await teamsOf(ctx, leagueId);
    const lineups = await lineupsInGameweek(ctx, leagueId, teams.map((team) => team._id), gameweek);
    for (const team of teams) {
      try {
        await runTeam(ctx, league, team, lineups.get(team._id)!, rules, gameModeOf(rules), gameweek);
      } catch (error: unknown) {
        logFailure(autoTeamFailedLog(team.name, team._id, gameweek), error);
      }
    }
    return null;
  },
});

/** One team's step at the deadline. Every read, the letters' readers among them, is done before
 *  the first write, so a throw while working it out leaves the team as it was; only a write's own
 *  throw can stop it part-way. */
async function runTeam(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  team: Doc<"teams">,
  held: HeldLineup,
  rules: FirstLineupRules,
  mode: Pick<GameMode, "showsStars">,
  gameweek: number,
) {
  const switched = team.autoTeam;
  const endsAfter = switched?.endsAfter;
  const lapsed = endsAfter !== undefined && endsAfter < gameweek;
  const byPerson = switched !== undefined && !lapsed;
  const noManager = team.managerEmail === undefined;
  const squad = namedCodes(held);
  const positions = await heldPositionsOf(ctx, league._id, squad);
  const illegal = standingProblems(held, positions, rules).length > 0;

  let lineup: FirstLineup | null = null;
  if (byPerson || noManager || illegal) {
    const outs = new Set<number>();
    for (const playerCode of squad) if ((await availabilityOf(ctx, playerCode)).availability === "out") outs.add(playerCode);
    const starsOf = await starsLookupIn(ctx, squad, mode);
    const set = autoTeamLineup(held, positions, (playerCode) => outs.has(playerCode), rules, starsOf);
    if (!sameLineup(set, held)) lineup = set;
  }

  // Switched on by the app for this gameweek alone: it is off again once the lineup is set.
  const fixedLetter = lineup !== null && !byPerson && !noManager;
  const ends = endsAfter !== undefined && endsAfter <= gameweek;
  // A team with no manager stays on it until handed on, so its letter waits for that.
  const endedLetter = ends && !noManager;
  // The app's letters go to the whole league, with no one's name on them.
  const readers = fixedLetter || endedLetter ? await wholeLeague(ctx, league) : [];

  if (lineup !== null) await storeAutoTeamLineup(ctx, league._id, team._id, gameweek, lineup);
  if (fixedLetter) await fileLetter(ctx, league, readers, autoTeamLetters.fixed(team.name, gameweek));
  if (ends) await ctx.db.patch("teams", team._id, { autoTeam: undefined });
  if (endedLetter) await fileLetter(ctx, league, readers, autoTeamLetters.ended(team.name, endsAfter));
}

/** The team's manager, the league's commissioner, its co-commissioner or the admin switches its
 *  auto team on or off. Its manager switching it on can name the gameweek it ends after (spec/09:
 *  "like CM's holiday"), from the next not yet begun. A team with no manager is on it until handed
 *  on, so it can't be switched. */
export const set = mutation({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams"), on: v.boolean(), endsAfter: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, teamId, on, endsAfter }) => {
    const email = await callerEmail(ctx);
    const league = await getLeague(ctx, leagueId);
    const asked = await ctx.db.get("teams", teamId);
    const isManager = asked !== null && asked.leagueId === leagueId && asked.managerEmail === email;
    if (!isManager && !powersIn(league, email).runs) refuse(autoTeamRefusals.notYours);
    const team = await teamIn(ctx, leagueId, teamId);
    if (team.managerEmail === undefined) refuse(autoTeamRefusals.noManager);

    if (!on) {
      if (team.autoTeam === undefined) refuse(autoTeamRefusals.alreadyOff);
      await ctx.db.patch("teams", teamId, { autoTeam: undefined });
    } else {
      if (team.autoTeam !== undefined) refuse(autoTeamRefusals.alreadyOn);
      if (endsAfter !== undefined) await checkEndsAfter(ctx, league, endsAfter, isManager);
      await ctx.db.patch("teams", teamId, { autoTeam: { by: email, ...(endsAfter === undefined ? {} : { endsAfter }) } });
      // spec/08: its open trade offers close; a trade already in review finishes it.
      await closeOffersOfTeam(ctx, team);
    }
    await recordEvent(ctx, leagueId, email, { kind: "autoTeamSwitched", teamId, teamName: team.name, on, endsAfter: on ? (endsAfter ?? null) : null });
    return null;
  },
});

/** A team's auto team as its switch shows it: on or off, and the gameweek it ends after, if its
 *  manager named one. */
const autoTeamSwitch = v.object({ on: v.boolean(), endsAfter: v.union(v.number(), v.null()) });
export type AutoTeamSwitch = Infer<typeof autoTeamSwitch>;

/** A team's switch: on while a person switched it on or it has no manager (`onAutoTeam`). */
export const switchOf = (team: Doc<"teams">): AutoTeamSwitch => ({ on: onAutoTeam(team), endsAfter: team.autoTeam?.endsAfter ?? null });

/** The gameweeks an auto team may end after: each the league plays of its season's own count
 *  (#1618), from the next not yet begun to the league's last, so a league that ends early offers
 *  none after it (spec/13, Gameweeks). None once its season is over. */
async function endGameweeksOf(ctx: QueryCtx, league: Doc<"leagues">, now: number): Promise<number[]> {
  const next = await saveGameweekOf(ctx, league._id, now);
  if (next.kind !== "open") return [];
  return usedGameweeksOf(league, await seasonGameweekCount(ctx)).filter((gameweek) => gameweek >= next.gameweek);
}

/** The caller's team's auto team, for My team's header band (spec/09), with the gameweeks its
 *  manager may name for it to end after. Refused for anyone who runs no team in the league. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues") },
  returns: v.object({ teamId: v.id("teams"), ...autoTeamSwitch.fields, endGameweeks: v.array(v.number()) }),
  handler: async (ctx, { leagueId }) => {
    const { league, team } = await managerOf(ctx, leagueId);
    return { teamId: team._id, ...switchOf(team), endGameweeks: await endGameweeksOf(ctx, league, Date.now()) };
  },
});

/** Refuses a gameweek to end after that only the manager may name, or that isn't one the league
 *  plays from the next not yet begun to its last. */
async function checkEndsAfter(ctx: MutationCtx, league: Doc<"leagues">, endsAfter: number, isManager: boolean): Promise<void> {
  if (!isManager) refuse(autoTeamRefusals.endsAfterOnlyManager);
  const choices = await endGameweeksOf(ctx, league, Date.now());
  const first = choices[0];
  const last = choices.at(-1);
  if (first === undefined || last === undefined) refuse(autoTeamRefusals.noGameweekToEnd);
  if (!choices.includes(endsAfter)) refuse(autoTeamRefusals.endsAfterOutOfRange(first, last));
}
