// Our own commentary from a Sportmonks match's events timeline (#1418, spec/10, The commentary,
// `S10.4`): CM-terse lines ("62' GOAL Saka, assist Ødegaard") for its goals, cards, substitutions
// and VAR calls, in minute and extra-minute order, each keyed on Sportmonks' event id, so a re-read
// rewrites a line and never doubles it. Pure: a `sportmonksMatches` row's events in, the lines and
// the delay `matchCommentary.ts` stores out. The kick-off and full-time lines are written apart.

import type { ScoreRead } from "./scoreReads";
import { byEventMinute, type SportmonksEvent } from "./sportmonks/sportmonksMatch";
import { FEED_TYPE, minuteOf, UNLISTED_NAME, type WrittenLine } from "./commentary";
import { behind, joinedReasons, type CommentaryRead } from "./matchCommentary";

/** Sportmonks' event type ids (its `type_id`) this file words, from its v3 types list. */
export const SM_EVENT_TYPE = {
  var: 10,
  goal: 14,
  ownGoal: 15,
  penaltyGoal: 16,
  missedPenalty: 17,
  substitution: 18,
  yellowCard: 19,
  redCard: 20,
  secondYellow: 21,
} as const;

/** A missed penalty's line type, which the Premier League's feed has no name for. */
export const MISSED_PENALTY_TYPE = "missed penalty";

interface Wording {
  /** The line's type, as the Premier League's lines name it where they have it, so the matchup
   *  prices a goal, an assist or a card from either feed alike (#44). */
  type: string;
  words: (man: string, other: string | null, event: SportmonksEvent) => string;
}

/** Each worded event type: `man` is its player, `other` its related player (the goal's assister, the
 *  man a substitute replaces), named as the input names them. */
const WORDING: Readonly<Record<number, Wording>> = {
  [SM_EVENT_TYPE.goal]: { type: FEED_TYPE.goal, words: (man, other) => (other === null ? `GOAL ${man}` : `GOAL ${man}, assist ${other}`) },
  [SM_EVENT_TYPE.penaltyGoal]: { type: FEED_TYPE.penaltyGoal, words: (man) => `GOAL ${man}, penalty` },
  [SM_EVENT_TYPE.ownGoal]: { type: FEED_TYPE.ownGoal, words: (man) => `OWN GOAL ${man}` },
  [SM_EVENT_TYPE.missedPenalty]: { type: MISSED_PENALTY_TYPE, words: (man) => `PENALTY ${man}, missed` },
  [SM_EVENT_TYPE.yellowCard]: { type: FEED_TYPE.yellowCard, words: (man) => `YELLOW ${man}` },
  [SM_EVENT_TYPE.secondYellow]: { type: FEED_TYPE.secondYellow, words: (man) => `RED ${man}, second yellow` },
  [SM_EVENT_TYPE.redCard]: { type: FEED_TYPE.redCard, words: (man) => `RED ${man}` },
  [SM_EVENT_TYPE.substitution]: { type: FEED_TYPE.substitution, words: (man, other) => `SUB ${man} on, ${other ?? UNLISTED_NAME} off` },
  [SM_EVENT_TYPE.var]: { type: FEED_TYPE.refereeDecision, words: (man, _other, event) => varWords(man, event) },
};

export interface SportmonksCommentary {
  /** Newest first, as the stored commentary's: a vidiprinter. */
  lines: WrittenLine[];
  /** Events of a type with no wording here: kept out of `lines`, and reported, never dropped unseen. */
  unworded: SportmonksEvent[];
}

/** One match's events as lines, each man named by his Sportmonks player id in `nameById`. An event
 *  sent twice is one line, its newest sending; a man with no name given is `UNLISTED_NAME`. Events
 *  in the same minute keep the order the match read stored them in (sportmonksMatch.ts). */
export function sportmonksCommentary(events: readonly SportmonksEvent[], nameById: ReadonlyMap<number, string>): SportmonksCommentary {
  const byId = new Map<number, SportmonksEvent>();
  for (const event of events) byId.set(event.id, event);
  const named = (id: number | null) => (id === null ? null : (nameById.get(id) ?? UNLISTED_NAME));
  const lines: WrittenLine[] = [];
  const unworded: SportmonksEvent[] = [];
  for (const event of [...byId.values()].sort(byEventMinute).reverse()) {
    const wording = WORDING[event.typeId];
    if (wording === undefined) {
      unworded.push(event);
      continue;
    }
    const words = wording.words(named(event.playerId) ?? UNLISTED_NAME, named(event.relatedPlayerId), event);
    lines.push({
      sourceId: event.id,
      text: event.minute === null ? words : `${minuteOf(event.minute, event.extraMinute)} ${words}`,
      minute: event.minute,
      addedMinute: event.extraMinute,
      type: wording.type,
      playerCodes: [event.playerId, event.relatedPlayerId].filter((id) => id !== null),
    });
  }
  return { lines, unworded };
}

/** One read's lines, and why the commentary is delayed: an unworded event, or the newest line
 *  trailing the match clock by over `COMMENTARY_BEHIND_MINUTES` (`S10.5`), as the Premier League's. */
export function sportmonksCommentaryRead(
  events: readonly SportmonksEvent[],
  score: ScoreRead,
  nameById: ReadonlyMap<number, string>,
): CommentaryRead {
  const { lines, unworded } = sportmonksCommentary(events, nameById);
  return { lines, delayed: joinedReasons([behind(lines, score), unwordedReason(unworded)]) };
}

/** "VAR Baur, goal disallowed": the call as Sportmonks words it, when it does. A real read sends it
 *  in `addition` with `info` empty (Celtic v Kilmarnock, #1450); the docs show it in `info`. */
function varWords(man: string, event: SportmonksEvent): string {
  const head = event.playerId === null ? "VAR" : `VAR ${man}`;
  const call = event.addition ?? event.info;
  return call === null ? head : `${head}, ${call.toLowerCase()}`;
}

function unwordedReason(events: readonly SportmonksEvent[]): string | null {
  if (events.length === 0) return null;
  const types = [...new Set(events.map((event) => event.typeId))];
  return `${events.length} events of a type with no wording (${types.join(", ")})`;
}
