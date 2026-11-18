// The player card in the preview (src/app/preview.ts): a card for each of Scouting's preview players,
// with his season in his club's matches in Football's preview and any it postponed, each at his base
// points at each of his positions under the first scoring set by the server's own rule
// (cardPoints), and his club's next fixtures, Football's too. My team's Squad tab adds up the same
// season (#2455), and the matchup scores its men by it (#2478). Saka carries FPL's news, and an override on one match.

import { areasOf, type Area, type SlotPosition } from "../../convex/lineup/pitch";
import { basePoints, cardPositions, logCategories, rankOfPlayer } from "../../convex/playerCard/cardPoints";
import { NEXT_FIXTURES_SHOWN } from "../../convex/playerCard/cardLimits";
import { categoryName } from "../../convex/scoring/categories";
import { FIRST_SCORING } from "../../convex/scoring/firstScoring";
import type { MatchStats } from "../../convex/scoring/values";
import { ASSISTS, CLEAN_SHEETS, GOALS, GOALS_CONCEDED, MINUTES_STAT, SAVES, YELLOW_CARDS } from "../../convex/stats/matchRecords";
import { previewPlayers, previewShortlist } from "../scouting/preview";
import { previewScouts } from "../scouting/scouts/preview";
import { previewDone, previewGameMode, previewGameweek, previewSays, proLeague } from "../shared/preview";
import { previewIdOf } from "../shared/previewDraw";
import { PREVIEW_SAKA_NEWS, PREVIEW_UNPLAYED } from "../myTeam/tactics/preview";
import { previewClubMatch, previewClubPostponed, previewClubUpcoming, previewFullTimeGoals } from "../premierLeague/preview";
import type { GameweekMatch } from "../premierLeague/seam";
import { pointsOf, seasonFigures } from "./gameLog";
import type { CardAction, PlayedMatch, PlayerCard, PlayerCardSeam, PositionRank, WaiverChanges } from "./seam";

type PreviewPlayer = (typeof previewPlayers)[number];
/** The season's gameweeks so far, the current one in. */
const SO_FAR = Array.from({ length: previewGameweek }, (_, index) => index + 1);

/** How many matches in ten a man in each area scores in, where his club scores; a keeper never. */
const SCORES_IN_TEN: Partial<Record<Area, number>> = { attack: 4, attackingMidfield: 4, midfield: 2, defensiveMidfield: 1, defence: 1 };
/** How long he plays in a match he is in, by turn. */
const MINUTES_PLAYED = [90, 90, 90, 78, 64, 90, 58, 90];

/** Whether he plays in his club's match in `gameweek`: not where he sits it out. */
const playsIn = (player: PreviewPlayer, gameweek: number) => player.code !== PREVIEW_UNPLAYED && (player.code * 7 + gameweek * 13) % 6 !== 0;
/** His furthest forward area, which his goals go by. */
const goalAreaOf = (player: PreviewPlayer) => areasOf(player.positions).at(-1)!;
/** Whether he is due a goal in `gameweek`, should his club score. */
const dueAGoal = (player: PreviewPlayer, gameweek: number) => playsIn(player, gameweek) && (player.code * 31 + gameweek * 17) % 10 < (SCORES_IN_TEN[goalAreaOf(player)] ?? 0);

/** His made-up record in his club's match, worked out from his code and the gameweek so a reload
 *  shows the same, his goals and assists never more than his club scored, nor his club's men's
 *  goals together (#2478), and his clean sheet and goals conceded its own: null for a gameweek he
 *  sat out. The one season his card, My team's Squad tab and the matchup read (#2455). */
function recordIn(player: PreviewPlayer, gameweek: number, match: GameweekMatch): MatchStats | null {
  const seed = player.code * 7 + gameweek * 13;
  if (!playsIn(player, gameweek) || match.score === null || match.score.state === "upcoming") return null;
  const home = match.home.code === player.club.code;
  const [scored, conceded] = home ? [match.score.homeGoals ?? 0, match.score.awayGoals ?? 0] : [match.score.awayGoals ?? 0, match.score.homeGoals ?? 0];
  const minutes = Math.min(MINUTES_PLAYED[seed % MINUTES_PLAYED.length], match.score.minutes ?? 90);
  const area = goalAreaOf(player);
  const keeper = area === "goalkeeper";
  // The club's men due a goal take its goals in their codes' order, one each.
  const dueBefore = previewPlayers.filter((each) => each.club.code === player.club.code && each.code < player.code && dueAGoal(each, gameweek)).length;
  const goals = dueAGoal(player, gameweek) && dueBefore < scored ? 1 : 0;
  const record: Record<string, number> = { [MINUTES_STAT]: minutes };
  if (goals > 0) record[GOALS] = goals;
  if (!keeper && scored > goals && seed % 4 === 1) record[ASSISTS] = 1;
  if (!keeper && seed % 7 === 2) record.big_chance_created = 1;
  if (seed % 9 === 4) record[YELLOW_CARDS] = 1;
  if (keeper) record[SAVES] = 1 + (seed % 5);
  if ((keeper || area === "defence") && minutes >= 60) {
    if (conceded === 0 && match.score.state === "fullTime") record[CLEAN_SHEETS] = 1;
    if (conceded > 0) record[GOALS_CONCEDED] = conceded;
  }
  return record;
}

/** One match the league overrode, so the card shows how an override reads (#32). */
const PREVIEW_OVERRIDDEN = "Saka";
const PREVIEW_OVERRIDE = { points: 9, reason: "The feed gave his assist to Odegaard" };

/** A made-up role line, for the preview alone. */
const PREVIEW_ROLE_PLAYER = "Palmer";
const PREVIEW_ROLE = { name: "Number 10", points: 1, sides: [{ points: 1, lines: [{ stat: "big_chance_created", name: categoryName("big_chance_created"), actions: 1 }] }] };

/** A record's base points at each of his positions under the first set, each category named. */
const pricedAt = (player: PreviewPlayer, record: MatchStats | null): PlayedMatch["points"] =>
  basePoints(record, FIRST_SCORING, player.positions).map(({ position, total, categories }) => ({
    position,
    total,
    categories: categories.map((each) => ({ ...each, name: categoryName(each.stat) })),
  }));

/** His club's match with his record in it, priced as his card prices it, with no role or override:
 *  the one match his card and the matchup read (#2478). */
function playedOf(player: PreviewPlayer, gameweek: number, match: GameweekMatch, record: MatchStats): PlayedMatch {
  const { fixtureCode, kickoff, home, away, score } = match;
  return {
    fixtureCode,
    gameweek,
    kickoff,
    home,
    away,
    minutes: record[MINUTES_STAT],
    score: score === null || score.homeGoals === null || score.awayGoals === null ? null : { home: score.homeGoals, away: score.awayGoals },
    stats: record,
    points: pricedAt(player, record),
    // The preview plays the first set, which has no version's name.
    version: null,
    override: null,
    // One still being played may still move.
    provisional: score?.state !== "fullTime",
  };
}

/** His matches this season, newest first: his club's in Football's gameweeks (../premierLeague/
 *  preview.ts) he played in, the newest maybe still being played. */
function matchesOf(player: PreviewPlayer): PlayedMatch[] {
  const played = SO_FAR.flatMap((gameweek) => {
    const match = previewClubMatch(gameweek, player.club.code);
    const record = match === undefined ? null : recordIn(player, gameweek, match);
    return match === undefined || record === null ? [] : [playedOf(player, gameweek, match, record)];
  });
  return played.toReversed().map((match, index) => ({
    ...match,
    // One match shows how a role's line reads (spec/05), though the first set adjusts no role.
    ...(player.name === PREVIEW_ROLE_PLAYER && index === 1 ? { role: PREVIEW_ROLE } : {}),
    override: player.name === PREVIEW_OVERRIDDEN && index === 1 ? PREVIEW_OVERRIDE : null,
  }));
}

/** Last season, in the preview: 34 matches like his best one here at each of his positions, but for
 *  one player, who wasn't in the Premier League. */
const PREVIEW_LAST_SEASON = 2025;
const PREVIEW_APPEARANCES = 34;
const PREVIEW_NEWCOMER = "Van Dijk";
const LAST_SEASON_MATCH: MatchStats = { [MINUTES_STAT]: 90, [GOALS]: 1, [ASSISTS]: 1, big_chance_created: 1 };
function lastSeasonOf(player: PreviewPlayer): PlayerCard["lastSeason"] {
  if (player.name === PREVIEW_NEWCOMER) return { season: PREVIEW_LAST_SEASON, played: null };
  const match = LAST_SEASON_MATCH;
  return {
    season: PREVIEW_LAST_SEASON,
    played: {
      appearances: PREVIEW_APPEARANCES,
      minutes: PREVIEW_APPEARANCES * (match.minutes ?? 0),
      points: basePoints(match, FIRST_SCORING, player.positions).map(({ total }) => PREVIEW_APPEARANCES * (total ?? 0)),
    },
  };
}

function cardOf(player: PreviewPlayer): PlayerCard {
  const injured = player.name === "Saka";
  return {
    code: player.code,
    name: player.name,
    fullName: player.fullName,
    club: player.club,
    // A made-up club number, a different one each.
    clubNumber: player.code + 6,
    gone: false,
    positions: player.positions,
    pricedAt: cardPositions(player.positions),
    ownerTeamName: player.ownerTeamName,
    ownerTeamId: player.ownerTeamName === null ? null : previewIdOf(player.ownerTeamName),
    news: injured ? PREVIEW_SAKA_NEWS : null,
    chanceOfPlaying: injured ? 75 : null,
    matches: matchesOf(player),
    // His club's matches Football's preview has postponed, waiting for a new date (#2466).
    postponed: previewClubPostponed(player.club.code).map(({ fixtureCode, gameweek, kickoff, home, away }) => ({ fixtureCode, gameweek, kickoff, home, away })),
    categories: logCategories(FIRST_SCORING, cardPositions(player.positions)),
    lastSeason: lastSeasonOf(player),
    // His club's next matches in Football's preview, as My team's Squad tab has them.
    nextFixtures: previewClubUpcoming(player.club.code)
      .slice(0, NEXT_FIXTURES_SHOWN)
      .map(({ fixtureCode, gameweek, kickoff, home, away }) => ({ fixtureCode, gameweek, kickoff, home, away })),
    mode: previewGameMode,
  };
}

const cards = new Map(previewPlayers.map((player) => [player.code, cardOf(player)]));
/** A preview player's season on his card, by his code, for My team's Squad tab to add up (#2455):
 *  his matches, his season points as the card totals them at his first position, and his points
 *  in a gameweek, null ("—") with no match there. */
export function previewSeasonOf(playerCode: number) {
  const matches = cards.get(playerCode)?.matches ?? [];
  const pointsIn = (gameweek: number) => {
    const there = matches.filter((match) => match.gameweek === gameweek);
    return there.length === 0 ? null : there.reduce((sum, match) => sum + (pointsOf(match, 0) ?? 0), 0);
  };
  return { matches, seasonPoints: seasonFigures(matches, 0).seasonPoints, pointsIn };
}

const playerOf = (playerCode: number) => previewPlayers.find(({ code }) => code === playerCode);

/** A preview player's match in `gameweek` on his card, an override in, null where it has none (he
 *  sat it out, or it is to come): the matchup's men score it (#2478). `atFullTime` asks for it as
 *  his card will have it once over, for the matchup's replay: a match still being played or to
 *  come plays to Football's made-up result. */
export function previewCardMatchIn(playerCode: number, gameweek: number, atFullTime: boolean): PlayedMatch | null {
  const onCard = cards.get(playerCode)?.matches.find((match) => match.gameweek === gameweek) ?? null;
  const player = playerOf(playerCode);
  const match = player === undefined ? undefined : previewClubMatch(gameweek, player.club.code);
  if (!atFullTime || onCard?.provisional === false || player === undefined || match === undefined || match.score === null) return onCard;
  const [homeGoals, awayGoals] = previewFullTimeGoals(match);
  const over: GameweekMatch = { ...match, score: { state: "fullTime", homeGoals, awayGoals, minutes: 90, clockLabel: null } };
  const record = recordIn(player, gameweek, over);
  return record === null ? null : playedOf(player, gameweek, over, record);
}

/** A match's points and categories on his card at his first position, an override in, as the
 *  matchup's breakdown takes them (#2478). */
export const previewCardScore = (match: PlayedMatch) => ({ points: pointsOf(match, 0), categories: match.points[0].categories, override: match.override });
/** What a goal is worth on his card's match at his first position: his goals' points over his
 *  goals, null with none there. The matchup's Vidiprinter prices his goal lines at it (#2478). */
export function previewCardGoalWorth(match: PlayedMatch | null): number | null {
  const goals = match?.points[0].categories.find(({ stat }) => stat === GOALS);
  return goals === undefined || goals.points === null || goals.why.actions === 0 ? null : goals.points / goals.why.actions;
}
/** A record's base points at a preview player's first position, as his card prices it, with no
 *  override: the matchup's replay prices his record so far with it (#2478). */
export function previewCardPriced(playerCode: number, record: MatchStats | null) {
  const { total, categories } = pricedAt(playerOf(playerCode)!, record)[0];
  return { points: total, categories, override: null };
}

/** His rank at a position among the preview's players holding it, by their cards' base points
 *  there, placed by the server's own rule (positionRank.ts). */
function rankOf(playerCode: number, position: SlotPosition): PositionRank {
  const holding = [...cards.values()].filter((card) => card.pricedAt.includes(position));
  const points = holding.map((card) => ({ code: card.code, points: seasonFigures(card.matches, card.pricedAt.indexOf(position)).seasonPoints }));
  return { place: rankOfPlayer(points, playerCode), of: holding.length };
}

/** The preview saves nothing: an override is taken and forgotten, and a drop, a claim or a pickup
 *  says so. */
const overrideNothing = previewDone;
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
  const player = playerOf(playerCode);
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
