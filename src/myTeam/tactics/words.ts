// What My team's Tactics tab says (#14), in one place for Craig to change in the pull request.

import { andListWords } from "../../../convex/shared/moments";
import type { Area, Lane } from "../../../convex/lineup/pitch";
import { AREA_WORDS, LANE_WORDS } from "../../../convex/lineup/pitchWords";
import { menuWords } from "../../frame/words";
import { failedWords, gameweekWords, listSeparator } from "../../shared/words";
import { gameweekShort } from "../header/words";

export const TACTICS_TITLE = menuWords.tactics;
export const BENCH_TITLE = "Bench";

export const tacticsLoadingWords = "Loading your lineup…";
export const tacticsNoRulesWords = "This league was made before leagues had rules, so it has no deadline or area limits to set a lineup under.";
export const seasonOverWords = "Every gameweek has begun, so there's no lineup left to set this season.";

const positionsWords = (positions: readonly string[]) => positions.join(listSeparator);

/** The pitch's panel: its plate names the formation the eleven stand in, where it is a preset. */
export const pitchTitle = (formation: string | null) => (formation === null ? "Pitch" : `Pitch ${formation}`);
/** The pitch, named for screen readers, and its cells. */
export const pitchLabel = "The pitch, attack at the top";
const cellWords = (area: Area, lane: Lane) => `${AREA_WORDS[area]}, ${LANE_WORDS[lane]}`;
export const putHereLabel = (name: string, area: Area, lane: Lane) => `Put ${name} in ${cellWords(area, lane)}`;
/** A player the one picked up can swap with, lit on the pitch and in the squad (spec/05, Moving players). */
export const swapLabel = (name: string, other: string) => `Swap ${name} with ${other}`;
export const playerOnPitchLabel = (name: string, positions: readonly string[], area: Area, lane: Lane) =>
  `${name}, ${positionsWords(positions)}, in ${cellWords(area, lane)}`;
export const emptySlotLabel = (area: Area, lane: Lane) => `Empty slot: ${cellWords(area, lane)}`;

/** The desk's switch for the roles' runs on the pitch (spec/05 Runs). */
export const runsWords = "Runs";

/** For screen readers, what is in hand: nobody, or the player picked up. */
export const pickHintWords = "Pick a player, then Move.";
export const movingHintWords = (name: string, positions: readonly string[]) =>
  `Moving ${name} (${positionsWords(positions)}). Escape puts him back.`;

/** The toolbar over the pitch and the table (the approved Tactics picture). */
export const toolbarLabel = "Formation, presets and moves";
/** The Formation keys (spec/05, The pitch): the league's first presets, and the one in use. */
export const presetLabel = "Formation";
export const allFormationsWords = "All formations";
export const teamTacticWords = "Team instruction";
export const teamTacticPlaceholder = "Team instructions: the ones a formation offers show here once they are built";
export const presetsWords = "Presets";
export const presetsPlaceholder = "Your presets: each a formation and every slot's role, never players; they show here once saving them is built";
export const savePresetPlaceholder = "Save preset…: saves the formation and every slot's role in use now, once saving presets is built";
export const quickPickPlaceholder = "Quick Pick: fills the formation with the best eleven by stars, once it is built (#849)";

/** Back one move, through every move since the tab was opened (spec/05, Moving players). */
export const undoWords = "Undo";
export const savedWords = (gameweek: number) => `Saved. It stands from ${gameweekWords(gameweek).toLowerCase()}.`;
export const saveFailedWords = failedWords("the lineup wasn't saved");

/** The Selection table beside the pitch: the eleven, then the bench in order. */
export const SELECTION_TITLE = "Selection";
export const startingWords = (starting: number) => `${starting} starting`;
export const onTheBenchWords = (bench: number) => `${bench} on the bench`;
export const squadTableLabel = "Your squad: the eleven, then the bench in order";
export const squadColumns = {
  position: { short: "Pos", long: "The slot's position; on the bench, his place and his main position" },
  player: { short: "Player", long: "Player" },
  next: { short: "Next", long: "Next fixture" },
  roleFit: { short: "Role fit", long: "His stars for the role" },
  role: { short: "Role", long: "The role he plays in his slot" },
  season: { short: "Season", long: "Season points" },
  last: { short: "Last", long: "Last gameweek's points" },
} as const;
/** Over the bench's Role column: the role each has the most stars for at his main position. */
export const BEST_ROLE_HEAD = "Best role";
/** A bench player's place in the bench order: "S1", the first on. */
export const benchPlaceWords = (index: number) => `S${index + 1}`;
export const benchPlaceLong = (index: number) => `Substitute ${index + 1}`;
/** A starter's role picker, for screen readers (spec/05 Roles). */
export const roleLabel = (name: string) => `${name}'s role`;
export const emptyBenchWords = "Nobody on the bench.";
export const toBenchWords = (name: string) => `Put ${name} on the bench`;
/** Data not held yet, in its place (plate.md, Marks: a placeholder). */
export const roleFitPlaceholder = "Role fit: not shown yet; it waits on stars on screen (#11) and scouts (#375)";

/** The selected player's panel, on top of the right-hand column (plate.md, Tables and panels). */
export const startingWhereWords = (club: string | null, slot: string) => (club === null ? slot : `${club}, ${slot}`);
export const benchWhereWords = (club: string | null, index: number) => startingWhereWords(club, benchPlaceWords(index));
export const closePanelLabel = (name: string) => `Close ${name}'s panel`;
export const rolesHead = (slot: string) => `Role, ${slot} slot`;
export const pointsPerActionHead = "Points per action";
export const nowWords = "now";
export const roleStarsPlaceholder = (role: string) => `${role}: his stars show here once stars are on screen (#11)`;
export const pointsPerActionPlaceholder = (role: string) => `${role}: what it scores more and less for shows here once roles' scoring is on screen`;
export const teamTacticLinePlaceholder = "What the team instructions do for him shows here once they are built";
export const playsHead = "Plays";
export const nextThreeHead = "Next 3";
export const lastFiveHead = "Last 5 in role";
export const lastFivePlaceholder = "His points in the role in one of his last five gameweeks: not held yet";
export const pointsHead = "Points";
export const lastShort = "Last";
export const seasonShort = "Season";
export const moveWords = "Move";
export const movingWords = "Moving";
export const moveLabel = (name: string) => `Move ${name}`;
/** A bench player's buttons for the bench order (spec/05 Auto-subs), and what each says. */
export const upWords = "Up";
export const downWords = "Down";
export const upLabel = (name: string) => `Move ${name} up the bench`;
export const downLabel = (name: string) => `Move ${name} down the bench`;
export const playerCardWords = "Player card";
export const playerCardLabel = (name: string) => `${name}'s player card`;

/** The left column's widget under the pitch, and the right column's. */
export const LINEUP_CHECK_TITLE = "Lineup check";
export const lineupCheckPlaceholder = "Lineup check: who is doubtful, booked, injured or suspended shows here once the status chips' data is settled";
export const TEAM_TACTIC_TITLE = teamTacticWords;
export const opponentTitle = (gameweek: number) => `${gameweekShort(gameweek)} opponent`;

/** Who joined the squad since the lineup was saved. */
export const joinedBenchWords = (names: readonly string[]) => `${andListWords(names)} joined your squad and sit${names.length === 1 ? "s" : ""} at the end of the bench.`;
