// The player card in the preview (src/preview.ts): a card for each of Scouting's preview players,
// with three matches priced at his best position under the first scoring set by the server's own
// rule (cardPoints), and his club's next fixtures. Saka carries FPL's news.

import { cardPoints } from "../../convex/playerCard/cardPoints";
import { categoryName } from "../../convex/scoring/categories";
import { FIRST_SCORING } from "../../convex/scoring/firstScoring";
import type { MatchStats } from "../../convex/scoring/scoring";
import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import { ARSENAL, CHELSEA, LIVERPOOL, previewPlayers, previewShortlist } from "../scouting/preview";
import type { PlayedMatch, PlayerCard, PlayerCardSeam } from "./seam";

const CLUBS = [ARSENAL, CHELSEA, LIVERPOOL];
const lastSaturday = Date.now() - ((new Date().getDay() + 1) % 7) * DAY_MS;
const opponentOf = (clubCode: number, index: number) => CLUBS.filter((club) => club.code !== clubCode)[index % 2];

/** His three newest matches, newest first: the last one's record not yet whole. */
const RECORDS: readonly (MatchStats | null)[] = [null, { minutes: 90, goals_scored: 1, assists: 1 }, { minutes: 64, yellow_cards: 1 }];

function matchesOf(player: (typeof previewPlayers)[number]): PlayedMatch[] {
  return RECORDS.map((record, index) => {
    const points = cardPoints(record, FIRST_SCORING, player.positions, null);
    return {
      fixtureCode: player.code * 100 + index,
      gameweek: 9 - index,
      kickoff: lastSaturday - index * WEEK_MS,
      home: index % 2 === 0 ? player.club : opponentOf(player.club.code, index),
      away: index % 2 === 0 ? opponentOf(player.club.code, index) : player.club,
      minutes: record?.minutes ?? null,
      points: { ...points, categories: points.categories.map((each) => ({ ...each, name: categoryName(each.stat) })) },
    };
  });
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
    ownerTeamName: player.ownerTeamName,
    news: injured ? "Hamstring injury - 75% chance of playing" : null,
    chanceOfPlaying: injured ? 75 : null,
    matches: matchesOf(player),
    nextFixtures: [1, 2, 3, 4, 5].map((weeksOn) => ({
      fixtureCode: player.code * 100 + 50 + weeksOn,
      gameweek: 9 + weeksOn,
      kickoff: lastSaturday + weeksOn * WEEK_MS,
      home: weeksOn % 2 === 0 ? player.club : opponentOf(player.club.code, weeksOn),
      away: weeksOn % 2 === 0 ? opponentOf(player.club.code, weeksOn) : player.club,
    })),
  };
}

const cards = new Map(previewPlayers.map((player) => [player.code, cardOf(player)]));

export const previewPlayerCard: PlayerCardSeam = { ...previewShortlist, usePlayerCard: (_leagueId, playerCode) => cards.get(playerCode) ?? null };
