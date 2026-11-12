// The player card in the preview (src/app/preview.ts): a card for each of Scouting's preview players,
// with six matches and a postponed one, each at his base points at each of his positions under the first scoring set by the
// server's own rule (cardPoints), and his club's next fixtures. Saka carries FPL's news, and an
// override on one match.

import type { SlotPosition } from "../../convex/lineup/pitch";
import { basePoints, cardPositions, logCategories, rankOfPlayer } from "../../convex/playerCard/cardPoints";
import { categoryName } from "../../convex/scoring/categories";
import { FIRST_SCORING } from "../../convex/scoring/firstScoring";
import type { MatchStats } from "../../convex/scoring/values";
import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import { ARSENAL, CHELSEA, LIVERPOOL, previewPlayers, previewShortlist } from "../scouting/preview";
import { previewScouts } from "../scouting/scouts/preview";
import { previewGameweek, previewSays, proLeague } from "../shared/preview";
import { previewIdOf } from "../table/preview";
import { seasonFigures } from "./gameLog";
import type { CardAction, PlayedMatch, PlayerCard, PlayerCardSeam, PositionRank, WaiverChanges } from "./seam";

const CLUBS = [ARSENAL, CHELSEA, LIVERPOOL];
const lastSaturday = Date.now() - ((new Date().getDay() + 1) % 7) * DAY_MS;
const opponentOf = (clubCode: number, index: number) => CLUBS.filter((club) => club.code !== clubCode)[index % 2];

/** His newest matches, newest first: the newest still being played, then one his club's
 *  postponement leaves a row for (the gameweek between the second and the third). */
const RECORDS: readonly (MatchStats | null)[] = [
  { minutes: 58 },
  { minutes: 90, goals_scored: 1, assists: 1, big_chance_created: 1 },
  { minutes: 64, yellow_cards: 1 },
  { minutes: 90, goals_scored: 2, clean_sheets: 1 },
  { minutes: 74, assists: 1, goals_conceded: 1 },
  null,
];
/** Each match's score, home side first, in RECORDS' order. */
const SCORES = [{ home: 0, away: 0 }, { home: 1, away: 2 }, { home: 3, away: 0 }, { home: 2, away: 2 }, { home: 1, away: 0 }, null];
/** The gameweek his club's postponed match was in. */
const POSTPONED_GAMEWEEK = previewGameweek - 2;

/** One match the league overrode, so the card shows how an override reads (#32). */
const PREVIEW_OVERRIDDEN = "Saka";
const PREVIEW_OVERRIDE = { points: 9, reason: "The feed gave his assist to Odegaard" };

/** A made-up role line, for the preview alone. */
const PREVIEW_ROLE_PLAYER = "Palmer";
const PREVIEW_ROLE = { name: "Number 10", points: 1, sides: [{ points: 1, lines: [{ stat: "big_chance_created", name: categoryName("big_chance_created"), actions: 1 }] }] };

function matchesOf(player: (typeof previewPlayers)[number]): PlayedMatch[] {
  return RECORDS.map((record, index) => {
    const points = basePoints(record, FIRST_SCORING, player.positions).map(({ position, total, categories }) => ({
      position,
      total,
      categories: categories.map((each) => ({ ...each, name: categoryName(each.stat) })),
    }));
    // One match shows how a role's line reads (spec/05), though the first set adjusts no role.
    const started = player.name === PREVIEW_ROLE_PLAYER && index === 1 && record !== null ? { role: PREVIEW_ROLE } : {};
    // A week further back past the postponed one.
    const weeksAgo = index < 2 ? index : index + 1;
    return {
      fixtureCode: player.code * 100 + index,
      gameweek: previewGameweek - weeksAgo,
      kickoff: lastSaturday - weeksAgo * WEEK_MS,
      home: index % 2 === 0 ? player.club : opponentOf(player.club.code, index),
      away: index % 2 === 0 ? opponentOf(player.club.code, index) : player.club,
      minutes: record?.minutes ?? null,
      score: SCORES[index],
      stats: record,
      points,
      // The preview plays the first set, which has no version's name.
      version: null,
      ...started,
      override: player.name === PREVIEW_OVERRIDDEN && index === 1 ? PREVIEW_OVERRIDE : null,
      // The newest may still move: it is still being played.
      provisional: index === 0,
    };
  });
}

/** Last season, in the preview: 34 matches like his best one here at each of his positions, but for
 *  one player, who wasn't in the Premier League. */
const PREVIEW_LAST_SEASON = 2025;
const PREVIEW_APPEARANCES = 34;
const PREVIEW_NEWCOMER = "Van Dijk";
function lastSeasonOf(player: (typeof previewPlayers)[number]): PlayerCard["lastSeason"] {
  if (player.name === PREVIEW_NEWCOMER) return { season: PREVIEW_LAST_SEASON, played: null };
  const match = RECORDS[1]!;
  return {
    season: PREVIEW_LAST_SEASON,
    played: {
      appearances: PREVIEW_APPEARANCES,
      minutes: PREVIEW_APPEARANCES * (match.minutes ?? 0),
      points: basePoints(match, FIRST_SCORING, player.positions).map(({ total }) => PREVIEW_APPEARANCES * (total ?? 0)),
    },
  };
}

function cardOf(player: (typeof previewPlayers)[number]): PlayerCard {
  const injured = player.name === "Saka";
  return {
    code: player.code,
    name: player.name,
    fullName: player.fullName,
    club: player.club,
    gone: false,
    positions: player.positions,
    pricedAt: cardPositions(player.positions),
    ownerTeamName: player.ownerTeamName,
    ownerTeamId: player.ownerTeamName === null ? null : previewIdOf(player.ownerTeamName),
    news: injured ? "Hamstring injury - 75% chance of playing" : null,
    chanceOfPlaying: injured ? 75 : null,
    matches: matchesOf(player),
    postponed: [
      {
        fixtureCode: player.code * 100 + 40,
        gameweek: POSTPONED_GAMEWEEK,
        kickoff: null,
        home: opponentOf(player.club.code, 1),
        away: player.club,
      },
    ],
    categories: logCategories(FIRST_SCORING, cardPositions(player.positions)),
    lastSeason: lastSeasonOf(player),
    nextFixtures: [1, 2, 3, 4, 5].map((weeksOn) => ({
      fixtureCode: player.code * 100 + 50 + weeksOn,
      gameweek: previewGameweek + weeksOn,
      kickoff: lastSaturday + weeksOn * WEEK_MS,
      home: weeksOn % 2 === 0 ? player.club : opponentOf(player.club.code, weeksOn),
      away: weeksOn % 2 === 0 ? opponentOf(player.club.code, weeksOn) : player.club,
    })),
  };
}

const cards = new Map(previewPlayers.map((player) => [player.code, cardOf(player)]));

/** His rank at a position among the preview's players holding it, by their cards' base points
 *  there, placed by the server's own rule (positionRank.ts). */
function rankOf(playerCode: number, position: SlotPosition): PositionRank {
  const holding = [...cards.values()].filter((card) => card.pricedAt.includes(position));
  const points = holding.map((card) => ({ code: card.code, points: seasonFigures(card.matches, card.pricedAt.indexOf(position)).seasonPoints }));
  return { place: rankOfPlayer(points, playerCode), of: holding.length };
}

/** The preview saves nothing: an override is taken and forgotten, and a drop, a claim or a pickup
 *  says so. */
const overrideNothing = () => Promise.resolve(null);
export const previewWaiverOutcomes = {
  drop: "nobody was dropped",
  claim: "no claim was put in",
  pickUp: "nobody was picked up",
} as const;
const waiverChanges: WaiverChanges = {
  drop: previewSays(previewWaiverOutcomes.drop),
  claim: previewSays(previewWaiverOutcomes.claim),
  pickUp: previewSays(previewWaiverOutcomes.pickUp),
};

/** The preview manager's own team, which holds Saka. */
const OWN_TEAM = proLeague.teamName;
/** The preview manager's squad, to name who goes with a claim or a pickup. */
const PREVIEW_SQUAD = previewPlayers.filter((player) => player.ownerTeamName === OWN_TEAM).map(({ code, name }) => ({ playerCode: code, playerName: name }));

/** In the preview the manager drops his own team's player, has nothing on another team's, claims
 *  one on Scouting's preview waivers and picks up any other. */
function cardActionOf(playerCode: number): CardAction {
  const player = previewPlayers.find(({ code }) => code === playerCode);
  if (player === undefined) return { kind: "none" };
  if (player.ownerTeamName !== null) return { kind: player.ownerTeamName === OWN_TEAM ? "drop" : "none" };
  return player.onWaivers === null ? { kind: "pickUp", squad: PREVIEW_SQUAD } : { kind: "claim", firstRun: player.onWaivers.firstRun, squad: PREVIEW_SQUAD };
}

export const previewPlayerCard: PlayerCardSeam = {
  ...previewShortlist,
  ...previewScouts,
  usePlayerCard: (_leagueId, playerCode) => cards.get(playerCode) ?? null,
  useCardAction: (_leagueId, playerCode) => cardActionOf(playerCode),
  usePositionRank: (_leagueId, playerCode, position) => (position === null ? undefined : rankOf(playerCode, position)),
  useWaiverChanges: () => waiverChanges,
  useOverride: () => overrideNothing,
  useRemoveOverride: () => overrideNothing,
};
