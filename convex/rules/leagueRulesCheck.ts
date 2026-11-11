import { STARTER_COUNT, type AreaLimit } from "../lineup/lineup";
import { AREAS, type Area } from "../lineup/pitch";
import { inClassicFormationShape } from "../lineup/classics";
import { pairRefusal, SIDES, type Instruction } from "../lineup/instructions";
import { offersRole } from "../lineup/roles";
import { instructionsOf } from "./firstRules";
import type { DraftRules, LeagueRules, TradeRules } from "./leagueRulesShape";
import { FIRST_GAMEWEEK } from "../gameweeks/usedGameweeks";
import { PICK_SECONDS_FEWEST, PICK_SECONDS_MOST, TIMEOUTS_FEWEST, TIMEOUTS_MOST } from "../draft/draftLimits";
import { MOST_IN_SQUAD, PREMIER_LEAGUE_CLUBS } from "../leagues/leagueLimits";
import { roundsInARoundRobin } from "../table/roundRobin";

// What makes a league's rules sound beyond their stored shape (spec/03; #25): each check throws an
// UnsoundRules carrying the reason a commissioner is told. The shape (a known format, a number
// where one belongs) is leagueRulesShape.ts's, checked by Convex before this runs. The limits the
// rules are checked against are the platform's (leagueLimits.ts), never a rule. Pure: no I/O.

/** Why rules can't be saved, told apart from a bug, which is never shown as a reason. */
export class UnsoundRules extends Error {}

/** Throws the first reason these rules can't be saved, in a season of `seasonGameweeks` gameweeks
 *  (seasonGameweeks.ts's `seasonGameweekCount`). Given the league's maximum teams, also that that
 *  many can play its games a gameweek. */
export function checkLeagueRules(rules: LeagueRules, seasonGameweeks: number, maxTeams?: number): void {
  checkSquad(rules.squad);
  checkAreaLimits(rules.areaLimits);
  checkPresets(rules.presets, rules.areaLimits);
  checkInstructions(instructionsOf(rules), rules.presets);
  if (rules.classics !== undefined) checkClassicFormations(rules.classics, rules.presets, instructionsOf(rules));
  checkWholeNumber(rules.deadline.minutesBeforeFirstKickoff, "The deadline's minutes before the first kickoff", 0);
  checkNoneTwice(rules.tieBreaks, (tieBreak) => `The tie-break ${tieBreak} is listed twice.`);
  checkWholeNumber(rules.gamesPerGameweek, "The head-to-head games each team plays a gameweek", 1);
  if (maxTeams !== undefined) checkGamesFor(rules.gamesPerGameweek, maxTeams);
  checkWaivers(rules.waivers);
  if (rules.draft !== undefined) checkDraft(rules.draft);
  if (rules.trades !== undefined) checkTrades(rules.trades, seasonGameweeks);
}

/** A trade deadline, if any, is a gameweek of the season. */
function checkTrades({ deadline }: TradeRules, seasonGameweeks: number): void {
  if (deadline !== null) checkWholeNumberWithin(deadline, "The trade deadline's gameweek", FIRST_GAMEWEEK, seasonGameweeks);
}

/** The pick clock and timeouts within Craig's limits (../draft/draftLimits.ts). */
function checkDraft({ pickSeconds, timeoutsBeforeAutoPick }: DraftRules): void {
  checkWholeNumberWithin(pickSeconds, "The pick clock's seconds", PICK_SECONDS_FEWEST, PICK_SECONDS_MOST);
  if (timeoutsBeforeAutoPick !== null) {
    checkWholeNumberWithin(timeoutsBeforeAutoPick, "The timeouts before auto-pick", TIMEOUTS_FEWEST, TIMEOUTS_MOST);
  }
}

function checkWholeNumberWithin(value: number, what: string, least: number, most: number): void {
  if (!Number.isInteger(value) || value < least || value > most) {
    throw new UnsoundRules(`${what} must be a whole number from ${least} to ${most}, not ${value}.`);
  }
}

export const gamesWords = (games: number) => (games === 1 ? "1 game" : `${games} games`);

/** Why `maxTeams` teams play at most so many games a gameweek: one against each other team, and
 *  with an odd number, one more for the team left over, against the league's average or a bye. */
export function whyMostGames(maxTeams: number): string {
  const others = maxTeams - 1;
  const eachOther = others === 1 ? "one against the other team" : `one against each of the other ${others}`;
  return maxTeams % 2 === 0 ? eachOther : `${eachOther}, and one left over, against the league's average or a bye`;
}

/** A league asking more games a gameweek than `maxTeams` teams have rounds for would quietly play
 *  fewer (roundRobin.ts): refused instead, naming the most (Craig, 22 Oct 2026). */
export function checkGamesFor(games: number, maxTeams: number): void {
  const most = roundsInARoundRobin(maxTeams);
  if (games > most) {
    throw new UnsoundRules(
      `With ${maxTeams} teams, a team can play at most ${gamesWords(most)} a gameweek, not ${games}: ${whyMostGames(maxTeams)}.`,
    );
  }
}

function checkWholeNumber(value: number, what: string, least: number): void {
  if (!Number.isInteger(value) || value < least) {
    throw new UnsoundRules(`${what} must be a whole number, ${least} or more, not ${value}.`);
  }
}

function checkLimit({ minimum, maximum }: AreaLimit, what: string): void {
  checkWholeNumber(minimum, `${what}'s minimum`, 0);
  checkWholeNumber(maximum, `${what}'s maximum`, 0);
  if (minimum > maximum) throw new UnsoundRules(`${what}'s minimum, ${minimum}, is above its maximum, ${maximum}.`);
}

const sumOf = (limits: Record<Area, AreaLimit>, end: keyof AreaLimit) =>
  AREAS.reduce((total, area) => total + limits[area][end], 0);

function checkAreaLimits(limits: Record<Area, AreaLimit>): void {
  for (const area of AREAS) checkLimit(limits[area], `On the pitch, ${area}`);
  const minimums = sumOf(limits, "minimum");
  const maximums = sumOf(limits, "maximum");
  if (minimums > STARTER_COUNT) {
    throw new UnsoundRules(`The areas' minimums on the pitch add up to ${minimums}, more than the ${STARTER_COUNT} who start.`);
  }
  if (maximums < STARTER_COUNT) {
    throw new UnsoundRules(`The areas' maximums on the pitch add up to ${maximums}, fewer than the ${STARTER_COUNT} who start.`);
  }
}

function checkSquad({ size, minimumByArea, maxPerClub }: LeagueRules["squad"]): void {
  if (size !== null) {
    checkLimit(size, "The squad size");
    if (size.maximum < STARTER_COUNT) {
      throw new UnsoundRules(`The squad's maximum, ${size.maximum}, can't field the ${STARTER_COUNT} who start.`);
    }
    if (size.maximum > MOST_IN_SQUAD) {
      throw new UnsoundRules(`The squad's maximum, ${size.maximum}, is above ${MOST_IN_SQUAD}, a Premier League squad.`);
    }
  }
  if (minimumByArea !== null) {
    for (const area of AREAS) checkWholeNumber(minimumByArea[area], `The squad's minimum in ${area}`, 0);
    const minimums = AREAS.reduce((total, area) => total + minimumByArea[area], 0);
    if (size !== null && minimums > size.maximum) {
      throw new UnsoundRules(`The squad's minimums by area add up to ${minimums}, more than its maximum size, ${size.maximum}.`);
    }
  }
  if (maxPerClub !== null) {
    checkWholeNumber(maxPerClub, "The most players from one club", 1);
    // A squad the club maximum can't fill would freeze its draft at the pick with no legal player
    // left: refused when saved, as a squad above 25 is (Craig, 11 Nov 2026, on #1462).
    const room = maxPerClub * PREMIER_LEAGUE_CLUBS;
    if (size !== null && size.maximum > room) {
      throw new UnsoundRules(
        `The squad's maximum, ${size.maximum}, is more than ${maxPerClub} from each of the ${PREMIER_LEAGUE_CLUBS} clubs can fill, ${room}.`,
      );
    }
  }
}

function checkPresets(presets: LeagueRules["presets"], limits: Record<Area, AreaLimit>): void {
  checkNoneTwice(
    presets.map((preset) => preset.name.trim()),
    (name) => `Two presets are called "${name}".`,
  );
  for (const { name, cells, backLine } of presets) {
    if (name.trim() === "") throw new UnsoundRules("A preset needs a name.");
    // Whole points, as every instruction and role scores (spec/05).
    if (backLine !== undefined && backLine !== null) {
      checkWholeNumber(backLine.cleanSheet, `The preset ${name}'s clean sheet`, 0);
      if (!Number.isInteger(backLine.goalConceded) || backLine.goalConceded > 0) {
        throw new UnsoundRules(`The preset ${name}'s goal conceded must be a whole number, 0 or less, not ${backLine.goalConceded}.`);
      }
    }
    if (cells.length !== STARTER_COUNT) {
      throw new UnsoundRules(`The preset ${name} places ${cells.length} players, not the ${STARTER_COUNT} who start.`);
    }
    checkNoneTwice(
      cells.map((cell) => `${cell.area} ${cell.lane}`),
      (cell) => `The preset ${name} puts two players in ${cell}.`,
    );
    for (const area of AREAS) {
      const standing = cells.filter((cell) => cell.area === area).length;
      const { minimum, maximum } = limits[area];
      if (standing < minimum || standing > maximum) {
        throw new UnsoundRules(`The preset ${name} puts ${standing} in ${area}, outside its limits of ${minimum} to ${maximum}.`);
      }
    }
  }
}

/** A team picks one of each side (spec/05), so each side needs one; each preset's default pair names
 *  one of each side its own shape offers ("Each formation has a default attacking and a default
 *  defensive instruction"). */
function checkInstructions(set: readonly Instruction[], presets: LeagueRules["presets"]): void {
  checkNoneTwice(
    set.map(({ key }) => key),
    (key) => `Two team instructions have the key "${key}".`,
  );
  for (const { key, name } of set) if (name.trim() === "") throw new UnsoundRules(`The team instruction ${key} needs a name.`);
  for (const side of SIDES) {
    if (!set.some((instruction) => instruction.side === side)) throw new UnsoundRules(`The team instructions need at least one ${side} instruction.`);
  }
  for (const { name, cells, instructions } of presets) {
    if (instructions === undefined) continue;
    const refusal = pairRefusal(instructions, cells, set);
    if (refusal !== null) throw new UnsoundRules(`The preset ${name}'s default ${refusal.side} instruction, ${refusal.key}, isn't one its shape offers.`);
  }
}

/** Each classic formation named once, standing in one of the league's presets (Craig, 6 Nov 2026:
 *  "Yes, one of ours"), with a role its slot offers in it and one instruction a side its shape
 *  offers (spec/05). */
function checkClassicFormations(classicFormations: NonNullable<LeagueRules["classics"]>, presets: LeagueRules["presets"], set: readonly Instruction[]): void {
  checkNoneTwice(
    classicFormations.map((classicFormation) => classicFormation.name.trim()),
    (name) => `Two classic formations are called "${name}".`,
  );
  for (const classicFormation of classicFormations) {
    const { name, cells, instructions } = classicFormation;
    if (name.trim() === "") throw new UnsoundRules("A classic formation needs a name.");
    if (!presets.some((preset) => inClassicFormationShape(preset.cells, classicFormation))) {
      throw new UnsoundRules(`The classic formation ${name} stands in no formation of the league's.`);
    }
    for (const cell of cells) {
      if (!offersRole(cell, cell.role, cells)) throw new UnsoundRules(`The classic formation ${name} gives its ${cell.area} ${cell.lane} slot the role ${cell.role}, which that slot doesn't offer.`);
    }
    const refusal = pairRefusal(instructions, cells, set);
    if (refusal !== null) throw new UnsoundRules(`The classic formation ${name}'s ${refusal.side} instruction, ${refusal.key}, isn't one its shape offers.`);
  }
}

const LAST_HOUR = 23;
const LAST_MINUTE = 59;

function checkWaivers({ runs }: LeagueRules["waivers"]): void {
  if (runs.length === 0) throw new UnsoundRules("Waivers need a time to run, once a week or more.");
  for (const { hour, minute } of runs) {
    checkWholeNumberWithin(hour, "A waiver run's hour", 0, LAST_HOUR);
    checkWholeNumberWithin(minute, "A waiver run's minute", 0, LAST_MINUTE);
  }
  checkNoneTwice(
    runs.map(({ day, hour, minute }) => `${day} at ${hour}:${String(minute).padStart(2, "0")}`),
    (run) => `Waivers run on ${run} twice.`,
  );
}

function checkNoneTwice(values: readonly string[], reason: (value: string) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new UnsoundRules(reason(value));
    seen.add(value);
  }
}
