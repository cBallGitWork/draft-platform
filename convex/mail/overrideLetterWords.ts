import type { Infer } from "convex/values";
import { figureWords } from "../shared/numberWords";
import type { leagueEvent } from "../schema";

// What a score override's Mail letters say (spec/14, Changes and corrections; #32, #903): split
// from letterWords.ts, which writes the rest and calls this for an override's letter.

type LeagueEvent = Infer<typeof leagueEvent>;
type OverrideEvent = Extract<LeagueEvent, { kind: "pointsOverridden" | "pointsOverrideRemoved" | "teamPointsOverridden" }>;
type Words = { subject: string; body: string };

/** The letter an override, or its removal, files to the whole league, naming `who` did it. */
export function overrideLetterWords(event: OverrideEvent, who: string): Words {
  switch (event.kind) {
    case "pointsOverridden":
      return { subject: `${event.playerName}'s points in ${event.matchName} were overridden`, body: overriddenBody(event, who) };
    case "pointsOverrideRemoved":
      return { subject: `${event.playerName}'s override in ${event.matchName} was removed`, body: overrideRemovedBody(event, who) };
    case "teamPointsOverridden":
      return teamOverriddenWords(event, who);
  }
}

/** "Ann overrode Saka's points in Arsenal v Chelsea, gameweek 6: 2 to 8. Why: a goal the feed
 *  gave to Rice. / Lions now have 61 in gameweek 6, not 55." */
function overriddenBody(event: Extract<LeagueEvent, { kind: "pointsOverridden" }>, who: string): string {
  const { playerName, matchName, gameweek, from, to, reason, teams } = event;
  const change = from === null ? `now ${figureWords(to)}` : `${figureWords(from)} to ${figureWords(to)}`;
  return `${who} overrode ${playerName}'s points in ${matchName}, gameweek ${gameweek}: ${change}. Why: ${reason}\n\n${movedTotals(teams, gameweek)}`;
}

/** "Ann removed the override of Saka's points in Arsenal v Chelsea, gameweek 6: 8 to 2, as
 *  scored. / Lions now have 55 in gameweek 6, not 61." */
function overrideRemovedBody(event: Extract<LeagueEvent, { kind: "pointsOverrideRemoved" }>, who: string): string {
  const { playerName, matchName, gameweek, from, to, teams } = event;
  const change = to === null ? `${figureWords(from)} no longer stands` : `${figureWords(from)} to ${figureWords(to)}, as scored`;
  return `${who} removed the override of ${playerName}'s points in ${matchName}, gameweek ${gameweek}: ${change}.\n\n${movedTotals(teams, gameweek)}`;
}

/** Each team whose gameweek total a player's override moved, or that none did. */
function movedTotals(teams: readonly { teamName: string; from: number; to: number }[], gameweek: number): string {
  return teams.length === 0
    ? "No team's total moved: no lineup counted him."
    : teams.map((team) => `${team.teamName} now have ${figureWords(team.to)} in gameweek ${gameweek}, not ${figureWords(team.from)}.`).join("\n");
}

/** "Ann overrode Lions' total in gameweek 6: 54 to 60. Why: ..." or, on its removal, "Ann
 *  removed the override of Lions' total in gameweek 6: 60 to 54, as scored." */
function teamOverriddenWords({ teamName, gameweek, from, to, reason }: Extract<LeagueEvent, { kind: "teamPointsOverridden" }>, who: string): Words {
  const change = `${figureWords(from)} to ${figureWords(to)}`;
  return reason === null
    ? {
        subject: `${teamName}'s override in gameweek ${gameweek} was removed`,
        body: `${who} removed the override of ${teamName}'s total in gameweek ${gameweek}: ${change}, as scored.`,
      }
    : {
        subject: `${teamName}'s total in gameweek ${gameweek} was overridden`,
        body: `${who} overrode ${teamName}'s total in gameweek ${gameweek}: ${change}. Why: ${reason}`,
      };
}
