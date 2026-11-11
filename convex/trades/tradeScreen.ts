import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import { positionRank } from "../positions/positionTables";
import { latestRules } from "../rules/rulesHistory";
import { managerOf, teamsOf } from "../shared/leagueAccess";
import { clubsByCode, type Clubs } from "../shared/players";
import { closedOffer, closedOffersOf, type ClosedOffer } from "./closedOffers";
import { shownPlayer, tradedPlayer, tradedShown, type TradedPlayer } from "./tradedPlayers";
import { squadOf } from "../squads/squadPlace";
import { limitsBroken, squadWarning } from "../squads/squads";
import { newlyBroken } from "../waivers/waiverRun";
import { leagueOffers, pickName } from "./tradeClose";
import { pickHolders, tradablePick } from "./tradePicks";
import { reviewerOf } from "./tradeReview";
import { offerCloses, onAutoTeam, tradeDeadlineInForce, tradesShut } from "./tradeShut";
import { tradePick } from "../schema/trades";

// The Trades screen's read (#383; spec/12 Trades, its approved picture docs/design/approved/trades):
// the offers to and from the manager's team, open or in review, each with when it closes, who it
// waits on and the squad limits it would break for him; and every team's squad to make an offer
// from, a player held in a trade under review marked.

export type { ClosedOffer, TradedPlayer };

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
  /** The same picks as offered, `teamId`'s pick in `round`, for a counter to start with (#1471);
   *  null for a players' trade. */
  pickTerms: v.union(v.object({ gives: tradePick, gets: tradePick }), v.null()),
  note: v.union(v.string(), v.null()),
  madeAt: v.number(),
  /** While open, when it closes unanswered: the next deadline, `gameweek`'s at `at`; or, made in the
   *  trade deadline's gameweek, once that gameweek's last match is over, a time nobody knows ahead,
   *  so `at` is null (#1492). Null while no deadline is known, and once accepted. */
  closes: v.union(
    v.object({ gameweek: v.number(), at: v.union(v.number(), v.null()) }),
    v.null(),
  ),
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
  /** The draft picks it holds now, round by round, to trade before the draft starts (spec/04, The
   *  picks; #1096): `teamId`'s pick in `round`, `teamName` its team, its own or one traded to it;
   *  `held` marks one in a trade under review. Empty once the draft starts, or with no rounds. */
  picks: v.array(tradablePick),
});
export type ScreenTeam = Infer<typeof screenTeam>;

export const tradesView = v.object({
  myTeamId: v.id("teams"),
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
  /** Those that ended this season without going through, newest first (closedOffers.ts). */
  closed: v.array(closedOffer),
});
export type TradesView = Infer<typeof tradesView>;

/** The log line for a squad player the football sync doesn't hold, left off the Trades screen. */
export const missingPlayerLog = (teamName: string, code: number) =>
  `Trades screen: ${teamName}'s player ${code} isn't held by the football sync, so he isn't shown`;

/** Position, then name: a squad's order on the screen. */
const byPositionThenName = (one: TradedPlayer, other: TradedPlayer) =>
  positionRank(one.position) - positionRank(other.position) ||
  one.name.localeCompare(other.name);

/** An offer's players each way and its picks, as the screen shows them. */
export async function termsShown(
  ctx: QueryCtx,
  offer: Doc<"tradeOffers">,
  positionsOf: PositionsNow,
  clubOf: Clubs,
) {
  const shown = (codes: readonly number[]) =>
    Promise.all(
      codes.map((code) => tradedShown(ctx, code, positionsOf, clubOf)),
    );
  return {
    gives: await shown(offer.gives),
    gets: await shown(offer.gets),
    picks:
      offer.picks === undefined
        ? null
        : {
            gives: await pickName(ctx, offer.picks.gives),
            gets: await pickName(ctx, offer.picks.gets),
          },
  };
}

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
    const tradeDeadline = await tradeDeadlineInForce(ctx, leagueId, deadlines, now);
    const positionsOf = await positionsNow(ctx, leagueId);
    const clubOf = clubsByCode(ctx);
    const offers = await leagueOffers(ctx, leagueId);
    const held = new Set(
      offers.flatMap((offer) =>
        offer.review === undefined ? [] : [...offer.gives, ...offer.gets],
      ),
    );
    const teams = await teamsOf(ctx, leagueId);
    const picksOf = await pickHolders(ctx, leagueId, teams, offers);
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
              if (shown === null) {
                console.warn(missingPlayerLog(team.name, code));
                return null;
              }
              return { ...shown, held: held.has(code) };
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
            picks: picksOf(team._id),
          };
        },
      ),
    );

    const myOffers = offers.filter(
      (offer) => offer.fromTeamId === mine._id || offer.toTeamId === mine._id,
    );
    const shownOffers = await Promise.all(
      myOffers.map(async (offer) => {
        const nameOf = (teamId: Id<"teams">) => {
          const team = teams.find((each) => each._id === teamId);
          if (team === undefined)
            throw new Error(
              `Trade offer ${offer._id} names team ${teamId}, which isn't in its league`,
            );
          return team.name;
        };
        const out = offer.fromTeamId === mine._id ? offer.gives : offer.gets;
        const into = offer.fromTeamId === mine._id ? offer.gets : offer.gives;
        const after = [
          ...myCodes.filter((code) => !out.includes(code)),
          ...into,
        ];
        const reviewNow =
          offer.review === undefined
            ? await reviewerOf(ctx, league, offer, deadlines, now)
            : offer.review.reviewer;
        return {
          offerId: offer._id,
          fromTeamId: offer.fromTeamId,
          fromTeamName: nameOf(offer.fromTeamId),
          toTeamId: offer.toTeamId,
          toTeamName: nameOf(offer.toTeamId),
          ...(await termsShown(ctx, offer, positionsOf, clubOf)),
          pickTerms: offer.picks ?? null,
          note: offer.note ?? null,
          madeAt: offer.madeAt,
          closes:
            offer.review === undefined
              ? offerCloses(deadlines, offer.madeAt, tradeDeadline)
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
      shut: await tradesShut(ctx, league, deadlines, now),
      squadMaximum: rules?.squad.size?.maximum ?? null,
      teams: shownTeams,
      offers: shownOffers,
      closed: await closedOffersOf(ctx, mine._id, teams, now, (code) =>
        tradedShown(ctx, code, positionsOf, clubOf),
      ),
    };
  },
});
