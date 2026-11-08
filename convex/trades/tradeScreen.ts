import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import { positionRank } from "../positions/positionTables";
import { tradeRulesOf } from "../rules/firstRules";
import { TRADE_REVIEWS } from "../rules/leagueRulesShape";
import { latestRules } from "../rules/rulesHistory";
import { clubRecord, position } from "../schema";
import { managerOf, teamsOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode, type Clubs } from "../shared/players";
import { squadOf } from "../squads/squadPlace";
import { limitsBroken, squadWarning } from "../squads/squads";
import { newlyBroken } from "../waivers/waiverRun";
import { leagueOffers, pickName } from "./tradeClose";
import { reviewerOf } from "./tradeReview";
import { onAutoTeam, tradesShut } from "./tradeShut";

// The Trades screen's read (#383; spec/12 Trades, its approved picture docs/design/approved/trades):
// the offers to and from the manager's team, open or in review, each with when it closes, who it
// waits on and the squad limits it would break for him; and every team's squad to make an offer
// from, a player held in a trade under review marked.

const tradedPlayer = v.object({
  code: v.number(),
  name: v.string(),
  /** His main position now; null while no feed has named one. */
  position: v.union(position, v.null()),
  club: clubRecord,
});
export type TradedPlayer = Infer<typeof tradedPlayer>;

/** Who reviews a trade: the commissioner or the co-commissioner by veto, or a league vote. */
const reviewer = v.union(
  v.literal("commissioner"),
  v.literal("coCommissioner"),
  v.literal("vote"),
);
export type Reviewer = Infer<typeof reviewer>;

const screenOffer = v.object({
  offerId: v.id("tradeOffers"),
  fromTeamId: v.id("teams"),
  fromTeamName: v.string(),
  toTeamId: v.id("teams"),
  toTeamName: v.string(),
  /** The players going from `fromTeamId`, and those coming back. */
  gives: v.array(tradedPlayer),
  gets: v.array(tradedPlayer),
  /** A pick trade's picks, each as its letters name it; null for a players' trade. */
  picks: v.union(v.object({ gives: v.string(), gets: v.string() }), v.null()),
  note: v.union(v.string(), v.null()),
  madeAt: v.number(),
  /** While open, the deadline it closes at unanswered; null while none is known. */
  closes: v.union(v.object({ gameweek: v.number(), at: v.number() }), v.null()),
  /** Who would review it once accepted, or reviews it now; null for nobody. */
  reviewer: v.union(reviewer, v.null()),
  /** Null while it is open; once accepted, when its review ends. */
  reviewEndsAt: v.union(v.number(), v.null()),
  /** The league's squad limits the manager's own squad would be pushed past by it, newly or
   *  further, which warn only (spec/08, as an assignment's, spec/15). */
  warnings: v.array(squadWarning),
});
export type ScreenOffer = Infer<typeof screenOffer>;

const screenTeam = v.object({
  teamId: v.id("teams"),
  teamName: v.string(),
  /** On the auto team: no offer goes to or from it (spec/09). */
  onAutoTeam: v.boolean(),
  /** Its squad by position, then name; `held` marks a player in a trade under review. */
  players: v.array(v.object({ ...tradedPlayer.fields, held: v.boolean() })),
});
export type ScreenTeam = Infer<typeof screenTeam>;

export const tradesView = v.object({
  myTeamId: v.id("teams"),
  /** How the league reviews an accepted trade (League settings). */
  review: v.union(...TRADE_REVIEWS.map((name) => v.literal(name))),
  /** Why no trade can be offered or accepted now, or null while trades are open (tradeShut.ts). */
  shut: v.union(
    v.literal("draftLive"),
    v.literal("tradeDeadline"),
    v.literal("unusedGameweek"),
    v.null(),
  ),
  /** The most players the league's rules let a squad hold; null with no limit, or no rules. */
  squadMaximum: v.union(v.number(), v.null()),
  /** Every team in the league, the manager's own first. */
  teams: v.array(screenTeam),
  /** Open or in review, oldest first. */
  offers: v.array(screenOffer),
});
export type TradesView = Infer<typeof tradesView>;

/** The first deadline after `from`, with its gameweek: when an offer made then closes unanswered. */
export function nextDeadline(
  deadlines: LeagueDeadlines,
  from: number,
): { gameweek: number; at: number } | null {
  let next: { gameweek: number; at: number } | null = null;
  for (const [gameweek, at] of deadlines) {
    if (at !== null && at > from && (next === null || at < next.at))
      next = { gameweek, at };
  }
  return next;
}

/** A player as the screen shows him: name, main position and club; null for one the football sync
 *  doesn't hold. */
async function shownPlayer(
  ctx: QueryCtx,
  code: number,
  positionsOf: PositionsNow,
  clubOf: Clubs,
): Promise<TradedPlayer | null> {
  const player = await playerByCode(ctx, code);
  if (player === null) return null;
  return {
    code,
    name: player.name,
    position: (await positionsOf(code))[0] ?? null,
    club: await clubOf(player.clubCode),
  };
}

/** A traded player as the screen shows him: an offer names only players the sync holds (tradeClose.ts). */
async function tradedShown(
  ctx: QueryCtx,
  code: number,
  positionsOf: PositionsNow,
  clubOf: Clubs,
): Promise<TradedPlayer> {
  const shown = await shownPlayer(ctx, code, positionsOf, clubOf);
  if (shown === null)
    throw new Error(
      `A trade offer names player ${code}, whom the football sync doesn't hold`,
    );
  return shown;
}

/** Position, then name: a squad's order on the screen. */
const byPositionThenName = (one: TradedPlayer, other: TradedPlayer) =>
  positionRank(one.position) - positionRank(other.position) ||
  one.name.localeCompare(other.name);

/** Who reviews the offer under `review`, as the screen names them. */
function reviewerNamed(
  league: Doc<"leagues">,
  review: { kind: "veto"; by: string } | { kind: "vote" } | null,
): Reviewer | null {
  if (review === null) return null;
  if (review.kind === "vote") return "vote";
  return review.by === league.commissionerEmail
    ? "commissioner"
    : "coCommissioner";
}

/** The Trades screen for the manager's team at the minute `now` (a query may not read the clock). */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: tradesView,
  handler: async (ctx, { leagueId, now }) => {
    const { league, team: mine } = await managerOf(ctx, leagueId);
    const rules = await latestRules(ctx, leagueId);
    const deadlines = await leagueDeadlines(ctx, leagueId);
    const positionsOf = await positionsNow(ctx, leagueId);
    const clubOf = clubsByCode(ctx);
    const offers = await leagueOffers(ctx, leagueId);
    const held = new Set(
      offers.flatMap((offer) =>
        offer.review === undefined ? [] : [...offer.gives, ...offer.gets],
      ),
    );
    const teams = await teamsOf(ctx, leagueId);
    const squads = new Map<Id<"teams">, number[]>();
    for (const team of teams)
      squads.set(
        team._id,
        (await squadOf(ctx, team._id)).map((row) => row.playerCode),
      );
    const myCodes = squads.get(mine._id) ?? [];
    const myLimitsNow = await limitsBroken(
      ctx,
      leagueId,
      myCodes,
      rules?.squad ?? null,
    );

    const shownTeams = await Promise.all(
      [mine, ...teams.filter((team) => team._id !== mine._id)].map(
        async (team) => {
          const players = await Promise.all(
            (squads.get(team._id) ?? []).map(async (code) => {
              const shown = await shownPlayer(ctx, code, positionsOf, clubOf);
              return shown === null ? null : { ...shown, held: held.has(code) };
            }),
          );
          const sorted = players
            .filter((player) => player !== null)
            .sort(byPositionThenName);
          return {
            teamId: team._id,
            teamName: team.name,
            onAutoTeam: onAutoTeam(team),
            players: sorted,
          };
        },
      ),
    );

    const myOffers = offers.filter(
      (offer) => offer.fromTeamId === mine._id || offer.toTeamId === mine._id,
    );
    const shownOffers = await Promise.all(
      myOffers.map(async (offer) => {
        const nameOf = (teamId: Id<"teams">) =>
          teams.find((team) => team._id === teamId)?.name ?? "";
        const out = offer.fromTeamId === mine._id ? offer.gives : offer.gets;
        const into = offer.fromTeamId === mine._id ? offer.gets : offer.gives;
        const after = [
          ...myCodes.filter((code) => !out.includes(code)),
          ...into,
        ];
        const reviewNow =
          offer.review === undefined
            ? await reviewerOf(ctx, league, offer)
            : offer.review.reviewer;
        const picks =
          offer.picks === undefined
            ? null
            : {
                gives: await pickName(ctx, offer.picks.gives),
                gets: await pickName(ctx, offer.picks.gets),
              };
        return {
          offerId: offer._id,
          fromTeamId: offer.fromTeamId,
          fromTeamName: nameOf(offer.fromTeamId),
          toTeamId: offer.toTeamId,
          toTeamName: nameOf(offer.toTeamId),
          gives: await Promise.all(
            offer.gives.map((code) =>
              tradedShown(ctx, code, positionsOf, clubOf),
            ),
          ),
          gets: await Promise.all(
            offer.gets.map((code) =>
              tradedShown(ctx, code, positionsOf, clubOf),
            ),
          ),
          picks,
          note: offer.note ?? null,
          madeAt: offer.madeAt,
          closes:
            offer.review === undefined
              ? nextDeadline(deadlines, offer.madeAt)
              : null,
          reviewer: reviewerNamed(league, reviewNow),
          reviewEndsAt: offer.review?.endsAt ?? null,
          warnings: newlyBroken(
            myLimitsNow,
            await limitsBroken(ctx, leagueId, after, rules?.squad ?? null),
          ),
        };
      }),
    );

    return {
      myTeamId: mine._id,
      review: rules === null ? "none" : tradeRulesOf(rules).review,
      shut: await tradesShut(ctx, league, deadlines, now),
      squadMaximum: rules?.squad.size?.maximum ?? null,
      teams: shownTeams,
      offers: shownOffers,
    };
  },
});
