import { v, type GenericValidator, type Infer, type Validator } from "convex/values";
import { gameModeShape } from "../rules/gameMode";
import { playingState } from "../football/matchScores";
import { shownDeadline } from "../gameweeks/usedGameweeks";
import { areaShape, laneShape, slotPosition } from "../lineup/pitchShape";
import { scoreRead } from "../schema";
import { instructionLines, namedCategories, roleLine } from "../scoring/breakdownShape";
import { roleRunShape } from "../scoring/scoringSetShape";
import { LEAGUE_AVERAGE } from "../table/roundRobin";
import { BYE } from "../table/teamGames";

// What the matchup query sends (matchup.ts; #34): one team's head-to-head in one gameweek.

// Each status but noMatch names the match it is about by FPL's fixture code, so it opens that
// match's page (spec/10, The match page).
const slotStatus = v.union(
  /** His match is still to come: its kickoff, null while it has no time. */
  v.object({ kind: v.literal("yetToPlay"), fixtureCode: v.number(), kickoff: v.union(v.number(), v.null()) }),
  /** His match is on, live or at half-time, with its clock as the newest read gives it: the match
   *  page's (#563). */
  v.object({
    kind: v.literal("playing"),
    fixtureCode: v.number(),
    state: playingState,
    minute: scoreRead.fields.minutes,
    clockLabel: scoreRead.fields.clockLabel,
  }),
  /** All his matches are over: the last of them. */
  v.object({ kind: v.literal("finished"), fixtureCode: v.number() }),
  /** His club has no match in the gameweek: a blank one. */
  v.object({ kind: v.literal("noMatch") }),
);
export type SlotStatus = Infer<typeof slotStatus>;

/** What the auto-subs did with him (spec/05, Auto-subs). */
const autoSub = v.union(
  v.null(),
  /** A starter who didn't play, and who came on for him: that man's code, which finds him (two men
   *  can share a name; #1778), and his name, which the words say. */
  v.object({ kind: v.literal("off"), playerCode: v.number(), playerName: v.string() }),
  /** A bench player who came on, and for whom, the same way. */
  v.object({ kind: v.literal("on"), playerCode: v.number(), playerName: v.string() }),
  /** A starter who didn't play whom no one on the bench could replace: his slot scores nothing. */
  v.object({ kind: v.literal("unreplaced") }),
);

/** One of his matches in the gameweek, broken down as the table's scorer scored his slot (spec/10:
 *  "the opposition manager needs to see why his opponent got the points"; #798): each category and
 *  his role's line, which add up to his points there, or the league's override in their place. */
const matchBreakdown = v.object({
  /** The match, which its page opens by, and its kickoff, null while it has no time. */
  fixtureCode: v.number(),
  kickoff: v.union(v.number(), v.null()),
  /** Its clubs' short names, home first, each null for one the football sync doesn't hold, and its
   *  score and clock as the newest read gives them, null before any: the breakdown names it
   *  "NFO 1–0 BRE 67'" (the approved picture), or by its kickoff while a club's name is missing. */
  home: v.union(v.string(), v.null()),
  away: v.union(v.string(), v.null()),
  score: v.union(
    v.object({
      state: scoreRead.fields.state,
      homeGoals: scoreRead.fields.homeGoals,
      awayGoals: scoreRead.fields.awayGoals,
      minutes: scoreRead.fields.minutes,
      clockLabel: scoreRead.fields.clockLabel,
    }),
    v.null(),
  ),
  /** His points in the match; null ("—") while his record hasn't arrived. */
  points: v.union(v.number(), v.null()),
  /** Whether his gameweek's points include it: false for the lower of a double gameweek's two under
   *  best match (spec/03), greyed (Craig, 6 Nov 2026). */
  counted: v.boolean(),
  categories: namedCategories,
  /** His role's line, when he plays a role the set scores; never beside an override. */
  role: v.optional(roleLine),
  /** His team's instructions' lines, under his role's (spec/05, Team instructions); never beside
   *  an override. */
  instructions: v.optional(instructionLines),
  override: v.union(v.object({ points: v.number(), reason: v.string() }), v.null()),
});
export type MatchBreakdown = Infer<typeof matchBreakdown>;

const slot = v.object({
  playerCode: v.number(),
  name: v.string(),
  /** The area he is priced in: his slot, the one he came on in, or his bench cell's. */
  area: areaShape,
  /** His club, whose colours his shirt wears; null for one the football sync doesn't hold. */
  clubCode: v.union(v.number(), v.null()),
  /** His shirt's number (#13): his manager's while the team still holds him, else his club's, else
   *  null (squadNumbers.ts). */
  number: v.union(v.number(), v.null()),
  /** Null ("—") while none of his records has arrived. */
  points: v.union(v.number(), v.null()),
  /** Whether his points count: false is greyed, a bench player not on or a starter subbed off. */
  counts: v.boolean(),
  provisional: v.boolean(),
  status: slotStatus,
  autoSub,
  /** Each of his matches in the gameweek, broken down, kickoff first; none in a blank one. */
  breakdown: v.array(matchBreakdown),
});
export type MatchupSlot = Infer<typeof slot>;

/** The role a man plays and is priced in (spec/10, The matchup, as a live match; spec/05 Roles),
 *  named as the Tactics pitch names it. */
const role = v.object({ key: v.string(), name: v.string() });

/** The slot a man plays his role in (spec/10, The matchup, as a live match: "his slot's position
 *  label and his role's run, as on the Tactics pitch"): its lane, which with his `area` is the cell
 *  his role's run (the side's `runs`) is drawn from, and its position label (pitch.ts's positionOfSlot). */
const place = v.object({ lane: laneShape, label: slotPosition });
export type MatchupPlace = Infer<typeof place>;

/** A starter: a slot, his role (the one he was given, or the slot's first) and where he plays it. */
const starter = slot.extend({ role, place });
export type MatchupStarter = Infer<typeof starter>;

/** A bench player: a slot, and once he has come on the role he plays (spec/05 Auto-subs), the
 *  empty slot's or in his own area his best-star one at the deadline (#11), and the slot he came on
 *  in, whose label and run are then his, not the man's he replaced (Craig, 6 Nov 2026; #850). Both
 *  null until then. */
const benchSlot = slot.extend({ role: v.union(role, v.null()), place: v.union(place, v.null()) });
export type MatchupBenchSlot = Infer<typeof benchSlot>;

const side = v.union(
  v.object({
    kind: v.literal("team"),
    teamId: v.id("teams"),
    teamName: v.string(),
    points: v.number(),
    provisional: v.boolean(),
    /** Whether the league has overridden its total for the gameweek, which `points` then is
     *  (spec/14 S14.3; #903): the override control under its name then removes it. */
    overridden: v.boolean(),
    /** Whether nobody runs it, so the auto team picks its lineup (#1207): the "Auto team" tag. */
    autoTeam: v.boolean(),
    lineup: v.object({ starters: v.array(starter), bench: v.array(benchSlot) }),
    /** The preset its lineup stands in, such as "4-4-2" (spec/10: a side's formation "is named by
     *  its preset until its edited"); null once its manager has edited it off every preset, as
     *  what such a shape is called waits on Craig (#878). */
    formation: v.union(v.string(), v.null()),
    /** Each moving role's run, as the site's scoring set in the gameweek holds it (spec/05 Runs,
     *  `S05.8`): what its pitch draws, as the Tactics pitch does. */
    runs: v.array(roleRunShape),
  }),
  /** The league's average, which the odd team out plays in a league that gives it one. */
  v.object({ kind: v.literal(LEAGUE_AVERAGE), points: v.number(), provisional: v.boolean() }),
);
export type MatchupSide = Infer<typeof side>;

const opponent = v.union(v.object({ kind: v.literal("team"), teamName: v.string() }), v.object({ kind: v.literal(LEAGUE_AVERAGE) }));

/** A commentary line (matchup/vidiprinter.ts): its words, and what it is worth to the men it is
 *  priced for. */
const commentaryLine = v.object({ key: v.string(), text: v.string(), points: v.union(v.string(), v.null()) });

/** Commentary, its lines `line`: every line, newest first, and whether any of the matches'
 *  commentary is delayed ("Commentary delayed"); or why it can't be read, while the scores still
 *  show. */
const commentaryOf = <Line extends Validator<Infer<typeof commentaryLine>, "required", string>>(line: Line) =>
  v.union(v.object({ kind: v.literal("read"), lines: v.array(line), delayed: v.boolean() }), unreadCommentary);

/** Commentary as a query sends it, which may not read the clock (#1550): in place of `delayed`, the
 *  moment it is delayed from (matchCommentary.ts's `delayedFrom`), 0 for already and null for not;
 *  the screen says whether it is at its minute (commentaryAt.ts). */
const heldCommentaryOf = <Line extends Validator<Infer<typeof commentaryLine>, "required", string>>(line: Line) =>
  v.union(v.object({ kind: v.literal("read"), lines: v.array(line), delayedFrom: v.union(v.number(), v.null()) }), unreadCommentary);

const unreadCommentary = v.object({ kind: v.literal("unread"), reason: v.string() });

/** League home's and the match page's commentary (spec/10, spec/12). */
export const commentary = commentaryOf(commentaryLine);
export type MatchupCommentary = Infer<typeof commentary>;
export const heldCommentary = heldCommentaryOf(commentaryLine);
export type HeldCommentary = Infer<typeof heldCommentary>;

/** The matchup's commentary (spec/10): every line of every match with either lineup's men in it,
 *  each with the men it is about, whose lines a tapped man's cyan bar marks, and a column for each
 *  side, team then opponent, of what it moves that team's score by (readCommentary.ts; the approved
 *  picture's "Saka P / Kroos C"). The league's average has no column. */
const teamsLine = commentaryLine.extend({ about: v.array(v.number()), columns: v.array(v.union(v.string(), v.null())) });
export const teamsCommentary = commentaryOf(teamsLine);
export type TeamsCommentary = Infer<typeof teamsCommentary>;
const heldTeamsCommentary = heldCommentaryOf(teamsLine);
export type HeldTeamsCommentary = Infer<typeof heldTeamsCommentary>;

/** A game, its commentary `commentary`: on screen, or held as `ofTeam` sends it. */
const gameWith = <Commentary extends GenericValidator>(commentary: Commentary) =>
  v.union(
    /** The team plays nobody in the gameweek: one begun before it joined, say. */
    v.object({ kind: v.literal("none") }),
    v.object({ kind: v.literal(BYE) }),
    /** Before the deadline: who it meets, and no lineup yet. */
    v.object({ kind: v.literal("notBegun"), opponent }),
    /** Begun, but it can't be scored (#287), and why. */
    v.object({ kind: v.literal("unscored"), opponent, reason: v.string() }),
    /** The team on the left, its opponent on the right. */
    v.object({
      kind: v.literal("scored"),
      team: side,
      opponent: side,
      commentary,
      /** The version of the site's scoring the gameweek is scored under, null for the first set: a
       *  breakdown's last line (spec/14, On screen). */
      version: v.union(v.string(), v.null()),
    }),
  );

export const game = gameWith(teamsCommentary);
const heldGame = gameWith(heldTeamsCommentary);
export type HeldGame = Infer<typeof heldGame>;

/** A matchup, its game `game`: on screen, or held as `ofTeam` sends it. */
const matchupWith = <Game extends GenericValidator>(game: Game) =>
  v.union(
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
      /** Which of the team's games in the gameweek this is, from 1, as drawn (#521). */
      gameNumber: v.number(),
      /** Each of the team's games in the gameweek, as drawn, for the switch between them in a league
       *  playing more than one a gameweek: who each is against, or a bye. Empty with no gameweek. */
      games: v.array(v.union(opponent, v.object({ kind: v.literal(BYE) }))),
      game,
      /** What the league plays in the gameweek, or by its latest rules with none, for the role
       *  parts (#1582). */
      mode: gameModeShape,
    }),
  );

/** The matchup on screen. */
export const matchup = matchupWith(game);
export type Matchup = Infer<typeof matchup>;
/** The matchup as `ofTeam` sends it, its commentary held (`heldCommentaryOf`). */
export const heldMatchup = matchupWith(heldGame);
export type HeldMatchup = Infer<typeof heldMatchup>;

