import { STARTER_COUNT, type AreaLimit } from "./lineup";
import { AREAS, type Area } from "./pitch";
import type { LeagueRules } from "./leagueRulesShape";
import { validateScoringSet } from "./scoringSet";

// What makes a league's rules sound beyond their stored shape (spec/03; #25): each check throws
// an UnsoundRules carrying the reason a commissioner is told. The shape (a known format, a number where one belongs) is
// leagueRulesShape.ts's, checked by Convex before this runs. Pure: no I/O.

/** Why rules can't be saved, told apart from a bug, which is never shown as a reason. */
export class UnsoundRules extends Error {}

/** Throws the first reason these rules can't be saved. */
export function checkLeagueRules(rules: LeagueRules): void {
  checkSquad(rules.squad);
  checkAreaLimits(rules.areaLimits);
  checkPresets(rules.presets, rules.areaLimits);
  checkWholeNumber(rules.deadline.minutesBeforeFirstKickoff, "The deadline's minutes before the first kickoff", 0);
  checkNoneTwice(rules.tieBreaks, (tieBreak) => `The tie-break ${tieBreak} is listed twice.`);
  checkWaivers(rules.waivers);
  try {
    validateScoringSet(rules.scoring);
  } catch (error) {
    throw new UnsoundRules(`The scoring set can't be saved: ${(error as Error).message}.`);
  }
}

function checkWholeNumber(value: number, what: string, least: number): void {
  if (!Number.isInteger(value) || value < least) throw new UnsoundRules(`${what} must be a whole number, ${least} or more, not ${value}.`);
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

function checkSquad({ size, byArea, maxPerClub }: LeagueRules["squad"]): void {
  if (size !== null) {
    checkLimit(size, "The squad size");
    if (size.maximum < STARTER_COUNT) {
      throw new UnsoundRules(`The squad's maximum, ${size.maximum}, can't field the ${STARTER_COUNT} who start.`);
    }
  }
  if (byArea !== null) {
    for (const area of AREAS) checkLimit(byArea[area], `In the squad, ${area}`);
    const minimums = sumOf(byArea, "minimum");
    if (size !== null && minimums > size.maximum) {
      throw new UnsoundRules(`The squad's minimums by area add up to ${minimums}, more than its maximum size, ${size.maximum}.`);
    }
  }
  if (maxPerClub !== null) checkWholeNumber(maxPerClub, "The most players from one club", 1);
}

function checkPresets(presets: LeagueRules["presets"], limits: Record<Area, AreaLimit>): void {
  checkNoneTwice(
    presets.map((preset) => preset.name.trim()),
    (name) => `Two presets are called "${name}".`,
  );
  for (const { name, cells } of presets) {
    if (name.trim() === "") throw new UnsoundRules("A preset needs a name.");
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

const LAST_HOUR = 23;
const LAST_MINUTE = 59;

function checkWaivers({ runs }: LeagueRules["waivers"]): void {
  if (runs.length === 0) throw new UnsoundRules("Waivers need a time to run, once a week or more.");
  for (const { hour, minute } of runs) {
    if (!Number.isInteger(hour) || hour < 0 || hour > LAST_HOUR) {
      throw new UnsoundRules(`A waiver run's hour is a whole number from 0 to ${LAST_HOUR}, not ${hour}.`);
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > LAST_MINUTE) {
      throw new UnsoundRules(`A waiver run's minute is a whole number from 0 to ${LAST_MINUTE}, not ${minute}.`);
    }
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
