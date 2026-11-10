import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { latestRules } from "../rules/rulesHistory";
import { refuse } from "../shared/leagueAccess";
import { squadOf } from "../squads/squadPlace";
import { limitsBroken } from "../squads/squads";
import { newlyBroken } from "../waivers/waiverRun";

// Each team's squad once a trade is made (spec/08 Trades; #383): the limits it would break, which
// warn, and the platform's most in a squad, which refuses. Split from tradeReview.ts.

export const squadFullRefusal = `A team holds at most ${MOST_IN_SQUAD} players.`;

/** Each team's squad as it would be once the trade is made, by code. */
export async function squadsAfter(ctx: QueryCtx, offer: Pick<Doc<"tradeOffers">, "fromTeamId" | "toTeamId" | "gives" | "gets">) {
  const after = async (teamId: Id<"teams">, out: readonly number[], into: readonly number[]) => [
    ...(await squadOf(ctx, teamId)).map((row) => row.playerCode).filter((code) => !out.includes(code)),
    ...into,
  ];
  return [
    { teamId: offer.fromTeamId, codes: await after(offer.fromTeamId, offer.gives, offer.gets) },
    { teamId: offer.toTeamId, codes: await after(offer.toTeamId, offer.gets, offer.gives) },
  ];
}

/** The league's squad limits each team's squad would be pushed past once the trade is made, broken
 *  newly or further, which warn but don't stop it (spec/08, as an assignment's, spec/15). Refused
 *  past the platform's most in a squad. */
export async function tradeWarnings(ctx: QueryCtx, leagueId: Id<"leagues">, offer: Parameters<typeof squadsAfter>[1]) {
  const squad = (await latestRules(ctx, leagueId)).squad;
  return Promise.all(
    (await squadsAfter(ctx, offer)).map(async ({ teamId, codes }) => {
      if (codes.length > MOST_IN_SQUAD) refuse(squadFullRefusal);
      const team = await ctx.db.get("teams", teamId);
      const now = (await squadOf(ctx, teamId)).map((row) => row.playerCode);
      const [before, after] = await Promise.all([limitsBroken(ctx, leagueId, now, squad), limitsBroken(ctx, leagueId, codes, squad)]);
      return { teamId, teamName: team?.name ?? "", warnings: newlyBroken(before, after) };
    }),
  );
}
