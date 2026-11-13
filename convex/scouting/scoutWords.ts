import type { Words } from "../mail/letterShape";
import type { GameMode } from "../rules/gameMode";
import { NO_DATA, UNSURE, type Stars } from "../stars/starsShape";

// What scouts say (spec/19, Scouts and The report; #375), in one place for Craig to change: the
// refusals, the Mail letters (a report is in, and nothing more; or the player left first), and the
// brief Claude writes the report from.

export const scoutRefusals = {
  allOut: (scouts: number) =>
    scouts === 0 ? "Your team has no scouts." : `All ${scouts} of your scouts are out. One is free again when his report is in.`,
  alreadyOut: (name: string) => `One of your scouts is already watching ${name}.`,
  playerGone: (name: string) => `${name} has left the Premier League, so he can't be scouted.`,
};

/** To the manager, once a scout's report is written: that it is in, and nothing more (spec/19). */
export function reportInLetter(playerName: string): Words {
  return { subject: `Your scout's report on ${playerName} is in`, body: `Your scout is back from watching ${playerName}. His report is in.` };
}

/** To the manager, when the player left the Premier League while a scout was out on him: the scout
 *  is back with no report, and free again (Craig, 6 Nov 2026, on #375). */
export function playerLeftLetter(playerName: string): Words {
  return {
    subject: `Your scout is back from ${playerName} with no report`,
    body: `${playerName} has left the Premier League, so your scout came back with no report. He is free to send again.`,
  };
}

/** To the manager, when a day of tries couldn't write the report: the scout is back with none,
 *  and free again (Craig, 12 Nov 2026, on #1437). */
export function notFiledLetter(playerName: string): Words {
  return {
    subject: `Your scout couldn't file a report on ${playerName}`,
    body: `Your scout couldn't file a report on ${playerName}; send a scout again.`,
  };
}

/** One starter's slot in the brief: its position and role. */
interface BriefSlot {
  position: string;
  role: string;
}

/** What the report is written from: the player's own figures, and the team's shape. */
export interface ScoutBrief {
  playerName: string;
  clubName: string;
  positions: readonly string[];
  news: string | null;
  /** FPL's chance he plays next round, in percent; null while it has no doubt. */
  chanceOfPlaying: number | null;
  /** His stars for each role in each area he plays (spec/05). */
  stars: readonly { area: string; role: string; stars: Stars }[];
  /** The team's starters as its lineup stands: each slot's position and role. Empty with none. */
  shape: readonly BriefSlot[];
  /** This season's matches he was in, newest first, with his base points at each position. */
  matches: readonly { opponent: string; home: boolean; minutes: number | null; points: readonly { position: string | null; total: number | null }[] }[];
  /** His club's next matches, soonest first. */
  fixtures: readonly { opponent: string; home: boolean; gameweek: number | null }[];
}

/** The longest report Claude may write, in tokens: room for a few sentences. */
export const REPORT_MAX_TOKENS = 400;

/** How Claude is told to write a report: spec/19's four judgements, a few plain sentences. */
export const REPORT_SYSTEM = [
  "You are a football scout reporting to the manager of a team in a Premier League fantasy draft league.",
  "Write a few plain sentences in UK English, no more than five, with no headings, lists or markdown.",
  "Judge four things: his fit with the manager's formation and roles under the site's scoring (his role stars say how well each role suits him); his form trend; his job security, meaning whether he will keep starting; and his fixtures ahead.",
  "Use only the facts given. Where a fact is missing, say so briefly rather than guess.",
].join(" ");

const starsWords = (stars: Stars) => (stars === NO_DATA ? "no matches yet" : stars === UNSURE ? "too few matches to rate" : `${stars} stars`);
const venue = (home: boolean) => (home ? "home" : "away");

/** The facts a report is written from, as plain lines for Claude, in a league that plays `mode`:
 *  its role stars only where the league shows stars, and its slots' roles only where it scores them
 *  (gameMode.ts, #1582; every league does both today). */
export function reportPrompt(brief: ScoutBrief, mode: Pick<GameMode, "showsStars" | "scoresRoles">): string {
  const slotWords = (slot: BriefSlot) => (mode.scoresRoles ? `${slot.position} as ${slot.role}` : slot.position);
  const lines = [
    `Player: ${brief.playerName}, ${brief.clubName}. Positions: ${brief.positions.join(", ") || "none yet"}.`,
    `News: ${brief.news ?? "none"}.${brief.chanceOfPlaying === null ? "" : ` Chance of playing next round: ${brief.chanceOfPlaying}%.`}`,
    ...(mode.showsStars ? ["Role stars: " + (brief.stars.map((each) => `${each.role} (${each.area}) ${starsWords(each.stars)}`).join("; ") || "none") + "."] : []),
    "Manager's formation: " + (brief.shape.length === 0 ? "no lineup set yet" : brief.shape.map(slotWords).join(", ")) + ".",
    "This season's matches, newest first:",
    ...(brief.matches.length === 0
      ? ["none"]
      : brief.matches.map((match) => {
          const points = match.points.map((each) => `${each.total ?? "not yet scored"}${each.position === null ? "" : ` at ${each.position}`}`).join(", ");
          return `- v ${match.opponent} (${venue(match.home)}): ${match.minutes ?? "unknown"} minutes, ${points || "no points"}`;
        })),
    "Fixtures ahead:",
    ...(brief.fixtures.length === 0
      ? ["none known"]
      : brief.fixtures.map((fixture) => `- ${fixture.gameweek === null ? "unscheduled" : `GW${fixture.gameweek}`}: ${fixture.opponent} (${venue(fixture.home)})`)),
  ];
  return lines.join("\n");
}
