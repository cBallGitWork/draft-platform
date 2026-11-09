// The team instructions' live lines (spec/10, The commentary; spec/05, Team instructions; #990):
// "instruction moves get live lines like a role's, worded with the instruction's name" (Craig,
// 9 Nov 2026, on #990), such as "~71' Rice: Get stuck in", +1, just above the line that moved it.
// Pure: vidiprinter.ts prices every line, and asks this for the instructions' own.

import { positionOfSlot } from "../lineup/pitch";
import { withOwnStats } from "../scoring/ownStats";
import type { ScoringSet } from "../scoring/scoringSet";
import { instructionPoints } from "../scoring/teamScoring";
import { inTenths, statIn, type MatchStats } from "../scoring/values";
import { signedWords } from "../shared/numberWords";
import { MINUTES_STAT } from "../stats/matchRecords";
import type { TeamInGameweek } from "../gameweekScorer/teamGameweek";
import type { PricedLine, StoredStep, VidiprinterPlayer, VidiprinterTeam } from "./vidiprinter";

type PlayerCode = number;

/** A lineup's instructions as its men's lines price them: undefined for a team with none. */
export function vidiprinterTeam({ scoring, instructions }: Pick<TeamInGameweek, "scoring" | "instructions">): VidiprinterTeam | undefined {
  return scoring === undefined ? undefined : { scoring, instructions };
}

/** Where an instruction's lines go: the line that moved it, by its key, and its minute. */
interface MovedBy {
  key: string;
  when: string;
  fixtureCode: number;
  playerCode: PlayerCode;
}

/** Each of his team's instructions a threshold step moved, as its own line: his record with the
 *  step's stat at its before and after, at his minutes then, as thresholdSteps.ts's `stepPoints`
 *  prices a rule's (a step whose count didn't move is from no minutes). Nothing while his record
 *  isn't whole. */
export function instructionStep(step: StoredStep, line: MovedBy, player: VidiprinterPlayer, set: ScoringSet): PricedLine[] {
  const stats = player.inMatch.get(line.fixtureCode)?.stats ?? null;
  if (stats === null) return [];
  const minutesBefore = step.from === step.to ? 0 : step.minutes;
  const before = { ...stats, [MINUTES_STAT]: minutesBefore, [step.stat]: step.from };
  const after = { ...stats, [MINUTES_STAT]: step.minutes, [step.stat]: step.to };
  return instructionLines({ before, after }, line, player, set);
}

/** What moving his record from `before` to `after` moves each of his team's instructions by, in
 *  the team's order: one line each that moved, worded with its name. `key` is the line's that moved
 *  it, which each of these extends; `when` is how the line says the minute ("~71' ", or none). */
export function instructionLines(
  { before, after }: { before: MatchStats; after: MatchStats },
  { key, when, fixtureCode, playerCode }: MovedBy,
  player: Pick<VidiprinterPlayer, "name" | "cell" | "team">,
  set: ScoringSet,
): PricedLine[] {
  const { team } = player;
  if (team === undefined) return [];
  const position = positionOfSlot(player.cell);
  const pointsOf = (stats: MatchStats, instruction: string) => {
    const record = withOwnStats(stats, set);
    return instructionPoints(record, set, instruction, position, statIn(record, MINUTES_STAT))?.points ?? 0;
  };
  return team.scoring.instructions.flatMap((instruction) => {
    const points = inTenths(pointsOf(after, instruction) - pointsOf(before, instruction));
    if (points === 0) return [];
    const named = team.instructions.find((each) => each.key === instruction);
    if (named === undefined) throw new Error(`the league's instructions hold no ${JSON.stringify(instruction)}, which a lineup plays`);
    return [
      {
        key: `${key}:${instruction}`,
        text: `${when}${player.name}: ${named.name}`,
        points: signedWords(points),
        priced: { fixtureCode, about: [playerCode], moves: [{ playerCode, points }] },
      },
    ];
  });
}
