// What the player card says, in one place for Craig to change in the pull request.

import type { CategoryWhy, Cut, PricedBy, SlotValue } from "../../convex/scoring/scoring";
import { seasonShortWords } from "../draft/words";
import { afterLastMatchWords, type FirstRun } from "../myTeam/claims/words";
import { LAST_MATCHES_SHOWN } from "./gameLog";
import { AREA_WORDS, figureWords, gameweekShort, gameweekWords, signedWords, versusWords, whenWords } from "../shared/words";

export { figureWords, noFigureWords } from "../shared/words";

export const backWords = "Back";
export const loadingWords = "Loading the player…";
export const noSuchPlayerWords = "No player with that code is held: the link may be wrong.";
export const goneWords = "No longer in the Premier League.";

/** The card's head (the approved picture): his name, his positions, club and owner, his figures
 *  beside them, and his actions. */
export const PLAYER_TITLE = "Player";
export const noPositionsWords = "No position yet";
export const ownedByWords = "Owned by";
export const chanceWords = (percent: number) => `${percent}% chance of playing next round`;
/** His figures beside his name, at the position the switch is on (spec/12 S12.1; #1027). */
export const figureLabels = { seasonPoints: "Base points", aMatch: "A match", minutes: "Minutes", lastFive: `Last ${LAST_MATCHES_SHOWN}` } as const;
/** His rank among every player holding the position the switch is on (Craig, 9 Nov 2026, on
 *  #1027): "Rank at CAM", "4th of 38". */
export const rankLabel = (position: string | null) => (position === null ? "Rank" : `Rank at ${position}`);
export const rankOfWords = (of: number) => `of ${figureWords(of)}`;
export { placeWords } from "../shared/words";
/** The placeholders the card keeps in their places until their data comes (the README's table). */
export const portraitLabel = "His portrait: waiting on FPL's terms for its photos";
/** Opens Trades' New offer with his owner chosen and him asked for (Craig, 9 Nov 2026, on #1027). */
export const offerTradeWords = "Offer a trade";

/** The left column: FPL's news on him, his news notes, and his role fit. */
export const NEWS_TITLE = "News";
export const noNewsWords = "No news on him.";
export const newsNotesLabel = "His news notes: the news job isn't built yet";
export const ROLE_FIT_TITLE = "Role fit";
export const roleFitLabel = "Role fit: comes with scouts";
/** Under the game log: the club captain hint (spec/17 `S17.7`, after the mini beta). Set-piece
 *  hints are dropped (`S05.24`). */
export const CAPTAIN_TITLE = "Captain";
export const captainLabel = "Club captain";
export const hintNotHeldLabel = (what: string) => `${what}: comes after the mini beta`;

/** This season's matches, as a game log. */
export const SEASON_TITLE = "This season";
export const noMatchesWords = "He hasn't played a match this season.";
/** The switch over the matches: which of his positions they are priced at. */
export const pricedAtLabel = "Points at";
/** The game log's switch: the categories that score at his position, or every stat we hold. */
export const logViewLabel = "Columns";
export const logViews = { scoring: "Scoring", all: "All stats" } as const;
/** Beside points that may still move ("Live", as on My team's fixtures): the match isn't final, or
 *  his team's auto-subs aren't (spec/12). */
export { liveWords, provisionalWords } from "../shared/words";
export const columns = {
  gameweek: { short: "GW", long: "Gameweek" },
  opponent: { short: "Opp", long: "Opponent, at home (H) or away (A)" },
  score: { short: "Score", long: "The match's score, home side first" },
  minutes: { short: "Min", long: "Minutes played" },
  points: { short: "Pts", long: "Points under the site's scoring" },
} as const;
export const notArrivedWords = "His record for this match hasn't fully arrived yet.";
/** A match his club's postponement took out, kept as its row. */
export const postponedWords = "Postponed";
/** Before a match's points, the league's override, its reason on hover. */
export const overriddenWasWords = (was: number | null) => (was === null ? "Overridden" : `Overridden, was ${figureWords(was)}`);
/** The selected match's breakdown, at the top of the right column: "GW8, LIV (A) 2–1". */
export const matchTitle = (gameweek: number | null, opponent: string, score: string | null) =>
  `${gameweek === null ? "" : `${gameweekShort(gameweek)}, `}${opponent}${score === null ? "" : ` ${score}`}`;
/** The lines in a match's breakdown: each category he earned or lost points in, as "Goals scored
 *  5", and why. */
export const breakdownLabel = (gameweek: number | null) => (gameweek === null ? "Points by category" : `${gameweekWords(gameweek)} points by category`);
export const nothingEarnedWords = "No category earned him points.";
/** Why a category's points are what they are (spec/14, On screen), in brackets after them: "(1 at
 *  5 each for Midfield)", "(4, 1 for every 3)", "(14, 2 for 10+ and 2 for 12+, held to at most 2)",
 *  "(1 at 4 each for Defence, but none under 60 minutes)", "(2 at 1 each, reaching its limit of at
 *  most 2)": the last cost him nothing (#863). */
export const whyWords = ({ actions, value, pricedBy, cut }: CategoryWhy) => `(${valueWords(value, actions)}${pricedByWords(pricedBy)}${cutWords(cut)})`;
const valueWords = (value: SlotValue, actions: number) => {
  switch (value.shape) {
    case "perAction":
      return `${figureWords(actions)} at ${figureWords(value.points)} each`;
    case "perCount":
      return `${figureWords(actions)}, ${figureWords(value.points)} for every ${figureWords(value.every)}`;
    case "bands":
      return `${figureWords(actions)}, ${value.earned.length === 0 ? "no band reached" : value.earned.map(({ atLeast, points }) => `${figureWords(points)} for ${figureWords(atLeast)}+`).join(" and ")}`;
  }
};
const pricedByWords = (pricedBy: PricedBy) => {
  switch (pricedBy.by) {
    case "all":
      return "";
    case "area":
      return ` for ${AREA_WORDS[pricedBy.area]}`;
    case "position":
      return ` for ${pricedBy.position}`;
    case "formation":
      return ` for a ${pricedBy.formation}`;
  }
};
const cutWords = (cut: Cut | null) => {
  if (cut === null) return "";
  switch (cut.by) {
    case "minutes":
      return `, but none under ${figureWords(cut.atLeast)} minutes`;
    case "max":
      return `, held to at most ${figureWords(cut.limit)}`;
    case "min":
      return `, held to at least ${figureWords(cut.limit)}`;
    case "atMax":
      return `, reaching its limit of at most ${figureWords(cut.limit)}`;
    case "atMin":
      return `, reaching its limit of at least ${figureWords(cut.limit)}`;
  }
};
/** The breakdown's last line: the version of the site's scoring the match was scored under. */
export const scoredUnderWords = (version: string | null) => `Scored under ${version === null ? "the first scoring set" : `version ${version}`}`;

/** Last season's one line under the game log (spec/12; Craig, 6 Nov 2026): "25/26: 34 apps, 2810
 *  min, 212 pts". */
export const LAST_SEASON_TITLE = "Last season, under today's scoring";
export const lastSeasonWords = (season: number, { appearances, minutes, points }: { appearances: number; minutes: number; points: number }) =>
  `${seasonShortWords(season)}: ${figureWords(appearances)} apps, ${figureWords(minutes)} min, ${figureWords(points)} pts`;
export const notInLastSeasonWords = "Not in the Premier League last season.";
export const lastSeasonNotHeldWords = "Last season isn't held yet.";

/** His club's next fixtures, in a single row (Craig, 7 Nov 2026). */
export const nextFixturesTitle = (club: string) => `${club}'s next fixtures`;
export { difficultyNotRatedWords, nextFixtureShort, statusNotSettledLabel } from "../shared/words";
export const noFixturesWords = "No fixtures ahead with a date.";

/** A commissioner's override of his points in a match (#32, spec/14). */
export const overriddenWords = (points: number, reason: string) => `Overridden to ${figureWords(points)} in this league: ${reason}`;
export const OVERRIDE_TITLE = "Override points";
export const overrideHint = "The whole league gets a letter saying what changed and why.";
export const overrideLabels = { match: "Match", points: "Points", reason: "Why" } as const;
export const overrideMatchWords = (gameweek: number | null, home: string, away: string) =>
  `${gameweek === null ? "" : `${gameweekWords(gameweek)}: `}${home} ${versusWords} ${away}`;
export const overrideWords = "Override";
export const cancelOverrideWords = "Cancel";
export const overriddenDoneWords = "Overridden: the league has a letter saying why.";
export const overrideFailedWords = "The override couldn't be saved. Try again.";
/** Taking the override off the match picked (#903, spec/14 S14.5): "remove override button". */
export const removeOverrideWords = "Remove override";
export const overrideRemovedWords = "Override removed: his scored points are back, and the league has a letter.";
export const removeOverrideFailedWords = "The override couldn't be removed. Try again.";

/** The card's waiver action (#1200, spec/08): the words stay waivers, claim, drop and free agent. */
export const dropWords = "Drop";
export const confirmDropWords = (name: string) => `Drop ${name}?`;
export const keepWords = "Keep him";
export const claimWords = "Claim";
export const pickUpWords = "Pick up";
/** With a claim or a pickup, who he names to go (spec/08). */
export const whoGoesLabel = "Who goes";
export const dropNobodyWords = "Nobody";
/** The run that can first take him (Craig, 6 Nov 2026, on #1200: "Show the run's day and time"). */
export const onWaiversUntilWords = (firstRun: FirstRun) =>
  firstRun === null ? "On waivers" : `On waivers: first run ${firstRun.skippedIf !== null ? afterLastMatchWords(firstRun.skippedIf) : whenWords(firstRun.at)}`;
export const claimedDoneWords = "Claim put in, last of your claims.";
export const waiverFailedWords = "That couldn't be done. Try again.";

/** A role's adjustment, signed: "+2", "−1", "0". */
export const adjustmentWords = signedWords;
/** What made his role's points, each side that moved him with its stats (Craig, 5 Nov 2026): "+2:
 *  1 goal in box, 1 shot on target in box; −1: 1 big chance missed". */
export const roleMadeOfWords = (sides: readonly { points: number; lines: readonly { name: string; actions: number }[] }[]) =>
  sides.map(({ points, lines }) => `${signedWords(points)}: ${lines.map(({ name, actions }) => `${actions} ${name.toLowerCase()}`).join(", ")}`).join("; ");
/** The role line's name for screen readers: "Role adjustment, Attacking full-back". */
export const roleLineLabel = (name: string) => `Role adjustment, ${name}`;
