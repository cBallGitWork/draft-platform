// What My team's Tactics tab says (#14), in one place for Craig to change in the pull request.

import { andListWords } from "../../../convex/shared/moments";
import type { Area, Lane } from "../../../convex/lineup/pitch";
import type { Side } from "../../../convex/lineup/instructions";
import { AREA_IN_WORDS, AREA_WORDS, LANE_WORDS } from "../../../convex/lineup/pitchWords";
import { failedWords, listSeparator, menuWords, notHeldLabel } from "../../shared/words";
import { timeOfDayWords } from "../../shared/when/words";
import { gameweekShort } from "../header/words";
import { benchShort, nextMatchesShort } from "../words";
import type { MoveRefusal } from "./swaps";

export const TACTICS_TITLE = menuWords.tactics;
export { BENCH_TITLE } from "../../shared/words";

export const tacticsLoadingWords = "Loading your line-up…";
export { seasonOverWords } from "../words";

const positionsWords = (positions: readonly string[]) => positions.join(listSeparator);

/** The pitch's panel: its plate names the formation the eleven stand in, where it is a preset or a
 *  classic formation. */
export const pitchTitle = (formation: string | null) => (formation === null ? "Pitch" : `Pitch ${formation}`);
/** A classic formation once its manager has changed a role (spec/05; Craig, 6 Nov 2026). */
export const customWords = (classicFormation: string) => `${classicFormation} (custom)`;
/** The pitch, named for screen readers, and its cells. */
export const pitchLabel = "The pitch, attack at the top";
const cellWords = (area: Area, lane: Lane) => `${AREA_WORDS[area]}, ${LANE_WORDS[lane]}`;
/** A player the one picked up can swap with, lit on the pitch and in the squad (spec/05, Moving players). */
export const swapLabel = (name: string, other: string) => `Swap ${name} with ${other}`;
/** What a lit player's stars rate: the player who would land in that slot, on his role there (#11). */
export const landingSubject = (name: string, role: string) => `${name} as ${role}`;
/** A player on the pitch, for screen readers: the words his block shows first, in its order, so a
 *  voice saying what it sees reaches him (WCAG 2.5.3; S12.14), then his positions and his cell:
 *  "11 PCH ST Haaland IPS (A), ST, in Attack, centre". */
export const playerOnPitchLabel = (shown: string, positions: readonly string[], area: Area, lane: Lane) => `${shown}, ${onPitchWords(positions, area, lane)}`;
export const onPitchWords = (positions: readonly string[], area: Area, lane: Lane) => `${positionsWords(positions)}, in ${cellWords(area, lane)}`;
/** A lit player on the pitch: what his block shows, then the swap (WCAG 2.5.3; S12.14). */
export const swapOnPitchLabel = (shown: string, name: string, other: string) => `${shown}, ${swapLabel(name, other)}`;
export const emptySlotLabel = (area: Area, lane: Lane) => `Empty position: ${cellWords(area, lane)}`;

/** The desk's switch for the roles' runs on the pitch (spec/05 Runs), shown as "movement" (Glossary, run). */
export const runsWords = "Show movement";

/** For screen readers, what is in hand: nobody, or the player picked up. */
export const pickHintWords = "Choose a player to move or swap.";
export const movingHintWords = (name: string, positions: readonly string[]) =>
  `${name} (${positionsWords(positions)}) chosen. Pick a lit spot or the player to swap him with. Escape puts him back.`;

/** The toolbar over the pitch and the table (the approved Tactics picture). */
export const toolbarLabel = "Formation, presets and moves";
/** The Formation keys (spec/05, The pitch): the league's first presets, and the one in use. */
export const presetLabel = "Formation";
export const allFormationsWords = "All formations";
/** The two team instruction pickers, side by side where the one Team tactic was (spec/05; Craig,
 *  6 Nov 2026, on #990: "Attacking: Play out from the back", "Defending: Keep it tight early"). */
export const SIDE_WORDS: Record<Side, string> = { attacking: "Attacking", defensive: "Defending" };
export const instructionLabel = (side: Side) => `${SIDE_WORDS[side]} instruction`;
/** The right column's box ("Instructions for 4-2-3-1"; the picture said "4-2-3-1 unlocks"): what the formation offers on each
 *  side, the pick marked. */
export const instructionsTitle = (formation: string | null) => (formation === null ? "Team instructions" : `Instructions for ${formation}`);
export const pickedWords = "Picked";
export const presetsWords = "Presets";
/** The toolbar's button and the formation window's tile that both save a preset. */
export const savePresetWords = "Save preset…";
/** Fills the formation with the best eleven by stars (spec/05, Moving players; #849). */
export const quickPickWords = "Best XI";

/** Back one move, through every move since the tab was opened (spec/05, Moving players). */
export const undoWords = "Undo";
/** When the lineup last saved, by the viewer's own clock (spec/05, Moving players). */
export const savedWords = (at: number) => `Line-up saved ${timeOfDayWords(at)}`;
export const saveFailedWords = failedWords("the line-up wasn't saved");
/** Said once the tab reloads a line-up another tab saved (spec/05 `S05.55`); a move this tab sent
 *  meanwhile is refused in the server's words (lineupWords.ts `changedElsewhere`). */
export const reloadedWords = "Line-up changed in another tab: reloaded.";
export const planSaveFailedWords = failedWords("the preset wasn't saved");
export const planDeleteFailedWords = failedWords("the preset wasn't deleted");
/** A plan loaded with roles the league no longer offers in their slot (Craig, 6 Nov 2026, #992). */
export const rolesLostWords = (name: string, lost: number) =>
  `${name}: ${lost === 1 ? "1 role is" : `${lost} roles are`} no longer allowed. ${lost === 1 ? "That player now plays his" : "Those players now play their"} best role by stars.`;
/** Why a drop was refused, said in the line under the toolbar (spec/05, The pitch; Craig, 4 Nov
 *  2026): presets only, so the formation changes only by picking one. `nameOf` names a squad player. */
export function refusalWords(refusal: MoveRefusal, nameOf: (playerCode: number) => string): string {
  switch (refusal.kind) {
    case "emptyCell":
      return "You can't move a player into an empty space. Pick a formation instead.";
    case "offThePitch":
      return "To take a player out of your XI, swap him with a bench player.";
    case "goal":
      return "Only a keeper plays in goal, and a keeper plays only in goal.";
    case "doesNotPlay":
      return `${nameOf(refusal.playerCode)} doesn't play ${LANE_WORDS[refusal.cell.lane]} ${AREA_IN_WORDS[refusal.cell.area]}.`;
    case "areaLimits":
      return "That breaks the league's limits for defence, midfield or attack.";
  }
}

/** The Selection table beside the pitch: the eleven, then the bench in order. */
export const SELECTION_TITLE = "Selection";
export const startingWords = (starting: number) => `${starting} starting`;
export const onTheBenchWords = (bench: number) => `${bench} on the bench`;
export const selectionTableLabel = "Your squad: the eleven, then the bench in order";
/** A lit player's name in the Selection table: the name his row shows, then the swap (WCAG 2.5.3;
 *  S12.14): "Watkins, Swap Haaland with Watkins". */
export const swapInTableLabel = (name: string, other: string) => `${other}, ${swapLabel(name, other)}`;
/** What a row's stars rate, named on them: "Role fit 4 of 5" (plate.md, Marks: Stars); also the
 *  Selection table's and the role card's column head. */
export const ROLE_FIT_SUBJECT = "Role fit";
export const selectionColumns = {
  position: { short: "Pos", long: "His place in your formation, or bench place and main position" },
  player: { short: "Player", long: "Player" },
  next: { short: "Next", long: "Next fixture" },
  roleFit: { short: ROLE_FIT_SUBJECT, long: "His stars for the role" },
  role: { short: "Role", long: "The role he plays in your formation" },
} as const;
/** Over the bench's Role column: the role each has the most stars for at his main position. */
export const BEST_ROLE_HEAD = "Best role";
/** A bench player's place in the bench order, by his index: "S1", the first on. */
export const benchPlaceWords = (index: number) => benchShort(index + 1);
export const benchPlaceLong = (index: number) => `Substitute ${index + 1}`;
/** A starter's role picker, for screen readers (spec/05 Roles): the role it shows first (WCAG
 *  2.5.3; S12.14), "Poacher, Haaland's role". */
export const roleLabel = (name: string, role: string) => `${role}, ${whoseRoleWords(name)}`;
export const whoseRoleWords = (name: string) => `${name}'s role`;
export const emptyBenchWords = "Nobody on the bench.";

/** The selected player's panel, on top of the right-hand column (plate.md, Tables and panels). */
export const startingWhereWords = (club: string | null, slot: string) => (club === null ? slot : `${club}, ${slot}`);
export const benchWhereWords = (club: string | null, index: number) => startingWhereWords(club, benchPlaceWords(index));
export const closeSelectedLabel = (name: string) => `Close ${name}'s panel`;
export const rolesHead = (slot: string) => `Role, ${slot} position`;
export const pointsPerActionHead = "Points per action";
export const nowWords = "now";
export const pointsPerActionPlaceholder = (role: string) => `What ${role} scores more and less for shows here once role scoring is live`;
export const teamTacticLinePlaceholder = "What the team instructions score for him shows here once they are scored";
export const playsHead = "Plays";
export const nextThreeHead = nextMatchesShort;
export const lastFiveHead = "Last 5 in role";
export const lastFivePlaceholder = notHeldLabel("His points in the role in one of his last 5 gameweeks");
/** His points, in the selected player's panel and on the role card. */
export const pointsHead = "Points";
/** Marks the formation or the role in use now (the formation window, the role card). */
export const inUseWords = "In use";
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
export const playerCardLabel = (name: string) => `${name}'s player card`;

/** The mark after a player's name while one of his positions is at stake (#23; Craig, 6 Nov 2026),
 *  read on hover and by screen readers. */
export const flaggedMarkLabel = (position: string, startsElsewhere: number) => `${position} at risk: his last ${startsElsewhere} starts were elsewhere`;
export const outOfPositionMarkLabel = (position: string) => `Out of position: no longer plays ${position}`;
export const LINEUP_CHECK_TITLE = "Line-up check";
/** A line of the lineup check for each starter out of position (#23; Craig, 6 Nov 2026). */
export const outOfPositionLineWords = (position: string) => `: out of position at ${position}`;
/** A line for each starter with FPL news, the note word for word (Craig, 13 Nov 2026, on #1976). */
export const newsLineWords = (news: string) => `: ${news}`;
export const nothingToCheckWords = "No one in your XI is out of position or has news.";
export const opponentTitle = (gameweek: number) => `${gameweekShort(gameweek)} opponent`;

/** Who joined the squad since the lineup was saved. */
export const joinedBenchWords = (names: readonly string[]) => `${andListWords(names)} joined your squad and sit${names.length === 1 ? "s" : ""} at the end of the bench.`;
