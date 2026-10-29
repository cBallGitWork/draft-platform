// What a manager is told when a lineup they save is refused (#8): each of lineup.ts's problems in
// words, and the refusals of saving one.

import { GAMEWEEKS } from "../gameweeks/usedGameweeks";
import { andListWords } from "../shared/moments";
import { STARTER_COUNT, type LineupProblem } from "./lineup";
import { AREA_WORDS, LANE_WORDS } from "./pitchWords";

/** A player's name, by his code. */
export type NameOf = (playerCode: number) => string;

/** A player the app holds no row for, which only one who left long ago can be. */
export const unknownPlayerWords = (playerCode: number) => `Player ${playerCode}`;

const isNot = (names: readonly string[]) => (names.length === 1 ? "isn't" : "aren't");

/** Why a lineup can't be saved, as the manager is told it. */
export const lineupRefusals = {
  noRules: "This league has no rules yet, so it has no deadline and no area limits to set a lineup under. It was made before leagues held their rules.",
  seasonOver: `All ${GAMEWEEKS} gameweeks have begun, so there's no gameweek left to set a lineup for.`,
  notInSquad: (names: readonly string[]) => `${andListWords(names)} ${isNot(names)} in your squad.`,
  leftOut: (names: readonly string[]) =>
    `${andListWords(names)} ${isNot(names)} in the lineup: every player in your squad starts or sits on the bench.`,
};

/** One of lineup.ts's problems, as the manager is told it. */
export function problemWords(problem: LineupProblem, nameOf: NameOf): string {
  switch (problem.kind) {
    case "wrongStarterCount":
      return `A lineup starts ${STARTER_COUNT} players; this one starts ${problem.starterCount}.`;
    case "playerTwice":
      return `${nameOf(problem.playerCode)} is in the lineup twice.`;
    case "noSuchCell":
      return `${nameOf(problem.playerCode)} is placed at "${problem.area}", "${problem.lane}", which isn't a cell on the pitch.`;
    case "cellShared":
      return `${andListWords(problem.playerCodes.map(nameOf))} share the ${LANE_WORDS[problem.lane]} cell in ${AREA_WORDS[problem.area]}: one player a cell.`;
    case "positionsUnknown":
      return `${nameOf(problem.playerCode)} has no positions yet, so he can't start.`;
    case "outsideHisAreas":
      return `${nameOf(problem.playerCode)} plays ${problem.positions.join(", ")}, so he can't stand in the ${LANE_WORDS[problem.lane]} cell in ${AREA_WORDS[problem.area]}.`;
    case "aboveMaximum":
      return `The league starts at most ${problem.maximum} in ${AREA_WORDS[problem.area]}; this lineup starts ${problem.starterCount} there.`;
    case "roleNotOffered":
      return `The ${LANE_WORDS[problem.lane]} cell in ${AREA_WORDS[problem.area]} doesn't offer the role "${problem.role}" ${nameOf(problem.playerCode)} was given.`;
    case "belowMinimum":
      return `The league starts at least ${problem.minimum} in ${AREA_WORDS[problem.area]}; this lineup starts ${problem.starterCount} there.`;
  }
}
