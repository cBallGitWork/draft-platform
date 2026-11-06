// The draft room's queue, do-not-draft list and auto-pick in the preview (./preview.ts), as the
// approved picture has them: six queued, two not to draft, one timeout of two. A change lasts the
// session, and Scouting's shortlist (../scouting/preview.ts) adds to the same queue.

import { useSyncExternalStore } from "react";
import type { Position } from "../../convex/positions/positionTables";
import type { ListedPlayer } from "../../convex/scouting/playersList";
import type { DraftBoard, DraftListChanges, DraftLists, DraftSeam } from "./seam";

type Listed = DraftLists["queue"][number];

const club = (code: number, name: string, shortName: string) => ({ code, name, shortName });
const listed = (code: number, name: string, fullName: string, playerClub: Listed["club"], position: Position): Listed => ({
  code,
  name,
  fullName,
  club: playerClub,
  ownerTeamName: null,
  gone: false,
  position,
});
const NEWCASTLE = club(4, "Newcastle", "NEW");

let lists: DraftLists = {
  queue: [
    listed(8101, "B. Fernandes", "Bruno Fernandes", club(1, "Man Utd", "MUN"), "CAM"),
    listed(8102, "Mitoma", "Kaoru Mitoma", club(2, "Brighton", "BHA"), "W"),
    listed(8103, "Kudus", "Mohammed Kudus", club(3, "Spurs", "TOT"), "W"),
    listed(8104, "Tonali", "Sandro Tonali", NEWCASTLE, "CDM"),
    listed(8105, "Pope", "Nick Pope", NEWCASTLE, "GK"),
    listed(8106, "Senesi", "Marcos Senesi", club(5, "Bournemouth", "BOU"), "CB"),
  ],
  doNotDraft: [listed(8107, "Paquetá", "Lucas Paquetá", club(6, "West Ham", "WHU"), "CAM"), listed(8108, "Rodon", "Joe Rodon", club(7, "Leeds", "LEE"), "CB")],
};
let autoPick: NonNullable<DraftBoard["yourAutoPick"]> = { on: false, timeouts: 1, limit: 2 };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const changed = () => {
  for (const listener of listeners) listener();
};

/** Puts `players` at the bottom of the preview's queue, taking them off the do-not-draft list; one
 *  already queued keeps his place. Returns how many went in. */
export function queueInPreview(players: readonly Listed[]): number {
  const adding = players.filter((player) => !lists.queue.some((each) => each.code === player.code));
  const codes = new Set(adding.map(({ code }) => code));
  lists = { queue: [...lists.queue, ...adding], doNotDraft: lists.doNotDraft.filter(({ code }) => !codes.has(code)) };
  changed();
  return adding.length;
}

/** The preview's auto-pick, live (a hook), for its board. */
export const usePreviewAutoPick = () => useSyncExternalStore(subscribe, () => autoPick);

const setAutoPick = (on: boolean) => {
  autoPick = on ? { ...autoPick, on } : { ...autoPick, on, timeouts: 0 };
  changed();
  return Promise.resolve(null);
};

/** A Scouting player as the queue lists him. */
export const listedFromScouting = ({ code, name, fullName, club: playerClub, ownerTeamName, positions }: ListedPlayer): Listed => ({
  code,
  name,
  fullName,
  club: playerClub,
  ownerTeamName,
  gone: false,
  position: positions[0] ?? null,
});

/** The players "Add my whole shortlist" adds in the preview, which Scouting's preview sets: its
 *  shortlist's players to begin with. */
let shortlisted: readonly Listed[] = [];
export const setPreviewShortlisted = (players: readonly ListedPlayer[]) => {
  shortlisted = players.filter(({ ownerTeamName }) => ownerTeamName === null).map(listedFromScouting);
};

const changes: DraftListChanges = {
  remove: async (_leagueId, playerCode, list) => {
    lists = { ...lists, [list]: lists[list].filter(({ code }) => code !== playerCode) };
    changed();
    return null;
  },
  move: async (_leagueId, playerCode, place) => {
    const moving = lists.queue.find(({ code }) => code === playerCode)!;
    const rest = lists.queue.filter((each) => each !== moving);
    lists = { ...lists, queue: [...rest.slice(0, place - 1), moving, ...rest.slice(place - 1)] };
    changed();
    return null;
  },
  addShortlist: async () => ({ added: queueInPreview([...shortlisted].sort((one, other) => one.name.localeCompare(other.name))), leftOut: 0 }),
  turnOnAutoPick: () => setAutoPick(true),
  takeControlBack: () => setAutoPick(false),
};

export const previewLists: Pick<DraftSeam, "useLists" | "useListChanges"> = {
  useLists: () => useSyncExternalStore(subscribe, () => lists),
  useListChanges: () => changes,
};
