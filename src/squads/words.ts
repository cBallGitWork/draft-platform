// What the squads screen says, in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/squads/squads.ts (`squadRefusals`), and reaches the screen as is.

import type { SquadWarning } from "../../convex/squads/squads";
import { AREA_WORDS, failedWords, gameweekShort } from "../shared/words";

export { findLabel, findTitle, foundListLabel, freeAgentWords, noneFoundWords, searchingWords } from "../shared/words";

export const SQUADS_TITLE = "Squads";
export const findHint = "Every change is in the league's Mail.";
export const loadingWords = "Loading the squads…";
export const onTeamWords = (teamName: string) => `On ${teamName}`;
export const emptySquadWords = "No players yet.";
export const noTeamsWords = "No teams yet.";
/** A free agent found while the league has no teams. */
export const noTeamToPutOnWords = "No team to put him on yet.";
/** A player found on the league's only team. */
export const noOtherTeamWords = "No other team to move him to.";
export const goneWords = "Not available: he has left the Premier League.";
export const teamChoiceLabel = (name: string) => `Team for ${name}`;
export const assignWords = "Put on team";
export const moveWords = "Move";
export const releaseWords = "Release";
export const releaseLabel = (name: string) => `Release ${name}`;
export const assignLabel = (name: string) => `Put ${name} on the team chosen`;
export const moveLabel = (name: string) => `Move ${name} to the team chosen`;
export const squadListLabel = (teamName: string) => `${teamName}'s players`;
export const playersCount = (count: number) => (count === 1 ? "1 player" : `${count} players`);

/** Each team's auto team (spec/09; the approved auto-team picture): its manager, or none, and the
 *  switch, Off or On. A team with no manager is on until handed on; a manager's own switch says so,
 *  and until when. */
export { autoTeamWords as autoTeamLabel } from "../shared/words";
export const AUTO_TEAM_STATES = ["off", "on"] as const;
export const autoTeamStateWords: Record<(typeof AUTO_TEAM_STATES)[number], string> = { off: "Off", on: "On" };
export const noManagerWords = "No manager";
export const untilHandedOnWords = "Until the team is handed on";
export const managersSwitchWords = (endsAfter: number | null) => (endsAfter === null ? "Its manager's" : `Its manager's, until ${gameweekShort(endsAfter)}`);

/** Each squad limit the league's rules set that this squad breaks: they warn, never block (spec/15). */
export function warningWords(warning: SquadWarning): string {
  switch (warning.kind) {
    case "overMaximum":
      return `${warning.players} players, over the league's most of ${warning.maximum}.`;
    case "underMinimum":
      return `${warning.players} players, under the league's least of ${warning.minimum}.`;
    case "overClubMaximum":
      return `${warning.players} from ${warning.clubShortName}, over the league's most of ${warning.maximum} from one club.`;
    case "underAreaMinimum":
      return `${AREA_WORDS[warning.area]}: ${warning.minimum - warning.players} short of the league's least of ${warning.minimum}.`;
  }
}

/** The shared `changeFailedWords` (src/shared/words.ts), naming the squads as what didn't change. */
export const squadChangeFailedWords = failedWords("the squads didn't change");
