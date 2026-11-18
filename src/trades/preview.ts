// Trades in the preview (src/app/preview.ts), as the approved pictures have them
// (docs/design/approved/trades): an offer to you, one from you, one in review under a commissioner
// veto, closed offers below, and the squads to make one from, a player held in the trade under
// review; and a trade between two other teams for the manager to review, which the pictures don't
// draw (Craig's words, 10 Nov 2026, on #383). The teams and their men are the Pro League's, as
// Scouting's preview holds them (#2450). Made up.

import type { Id } from "../../convex/_generated/dataModel";
import { DAY_MS, HOUR_MS } from "../../convex/shared/time";
import type { ListedPlayer } from "../../convex/scouting/playersList";
import { previewPlayers, previewRivals } from "../scouting/preview";
import { previewDone, proLeague } from "../shared/preview";
import { previewIdOf } from "../shared/previewDraw";
import type {
  ClosedOffer,
  ScreenOffer,
  ScreenTeam,
  TradedPlayer,
  TradesSeam,
  TradesView,
  TradeToReview,
} from "./seam";

/** A Pro League player as Trades names him: Scouting's (../scouting/preview.ts), at his first
 *  position, so each team holds the men it holds on every other screen (#2450). Trades has always
 *  named Man City in full. */
const traded = ({ code, name, positions, club }: ListedPlayer): TradedPlayer => ({
  code,
  name,
  position: positions[0],
  club: club.shortName === "MCI" ? { ...club, name: "Manchester City" } : club,
});
const squadOf = (teamName: string) => previewPlayers.filter(({ ownerTeamName }) => ownerTeamName === teamName).map(traded);
/** A man of `players`, the same object the team's list holds, so a held one shows as held. */
const named = (players: readonly TradedPlayer[], name: string) => players.find((each) => each.name === name)!;

const ME = proLeague.teamName!;
const [RIVAL, THIRD, FOURTH] = previewRivals;
const [mine, rivals, thirds, fourths] = [ME, RIVAL, THIRD, FOURTH].map(squadOf);
const PALMER = named(mine, "Palmer");
const MUNOZ = named(mine, "Muñoz");
const ROGERS = named(mine, "Rogers");
const MURILLO = named(mine, "Murillo");
const GYOKERES = named(rivals, "Gyökeres");
const DOKU = named(thirds, "Doku");
const TONALI = named(thirds, "Tonali");
const WELBECK = named(fourths, "Welbeck");

const team = (
  teamName: string,
  players: readonly TradedPlayer[],
  held: readonly TradedPlayer[] = [],
): ScreenTeam => ({
  teamId: previewIdOf(teamName),
  teamName,
  onAutoTeam: false,
  players: players.map((each) => ({ ...each, held: held.includes(each) })),
  // The pictures are mid-season, after the draft, so no picks are left to trade.
  picks: [],
});

const now = Date.now();
const offer = (
  offerId: string,
  from: string,
  to: string,
  gives: TradedPlayer[],
  gets: TradedPlayer[],
  rest: Partial<ScreenOffer> = {},
): ScreenOffer => ({
  offerId: offerId as Id<"tradeOffers">,
  fromTeamId: previewIdOf(from),
  fromTeamName: from,
  toTeamId: previewIdOf(to),
  toTeamName: to,
  gives,
  gets,
  picks: null,
  pickTerms: null,
  note: null,
  madeAt: now - DAY_MS,
  closes: { gameweek: 10, at: now + 5 * DAY_MS },
  reviewer: "commissioner",
  reviewEndsAt: null,
  warnings: [],
  ...rest,
});

const closedOffer = (
  closedId: string,
  from: string,
  to: string,
  gives: TradedPlayer[],
  gets: TradedPlayer[],
  why: ClosedOffer["why"],
  daysAgo: number,
): ClosedOffer => ({
  closedId: closedId as Id<"closedTradeOffers">,
  fromTeamId: previewIdOf(from),
  fromTeamName: from,
  toTeamId: previewIdOf(to),
  toTeamName: to,
  gives,
  gets,
  picks: null,
  closedAt: now - daysAgo * DAY_MS,
  why,
});

const view: TradesView = {
  myTeamId: previewIdOf(ME),
  shut: null,
  squadMaximum: 20,
  teams: [team(ME, mine, [MURILLO]), team(RIVAL, rivals), team(THIRD, thirds), team(FOURTH, fourths)],
  offers: [
    offer("preview-offer-1", RIVAL, ME, [GYOKERES], [PALMER, MUNOZ], {
      note: "Gyökeres for your two. Palmer's flying, I need a 10.",
    }),
    offer("preview-offer-2", ME, THIRD, [ROGERS], [DOKU], {
      note: "Rogers is a better fit for your 4-3-3.",
    }),
    offer("preview-offer-3", FOURTH, ME, [WELBECK], [MURILLO], {
      closes: null,
      reviewEndsAt: now + 20 * HOUR_MS,
    }),
  ],
  closed: [
    closedOffer("preview-closed-1", ME, THIRD, [ROGERS], [DOKU], "rejected", 2),
    closedOffer("preview-closed-2", FOURTH, ME, [WELBECK], [MURILLO], "rejected", 4),
    closedOffer("preview-closed-3", ME, RIVAL, [ROGERS], [GYOKERES], "withdrawn", 5),
  ],
};

/** A trade between two other teams, in review under a commissioner veto: the manager's to block. */
const toReview: TradeToReview[] = [
  {
    offerId: "preview-review-1" as Id<"tradeOffers">,
    fromTeamName: THIRD,
    toTeamName: RIVAL,
    gives: [TONALI],
    gets: [GYOKERES],
    picks: null,
    note: "Need a 9.",
    reviewEndsAt: now + 15 * HOUR_MS,
    yours: "block",
  },
];

export const previewTrades: TradesSeam = {
  useTrades: () => view,
  useReviews: () => toReview,
  useTradeChanges: () => ({
    offer: previewDone,
    counter: previewDone,
    accept: previewDone,
    reject: previewDone,
    withdraw: previewDone,
    block: previewDone,
    against: previewDone,
    takeBack: previewDone,
  }),
};
