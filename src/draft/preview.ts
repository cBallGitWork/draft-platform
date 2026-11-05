// The draft room in the preview (src/app/preview.ts): the approved picture's live draft, ten teams
// over twenty rounds, the reader's Saka Potatoes on the clock at round 4, pick 3, with 48 seconds
// left of 90; `?draft=before` shows it before the start instead, as the before-the-start picture has it.

import type { Id } from "../../convex/_generated/dataModel";
import { snakeOrder } from "../../convex/draft/snakeOrder";
import type { Position } from "../../convex/positions/positionTables";
import { DAY_MS, HOUR_MS, SECOND_MS } from "../../convex/shared/time";
import { previewScouting } from "../scouting/preview";
import type { BoardPick, DraftChanges, DraftSeam, DraftState, GreyedPlayer } from "./seam";

const NAMES = ["Kroos Control", "Rovers XI", "Bale Out", "Pep Talk", "Klopp Shop", "Havertz Rent", "Xhaka Laka", "Saka Potatoes", "Show Me Your Moyes", "Dirty Dozen"];
const order = NAMES.map((name, index) => ({ teamId: `preview-draft-team-${index + 1}` as Id<"teams">, name }));
const YOURS = order[7].teamId;
const ROUNDS = 20;

/** The first 32 picks, in pick order: who, from where, playing where. */
const TAKEN: readonly [string, string, Position][] = [
  ["Haaland", "MCI", "ST"], ["Salah", "LIV", "W"], ["Palmer", "CHE", "CAM"], ["Isak", "LIV", "ST"], ["Saka", "ARS", "W"],
  ["Watkins", "AVL", "ST"], ["Wood", "NFO", "ST"], ["Mbeumo", "MUN", "W"], ["Semenyo", "BOU", "W"], ["Gabriel", "ARS", "CB"],
  ["Wirtz", "LIV", "CAM"], ["Eze", "ARS", "CAM"], ["Rice", "ARS", "CDM"], ["Sánchez", "CHE", "GK"], ["Raya", "ARS", "GK"],
  ["Gvardiol", "MCI", "CB"], ["Van Dijk", "LIV", "CB"], ["Kluivert", "BOU", "CAM"], ["Cunha", "MUN", "W"], ["Pedro Porro", "TOT", "FB"],
  ["Caicedo", "CHE", "CDM"], ["Ekitiké", "LIV", "ST"], ["Foden", "MCI", "CAM"], ["Muñoz", "CRY", "FB"], ["João Pedro", "CHE", "ST"],
  ["Pickford", "EVE", "GK"], ["Mateta", "CRY", "ST"], ["Saliba", "ARS", "CB"], ["Rogers", "AVL", "W"], ["Bowen", "WHU", "W"],
  ["Sarr", "CRY", "W"], ["Gordon", "NEW", "W"],
];

const snake = snakeOrder(order, ROUNDS);
const picks: BoardPick[] = TAKEN.map(([name, clubShortName, position], index) => ({
  pick: index + 1,
  teamId: snake[index].teamId,
  player: { code: 9000 + index, name, clubShortName, position },
}));

const startedAt = Date.now();
const draft: DraftState = {
  status: "live",
  startedAt,
  rounds: ROUNDS,
  order,
  picksMade: picks.length,
  onTheClock: { pick: 33, round: 4, teamId: YOURS, name: NAMES[7] },
  clock: { startsAt: startedAt - 42 * SECOND_MS, endsAt: startedAt + 48 * SECOND_MS, pausedAt: undefined },
};

/** Before the start: the order drawn and no picks yet, starting in four days and six hours. */
const before: DraftState = { status: "waiting", startsAt: startedAt + 4 * DAY_MS + 6 * HOUR_MS, rounds: ROUNDS, order };

/** Whether `?draft=before` asks for the draft before its start. */
const isBefore = () => new URLSearchParams(window.location.search).get("draft") === "before";

const GREYED: readonly GreyedPlayer[] = [
  { code: 2, reason: "clubFull" },
  { code: 3, reason: "clubFull" },
];
/** The preview's pick is made at once, and changes nothing. */
const PREVIEW_CHANGES: DraftChanges = { makePick: () => Promise.resolve(null) };

export const previewDraft: DraftSeam = {
  useDraft: () => (isBefore() ? before : draft),
  useBoard: () => ({ picks: isBefore() ? [] : picks, yourTeamId: YOURS, pickSeconds: 90 }),
  useInMenu: () => true,
  // Scouting's preview players; Saka Potatoes is at its Arsenal maximum, so Rice and Raya are greyed.
  usePlayersList: previewScouting.usePlayersList,
  useGreyedOut: () => (isBefore() ? [] : GREYED),
  useDraftChanges: () => PREVIEW_CHANGES,
};
