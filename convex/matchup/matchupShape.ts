import { v, type Infer } from "convex/values";
import { shownDeadline } from "../gameweeks/usedGameweeks";
import { areaShape } from "../lineup/pitchShape";
import { LEAGUE_AVERAGE } from "../table/roundRobin";
import { BYE } from "../table/teamGames";

// What the matchup query sends (matchup.ts; #34): one team's head-to-head in one gameweek.

// Each status but noMatch names the match it is about by FPL's fixture code, so it opens that
// match's page (spec/10, The match page).
const slotStatus = v.union(
  /** His match is still to come: its kickoff, null while it has no time. */
  v.object({ kind: v.literal("yetToPlay"), fixtureCode: v.number(), kickoff: v.union(v.number(), v.null()) }),
  /** His match is on: the minute on its clock, null until a feed has read one. */
  v.object({ kind: v.literal("playing"), fixtureCode: v.number(), minute: v.union(v.number(), v.null()) }),
  /** All his matches are over: the last of them. */
  v.object({ kind: v.literal("finished"), fixtureCode: v.number() }),
  /** His club has no match in the gameweek: a blank one. */
  v.object({ kind: v.literal("noMatch") }),
);
export type SlotStatus = Infer<typeof slotStatus>;

/** What the auto-subs did with him (spec/05, Auto-subs). */
const autoSub = v.union(
  v.null(),
  /** A starter who didn't play, and who came on for him. */
  v.object({ kind: v.literal("off"), playerName: v.string() }),
  /** A bench player who came on, and for whom. */
  v.object({ kind: v.literal("on"), playerName: v.string() }),
  /** A starter who didn't play whom no one on the bench could replace: his slot scores nothing. */
  v.object({ kind: v.literal("unreplaced") }),
);

const slot = v.object({
  playerCode: v.number(),
  name: v.string(),
  /** The area he is priced in: his slot, the one he came on in, or his bench cell's. */
  area: areaShape,
  /** Null ("—") while none of his records has arrived. */
  points: v.union(v.number(), v.null()),
  /** Whether his points count: false is greyed, a bench player not on or a starter subbed off. */
  counts: v.boolean(),
  provisional: v.boolean(),
  status: slotStatus,
  autoSub,
});
export type MatchupSlot = Infer<typeof slot>;

const side = v.union(
  v.object({
    kind: v.literal("team"),
    teamId: v.id("teams"),
    teamName: v.string(),
    points: v.number(),
    provisional: v.boolean(),
    lineup: v.object({ starters: v.array(slot), bench: v.array(slot) }),
  }),
  /** The league's average, which the odd team out plays in a league that gives it one. */
  v.object({ kind: v.literal(LEAGUE_AVERAGE), points: v.number(), provisional: v.boolean() }),
);
export type MatchupSide = Infer<typeof side>;

const opponent = v.union(v.object({ kind: v.literal("team"), teamName: v.string() }), v.object({ kind: v.literal(LEAGUE_AVERAGE) }));

/** The matchup's commentary (spec/10; matchup/vidiprinter.ts): every line of every match with
 *  either lineup's men in it, newest first, and whether any of those matches' commentary is
 *  delayed ("Commentary delayed"); or why it can't be read, while the scores still show. */
export const commentary = v.union(
  v.object({
    kind: v.literal("read"),
    lines: v.array(v.object({ key: v.string(), text: v.string(), points: v.union(v.string(), v.null()) })),
    delayed: v.boolean(),
  }),
  v.object({ kind: v.literal("unread"), reason: v.string() }),
);
export type MatchupCommentary = Infer<typeof commentary>;

export const game = v.union(
  /** The team plays nobody in the gameweek: one begun before it joined, say. */
  v.object({ kind: v.literal("none") }),
  v.object({ kind: v.literal(BYE) }),
  /** Before the deadline: who it meets, and no lineup yet. */
  v.object({ kind: v.literal("notBegun"), opponent }),
  /** Begun, but it can't be scored (#287), and why. */
  v.object({ kind: v.literal("unscored"), opponent, reason: v.string() }),
  /** The team on the left, its opponent on the right. */
  v.object({ kind: v.literal("scored"), team: side, opponent: side, commentary }),
);

export const matchup = v.union(
  v.object({ kind: v.literal("totalPoints") }),
  /** The caller runs no team and named none. */
  v.object({ kind: v.literal("noTeam") }),
  v.object({
    kind: v.literal("headToHead"),
    teamId: v.id("teams"),
    teamName: v.string(),
    /** Every gameweek the team plays a head-to-head or has a bye in, for the stepper. */
    gameweeks: v.array(v.number()),
    /** Null while the team plays no head-to-head gameweek at all (fewer than two teams, say). */
    gameweek: v.union(v.number(), v.null()),
    deadline: shownDeadline,
    game,
  }),
);
export type Matchup = Infer<typeof matchup>;

