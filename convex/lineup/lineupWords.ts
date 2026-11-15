// What a manager is told when a lineup they save is refused (#8): each of lineup.ts's problems in
// words, and the refusals of saving one; and the Mail when a removed role moves his starters.

import type { Words } from "../mail/letterShape";
import { andListWords } from "../shared/moments";
import { PICK_ANOTHER } from "./instructionsWords";
import { STARTER_COUNT, type LineupProblem } from "./lineup";
import { AREA_WORDS, LANE_WORDS } from "./pitchWords";
import { BACK_THREE, roleName } from "./roles";

/** A player's name, by his code. */
type NameOf = (playerCode: number) => string;

const isNot = (names: readonly string[]) => (names.length === 1 ? "isn't" : "aren't");

/** Why a lineup can't be saved, as the manager is told it. */
export const lineupRefusals = {
  seasonOver: "Every gameweek this league plays has begun, so there's no gameweek left to set a line-up for.",
  unplayedGameweek: "Line-ups are locked through a gameweek the league doesn't play, until its last match is over.",
  notInSquad: (names: readonly string[]) => `${andListWords(names)} ${isNot(names)} in your squad.`,
  leftOut: (names: readonly string[]) =>
    `${andListWords(names)} ${isNot(names)} in the line-up: every player in your squad starts or sits on the bench.`,
  noSuchClassicFormation: (name: string) => `This league has no classic formation called ${name} any more: pick a formation to save your line-up.`,
  notInClassicFormationShape: (name: string) => `${name} keeps its formation: pick another formation to leave it.`,
};

/** How many plans a manager keeps, and how long a plan's name may be (spec/05, Saved plans;
 *  Craig, 6 Nov 2026, #992). */
export const PLANS_KEPT = 5;
export const PLAN_NAME_MOST = 30;

/** Why a plan can't be saved, as the manager is told it (Craig's words, 6 Nov 2026, #992). */
export const planRefusals = {
  full: `You keep up to ${PLANS_KEPT} plans: delete one first`,
  nameLength: `A preset's name is 1 to ${PLAN_NAME_MOST} characters`,
  notEleven: `A preset saves all ${STARTER_COUNT} slots, each in its own cell of the pitch`,
};

/** One of lineup.ts's problems, as the manager is told it. */
export function problemWords(problem: LineupProblem, nameOf: NameOf): string {
  switch (problem.kind) {
    case "wrongStarterCount":
      return `A line-up starts ${STARTER_COUNT} players; this one starts ${problem.starterCount}.`;
    case "playerTwice":
      return `${nameOf(problem.playerCode)} is in the line-up twice.`;
    case "noSuchCell":
      return `${nameOf(problem.playerCode)} is placed at "${problem.area}", "${problem.lane}", which isn't a cell on the pitch.`;
    case "cellShared":
      return `${andListWords(problem.playerCodes.map(nameOf))} share the ${LANE_WORDS[problem.lane]} cell in ${AREA_WORDS[problem.area]}: one player a cell.`;
    case "positionsUnknown":
      return `${nameOf(problem.playerCode)} has no positions yet, so he can't start.`;
    case "outsideHisAreas": {
      // A starter with no positions row is held with none (heldPositionsOf), so he is refused here.
      const plays = problem.positions.length === 0 ? "has no positions" : `plays ${problem.positions.join(", ")}`;
      return `${nameOf(problem.playerCode)} ${plays}, so he can't stand in the ${LANE_WORDS[problem.lane]} cell in ${AREA_WORDS[problem.area]}.`;
    }
    case "aboveMaximum":
      return `The league starts at most ${problem.maximum} in ${AREA_WORDS[problem.area]}; this line-up starts ${problem.starterCount} there.`;
    case "roleNotOffered":
      return `The ${LANE_WORDS[problem.lane]} cell in ${AREA_WORDS[problem.area]} doesn't offer the role "${problem.role}" ${nameOf(problem.playerCode)} was given.`;
    case "belowMinimum":
      return `The league starts at least ${problem.minimum} in ${AREA_WORDS[problem.area]}; this line-up starts ${problem.starterCount} there.`;
    case "noBackThree":
      return `${nameOf(problem.playerCode)} can play ${roleName(problem.role)} only with ${BACK_THREE} or more centre-backs; this line-up has ${problem.centreBacks}.`;
    case "roleNotHis":
      return `${nameOf(problem.playerCode)} plays ${problem.positions.join(", ")}, so he can't play ${roleName(problem.role)}.`;
  }
}

/** A role no slot offers any more, as a manager reads it: its key in words ("lateRunner": "Late
 *  runner"), as roleName has no name left for it. */
function cutRoleWords(key: string): string {
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A starter moved off a role removed from the set: his name, the removed role's key and the key
 *  of the role he plays now. */
export type RoleChange = { name: string; from: string; to: string };

/** The Mail to a manager whose starters moved off a role removed from the set: which of them
 *  changed role, from what to what (spec/05 `S05.53`: "Saka: shadow striker → poacher"). */
export function changedRolesLetter(changes: readonly RoleChange[]): Words {
  return {
    subject: "Your starters' roles changed",
    body: [
      "A role left the game, so each of your starters who held it moved to the role he'd get dropped into his slot on:",
      ...changes.map(({ name, from, to }) => `- ${name}: ${cutRoleWords(from)} → ${roleName(to)}`),
      PICK_ANOTHER,
    ].join("\n"),
  };
}
