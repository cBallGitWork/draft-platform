// What the squads screen says, in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/squads/squads.ts (`squadRefusals`), and reaches the screen as is.

import { failedWords, gameweekShort } from "../shared/words";

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
export { leftLeagueWords as goneWords } from "../shared/words";
export const teamChoiceLabel = (name: string) => `Team for ${name}`;
export const assignWords = "Put on team";
export const moveWords = "Move";
export const releaseWords = "Release";
export const releaseLabel = (name: string) => `Release ${name}`;
export const assignLabel = (name: string) => `Put ${name} on the team chosen`;
export const moveLabel = (name: string) => `Move ${name} to the team chosen`;
export const squadListLabel = (teamName: string) => `${teamName}'s players`;
export { playersCount } from "../shared/words";

/** Each team's auto team (spec/09; the approved auto-team picture): its manager, or none, and the
 *  switch, Off or On. A team with no manager is on until handed on; a manager's own switch says so,
 *  and until when. */
export { autoTeamWords as autoTeamLabel } from "../shared/words";
export const AUTO_TEAM_STATES = ["off", "on"] as const;
export const autoTeamStateWords: Record<(typeof AUTO_TEAM_STATES)[number], string> = { off: "Off", on: "On" };
export { noManagerWords } from "../shared/words";
export const untilHandedOnWords = "Until the team is handed on";
export const managersSwitchWords = (endsAfter: number | null) => (endsAfter === null ? "Its manager's" : `Its manager's, until ${gameweekShort(endsAfter)}`);

/** Each squad limit the league's rules set that this squad breaks: they warn, never block (spec/15). */
export { warningWords } from "../shared/words";

/** The shared `changeFailedWords` (src/shared/words.ts), naming the squads as what didn't change. */
export const squadChangeFailedWords = failedWords("the squads didn't change");
