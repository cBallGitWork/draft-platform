// Team instructions in words (spec/05, Team instructions; #990): what each shape need asks for, the
// line a formation change leaves when it switches a pick, a save's refusal of a pair, and the Mail
// to a manager whose pick #1452 took off.

import type { Words } from "../mail/letterShape";
import type { Instruction, ShapeNeed, Side, Switched } from "./instructions";

/** What each need asks of a formation, as "Park the bus needs …" ends. */
const NEEDS_WORDS: Record<ShapeNeed, string> = {
  anyShape: "any formation",
  oneUpTopNoWingers: "one up top and no wingers",
  wideOnBothFlanks: "wide players on both flanks",
  twoAtTheBack: "2 at the back",
  threeInARow: "3 or more in one row of midfield or attack",
  twoUpFront: "2 or more in attack and attacking midfield",
  backThreeOrFour: "3 or 4 at the back",
  fiveAtTheBack: "5 at the back",
};

/** The line under the toolbar after a formation change switched picks (spec/05: "Park the bus needs
 *  5 at the back: switched to Keep it tight early"); null when none switched. */
export function switchedWords(switched: readonly Switched[]): string | null {
  if (switched.length === 0) return null;
  return switched.map(({ from, to }) => `${from.name} needs ${NEEDS_WORDS[from.needs]}: switched to ${to.name}`).join(". ");
}

/** A pick #1452 took off a manager's line-up or one of his plans (highLineDropped.ts): its key and
 *  name, the default it switched to, and the plan's name, absent for his line-up. */
export interface LostInstruction {
  from: string;
  fromName: string;
  toName: string;
  plan?: string;
}

/** A manager's own line-up, as this Mail and league home's strip (src/home/words.ts) name it. */
export const YOUR_LINEUP = "Your line-up";

/** Why each pick #1452 took off went, by its key, after its name (spec/05 S05.37, S05.42). */
const WHY_LOST: Record<string, string> = {
  holdAHighLine: "is gone until Sportmonks sends offsides won.",
  pressHigh: `now needs ${NEEDS_WORDS.twoUpFront}.`,
};

/** The Mail to a manager whose line-up or plans lost a pick (spec/05 S05.48: "Mail says so, so he
 *  can pick another"). */
export function lostInstructionsLetter(lost: readonly LostInstruction[]): Words {
  const why = [...new Set(lost.flatMap(({ from, fromName }) => (WHY_LOST[from] === undefined ? [] : [`${fromName} ${WHY_LOST[from]}`])))];
  const switched = lost.map(({ fromName, toName, plan }) =>
    `${plan === undefined ? YOUR_LINEUP :`Your plan "${plan}"`} switched from ${fromName} to ${toName}, its formation's default.`,
  );
  return {
    subject: "Your team instructions changed",
    body: [...why, ...switched, "Pick another on the Tactics tab if you'd rather."].join(" "),
  };
}

/** Why a saved pair is refused: a key the league's set doesn't hold on that side, or one the
 *  lineup's shape blocks. */
export function pairRefusalWords(refusal: { side: Side; key: string; blockedBy?: ShapeNeed }, set: readonly Instruction[]): string {
  const name = set.find(({ key }) => key === refusal.key)?.name;
  if (refusal.blockedBy === undefined || name === undefined) return `"${refusal.key}" isn't one of this league's ${refusal.side} instructions.`;
  return `${name} needs ${NEEDS_WORDS[refusal.blockedBy]}, which this line-up's formation doesn't have.`;
}
