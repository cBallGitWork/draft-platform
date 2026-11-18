import type { Words } from "../mail/letterShape";
import { LOCALE } from "../shared/moments";

// What Mail says of an award (spec/09, Awards; #2677), in one place for Craig to change.

const MONTH_WORDS = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "long", year: "numeric" });
const MONTH_SHORT = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short" });

const startOf = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return Date.UTC(year, number - 1, 1);
};

/** A month kept as "2026-10", as a person reads it: "October 2026". */
export const monthWords = (month: string) => MONTH_WORDS.format(startOf(month));

/** A month kept as "2026-10", short, as a team's page lists its awards: "Oct" (S09.8). */
export const monthShort = (month: string) => MONTH_SHORT.format(startOf(month));

/** Mail's letter telling the whole league its Manager of the Month ("Most points", S09.5). */
export function managerOfTheMonthLetter(teamName: string, month: string, points: number): Words {
  const named = monthWords(month);
  return {
    subject: `${teamName} is Manager of the Month for ${named}`,
    body: `${teamName} scored the most points over the gameweeks that started in ${named}: ${points}.`,
  };
}
