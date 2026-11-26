import type { Words } from "../mail/letterShape";
import { LOCALE } from "../shared/moments";

// What Mail says of an award (spec/09, Awards; #2677), in one place for Craig to change.

const MONTH_WORDS = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "long", year: "numeric" });

/** A month kept as "2026-10", as its first moment on UTC, to format on UTC. */
export function monthStart(month: string): number {
  const [year, number] = month.split("-").map(Number);
  return Date.UTC(year, number - 1, 1);
}

/** A month kept as "2026-10", as a person reads it: "October 2026". */
export const monthWords = (month: string) => MONTH_WORDS.format(monthStart(month));

/** Mail's letter telling the whole league its Manager of the Month ("Most points", S09.5). */
export function managerOfTheMonthLetter(teamName: string, month: string, points: number): Words {
  const named = monthWords(month);
  return {
    subject: `${teamName} is Manager of the Month for ${named}`,
    body: `${teamName} scored the most points over the gameweeks that started in ${named}: ${points}.`,
  };
}

const NAMES_LIST = new Intl.ListFormat(LOCALE, { type: "conjunction" });

/** Mail's letter telling the whole league its Player of the Season ("Most points", S09.5): each
 *  player who shares it named, with the points and games they won it on. */
export function playerOfTheSeasonLetter(names: readonly string[], points: number, games: number): Words {
  const named = NAMES_LIST.format(names);
  return {
    subject: names.length === 1 ? `${named} is Player of the Season` : `${named} share Player of the Season`,
    body: `${named} scored the most points over the league's gameweeks: ${points}, in ${games} games.`,
  };
}
