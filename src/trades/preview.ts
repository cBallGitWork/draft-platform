// Trades in the preview (src/app/preview.ts), as the approved pictures have them
// (docs/design/approved/trades): an offer to you, one from you, one in review under a commissioner
// veto, closed offers below, and the squads to make one from, a player held in the trade under
// review; and a trade between two other teams for the manager to review, which the pictures don't
// draw (Craig's words, 10 Nov 2026, on #383). Made up.

import type { Id } from "../../convex/_generated/dataModel";
import type { Position } from "../../convex/positions/positionTables";
import { DAY_MS, HOUR_MS } from "../../convex/shared/time";
import { ARSENAL, CHELSEA, LIVERPOOL } from "../scouting/preview";
import { previewIdOf } from "../table/preview";
import type {
  ClosedOffer,
  ScreenOffer,
  ScreenTeam,
  TradedPlayer,
  TradesSeam,
  TradesView,
  TradeToReview,
} from "./seam";

const CLUBS = {
  ARS: ARSENAL,
  AVL: { code: 7, name: "Aston Villa", shortName: "AVL" },
  CHE: CHELSEA,
  LIV: LIVERPOOL,
  NEW: { code: 4, name: "Newcastle", shortName: "NEW" },
  NFO: { code: 17, name: "Nottingham Forest", shortName: "NFO" },
  MCI: { code: 43, name: "Manchester City", shortName: "MCI" },
} as const;

let nextCode = 1;
const player = (
  name: string,
  position: Position,
  club: keyof typeof CLUBS,
): TradedPlayer => ({ code: nextCode++, name, position, club: CLUBS[club] });

const PALMER = player("Palmer", "CAM", "CHE");
const KERKEZ = player("Kerkez", "FB", "LIV");
const ROGERS = player("Rogers", "W", "AVL");
const MURILLO = player("Murillo", "CB", "NFO");
const SALAH = player("Salah", "W", "LIV");
const ODEGAARD = player("Ødegaard", "CAM", "ARS");
const WISSA = player("Wissa", "ST", "NEW");
const mine = [
  player("Gvardiol", "CB", "MCI"),
  MURILLO,
  KERKEZ,
  PALMER,
  ROGERS,
  player("Haaland", "ST", "MCI"),
];

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

const ME = "Saka Potatoes";
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
  teams: [
    team(ME, mine, [MURILLO]),
    team("Kroos Control", [
      player("Raya", "GK", "ARS"),
      player("Saliba", "CB", "ARS"),
      player("Gusto", "FB", "CHE"),
      SALAH,
      player("Isak", "ST", "LIV"),
    ]),
    team("Rovers XI", [ODEGAARD, player("Rice", "CDM", "ARS")]),
    team("Pique Blinders", [WISSA, player("Wood", "ST", "NFO")]),
  ],
  offers: [
    offer("preview-offer-1", "Kroos Control", ME, [SALAH], [PALMER, KERKEZ], {
      note: "Salah for your two. Palmer's flying, I need a 10.",
    }),
    offer("preview-offer-2", ME, "Rovers XI", [ROGERS], [ODEGAARD], {
      note: "Rogers is a better fit for your 4-3-3.",
    }),
    offer("preview-offer-3", "Pique Blinders", ME, [WISSA], [MURILLO], {
      closes: null,
      reviewEndsAt: now + 20 * HOUR_MS,
    }),
  ],
  closed: [
    closedOffer("preview-closed-1", ME, "Rovers XI", [ROGERS], [ODEGAARD], "rejected", 2),
    closedOffer("preview-closed-2", "Pique Blinders", ME, [WISSA], [MURILLO], "rejected", 4),
    closedOffer("preview-closed-3", ME, "Kroos Control", [ROGERS], [SALAH], "withdrawn", 5),
  ],
};

/** A trade between two other teams, in review under a commissioner veto: the manager's to block. */
const toReview: TradeToReview[] = [
  {
    offerId: "preview-review-1" as Id<"tradeOffers">,
    fromTeamName: "Rovers XI",
    toTeamName: "Kroos Control",
    gives: [player("Rice", "CDM", "ARS")],
    gets: [player("Isak", "ST", "LIV")],
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
    offer: async () => null,
    counter: async () => null,
    accept: async () => null,
    reject: async () => null,
    withdraw: async () => null,
    block: async () => null,
    against: async () => null,
    takeBack: async () => null,
  }),
};
