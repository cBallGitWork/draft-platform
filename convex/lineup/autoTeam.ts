import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { availabilityOf } from "../availability/availability";
import { GAMEWEEKS } from "../gameweeks/usedGameweeks";
import { fileLetter, recordEvent, wholeLeague } from "../mail/letters";
import { seasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { callerEmail, getLeague, powersIn, refuse, teamIn, teamsOf } from "../shared/leagueAccess";
import { starsOfPlayers } from "../stars/playerStars";
import { closeOffersOfTeam } from "../trades/tradeClose";
import type { RoleStars } from "../stars/starsShape";
import { autoSubs, standingProblems, type GameweekPlay } from "./autoSubs";
import { firstLineup, withDroppedRoles, type FirstLineup, type FirstLineupRules } from "./firstLineup";
import { namedCodes, type Placement, type PlayerPositions } from "./lineup";
import { heldPositionsOf, lineupsInGameweek, saveGameweekOf, storeAutoTeamLineup, type HeldLineup } from "./lineups";
import type { Area, Lane } from "./pitch";
import { autoTeamLetters, autoTeamRefusals } from "./autoTeamWords";

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
export function autoTeamLineup(
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
  return withDroppedRoles(firstLineup(squad, positions, rules, outs), ratingsOf, held.starters);
}

/** A starter auto-subs placed: every cell they hand back is on the pitch (lineupProblems refused
 *  any other before a sub). */
const onThePitch = ({ playerCode, area, lane, role }: Placement) => ({
  playerCode,
  area: area as Area,
  lane: lane as Lane,
  ...(role === undefined ? {} : { role }),
});

/** Whether two lineups field the same starters in the same cells and roles, and the same bench. */
const sameLineup = (one: FirstLineup, other: Pick<HeldLineup, "starters" | "bench">) =>
  JSON.stringify([one.starters.map(onThePitch), one.bench]) === JSON.stringify([other.starters.map(onThePitch), other.bench]);

/** Each team on the auto team at the league's deadline for `gameweek` has its lineup set, and a
 *  manager's switch that ends after this gameweek, or one before, goes off. One team whose lineup
 *  can't be worked out is logged and left as it was; the others carry on. */
export const atDeadline = internalMutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    const league = await ctx.db.get("leagues", leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (league === null || season === null) return null;
    const rules = season.inGameweek(gameweek);
    const teams = await teamsOf(ctx, leagueId);
    const lineups = await lineupsInGameweek(ctx, leagueId, teams.map((team) => team._id), gameweek);
    for (const team of teams) {
      try {
        await runTeam(ctx, league, team, lineups.get(team._id)!, rules, gameweek);
      } catch (error: unknown) {
        logFailure(`The auto team couldn't set ${team.name}'s lineup (team ${team._id}) for gameweek ${gameweek}, so it stands as saved`, error);
      }
    }
    return null;
  },
});

/** One team's step at the deadline. Everything is worked out before the first write, so a throw
 *  leaves the team as it was. */
async function runTeam(ctx: MutationCtx, league: Doc<"leagues">, team: Doc<"teams">, held: HeldLineup, rules: FirstLineupRules, gameweek: number) {
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
    const stars = await starsOfPlayers(ctx, squad);
    const set = autoTeamLineup(held, positions, (playerCode) => outs.has(playerCode), rules, (playerCode) => stars.get(playerCode) ?? []);
    if (!sameLineup(set, held)) lineup = set;
  }

  if (lineup !== null) {
    await storeAutoTeamLineup(ctx, league._id, team._id, gameweek, lineup);
    // Switched on by the app for this gameweek alone: it is off again once the lineup is set.
    if (!byPerson && !noManager) await fileAutoTeamLetter(ctx, league, autoTeamLetters.fixed(team.name, gameweek));
  }
  if (endsAfter !== undefined && endsAfter <= gameweek) {
    await ctx.db.patch("teams", team._id, { autoTeam: undefined });
    // A team with no manager stays on it until handed on, so its letter waits for that.
    if (!noManager) await fileAutoTeamLetter(ctx, league, autoTeamLetters.ended(team.name, endsAfter));
  }
}

/** A letter the app files to the whole league, with no one's name on it. */
async function fileAutoTeamLetter(ctx: MutationCtx, league: Doc<"leagues">, letter: { subject: string; body: string }) {
  await fileLetter(ctx, league, await wholeLeague(ctx, league), letter);
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
      if (endsAfter !== undefined) await checkEndsAfter(ctx, leagueId, endsAfter, isManager);
      await ctx.db.patch("teams", teamId, { autoTeam: { by: email, ...(endsAfter === undefined ? {} : { endsAfter }) } });
      // spec/08: its open trade offers close; a trade already in review finishes it.
      await closeOffersOfTeam(ctx, team);
    }
    await recordEvent(ctx, leagueId, email, { kind: "autoTeamSwitched", teamId, teamName: team.name, on, endsAfter: on ? (endsAfter ?? null) : null });
    return null;
  },
});

/** Refuses a gameweek to end after that only the manager may name, or that isn't from the next not
 *  yet begun to the season's last. */
async function checkEndsAfter(ctx: MutationCtx, leagueId: Id<"leagues">, endsAfter: number, isManager: boolean): Promise<void> {
  if (!isManager) refuse(autoTeamRefusals.endsAfterOnlyManager);
  const next = await saveGameweekOf(ctx, leagueId, Date.now());
  if (next.kind !== "open") refuse(autoTeamRefusals.noGameweekToEnd);
  if (!Number.isInteger(endsAfter) || endsAfter < next.gameweek || endsAfter > GAMEWEEKS) {
    refuse(autoTeamRefusals.endsAfterOutOfRange(next.gameweek, GAMEWEEKS));
  }
}
