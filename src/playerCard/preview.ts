// The player card in the preview (src/app/preview.ts): a card for each of Scouting's preview players,
// with three matches at his base points at each of his positions under the first scoring set by the
// server's own rule (cardPoints), and his club's next fixtures. Saka carries FPL's news, and an
// override on one match.

import { basePoints, cardPositions } from "../../convex/playerCard/cardPoints";
import { categoryName } from "../../convex/scoring/categories";
import { FIRST_SCORING } from "../../convex/scoring/firstScoring";
import type { MatchStats } from "../../convex/scoring/values";
import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import { ARSENAL, CHELSEA, LIVERPOOL, previewPlayers, previewShortlist } from "../scouting/preview";
import type { PlayedMatch, PlayerCard, PlayerCardSeam } from "./seam";

const CLUBS = [ARSENAL, CHELSEA, LIVERPOOL];
const lastSaturday = Date.now() - ((new Date().getDay() + 1) % 7) * DAY_MS;
const opponentOf = (clubCode: number, index: number) => CLUBS.filter((club) => club.code !== clubCode)[index % 2];

/** His three newest matches, newest first: the last one's record not yet whole. */
const RECORDS: readonly (MatchStats | null)[] = [null, { minutes: 90, goals_scored: 1, assists: 1 }, { minutes: 64, yellow_cards: 1 }];

/** One match the league overrode, so the card shows how an override reads (#32). */
const PREVIEW_OVERRIDDEN = "Saka";
const PREVIEW_OVERRIDE = { points: 9, reason: "The feed gave his assist to Odegaard" };

/** A made-up role line, for the preview alone. */
const PREVIEW_ROLE_PLAYER = "Palmer";
const PREVIEW_ROLE = { name: "Number 10", points: 1, lines: [{ stat: "big_chance_created", name: categoryName("big_chance_created"), actions: 1, points: 1 }] };

function matchesOf(player: (typeof previewPlayers)[number]): PlayedMatch[] {
  return RECORDS.map((record, index) => {
    const points = basePoints(record, FIRST_SCORING, player.positions).map(({ position, total, categories }) => ({
      position,
      total,
      categories: categories.map((each) => ({ ...each, name: categoryName(each.stat) })),
    }));
    // One match shows how a role's line reads (spec/05), though the first set adjusts no role.
    const started = player.name === PREVIEW_ROLE_PLAYER && index === 1 && record !== null ? { role: PREVIEW_ROLE } : {};
    return {
      fixtureCode: player.code * 100 + index,
      gameweek: 9 - index,
      kickoff: lastSaturday - index * WEEK_MS,
      home: index % 2 === 0 ? player.club : opponentOf(player.club.code, index),
      away: index % 2 === 0 ? opponentOf(player.club.code, index) : player.club,
      minutes: record?.minutes ?? null,
      points,
      // The preview plays the first set, which has no version's name.
      version: null,
      ...started,
      override: player.name === PREVIEW_OVERRIDDEN && index === 1 ? PREVIEW_OVERRIDE : null,
      // The two newest may still move: one still being played, one inside its corrections window.
      provisional: index <= 1,
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
    pricedAt: cardPositions(player.positions),
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

/** The preview saves nothing: an override is taken and forgotten. */
const overrideNothing = () => Promise.resolve(null);

export const previewPlayerCard: PlayerCardSeam = {
  ...previewShortlist,
  usePlayerCard: (_leagueId, playerCode) => cards.get(playerCode) ?? null,
  useOverride: () => overrideNothing,
};
