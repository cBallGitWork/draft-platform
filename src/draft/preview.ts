// The draft room in the preview (src/app/preview.ts): the approved picture's live draft, ten teams
// over twenty rounds, the reader's Saka Potatoes on the clock at round 4, pick 3, with 48 seconds
// left of 90.

import type { Id } from "../../convex/_generated/dataModel";
import type { Position } from "../../convex/positions/positionTables";
import { SECOND_MS } from "../../convex/shared/time";
import type { BoardPick, DraftSeam, DraftState } from "./seam";

const NAMES = ["Kroos Control", "Rovers XI", "Bale Out", "Pep Talk", "Klopp Shop", "Havertz Rent", "Expected Toulouse", "Saka Potatoes", "Show Me Your Moyes", "Dirty Dozen"];
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

/** The team making pick `pick`, by the snake. */
const teamAt = (pick: number) => {
  const round = Math.floor((pick - 1) / order.length);
  const inRound = (pick - 1) % order.length;
  return order[round % 2 === 0 ? inRound : order.length - 1 - inRound].teamId;
};

const picks: BoardPick[] = TAKEN.map(([name, clubShortName, position], index) => ({
  pick: index + 1,
  teamId: teamAt(index + 1),
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

export const previewDraft: DraftSeam = {
  useDraft: () => draft,
  useBoard: () => ({ picks, yourTeamId: YOURS, pickSeconds: 90 }),
  useInMenu: () => true,
};
