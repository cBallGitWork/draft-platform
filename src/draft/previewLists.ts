// The draft room's queue, do-not-draft list and auto-pick in the preview (./preview.ts), as the
// approved picture has them: six queued, two not to draft, one timeout of two. A change lasts the
// session, and Scouting's shortlist (../scouting/preview.ts) adds to the same queue.

import { useSyncExternalStore } from "react";
import { cardOpensAt } from "../../convex/playerCard/cardPoints";
import type { Position } from "../../convex/positions/positionTables";
import type { ListedPlayer } from "../../convex/scouting/playersList";
import { previewClub, previewSaves } from "../shared/preview";
import type { DraftBoard, DraftList, DraftListChanges, DraftLists, DraftSeam } from "./seam";

type Listed = DraftLists["queue"][number];

const listed = (code: number, name: string, fullName: string, playerClub: Listed["club"], position: Position): Listed => ({
  code,
  name,
  fullName,
  club: playerClub,
  ownerTeamName: null,
  gone: false,
  position,
});
const NEWCASTLE = previewClub("NEW");

let lists: DraftLists = {
  queue: [
    listed(8101, "B. Fernandes", "Bruno Fernandes", previewClub("MUN"), "CAM"),
    listed(8102, "Mitoma", "Kaoru Mitoma", previewClub("BHA"), "W"),
    listed(8103, "Kudus", "Mohammed Kudus", previewClub("TOT"), "W"),
    listed(8104, "Tonali", "Sandro Tonali", NEWCASTLE, "CDM"),
    listed(8105, "Pope", "Nick Pope", NEWCASTLE, "GK"),
    listed(8106, "Senesi", "Marcos Senesi", previewClub("BOU"), "CB"),
  ],
  doNotDraft: [listed(8107, "Paquetá", "Lucas Paquetá", previewClub("WHU"), "CAM"), listed(8108, "Rodon", "Joe Rodon", previewClub("LEE"), "CB")],
};
/** The players the queue and the do-not-draft list start with: the draft room's players list
 *  holds them too, as a queue holds only players still to draft (#1969). */
export const previewListsPlayers: readonly Listed[] = [...lists.queue, ...lists.doNotDraft];
let autoPick: NonNullable<DraftBoard["yourAutoPick"]> = { on: false, timeouts: 1, limit: 2 };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const changed = () => {
  for (const listener of listeners) listener();
};

/** Puts `players` at the bottom of the preview's queue, or on its do-not-draft list (by name, as
 *  the server keeps it), taking them off the other; one already on it keeps his place. Returns how
 *  many went in. */
export function listInPreview(players: readonly Listed[], list: DraftList = "queue"): number {
  const adding = players.filter((player) => !lists[list].some((each) => each.code === player.code));
  const codes = new Set(adding.map(({ code }) => code));
  const notAdding = ({ code }: Listed) => !codes.has(code);
  lists =
    list === "queue"
      ? { queue: [...lists.queue, ...adding], doNotDraft: lists.doNotDraft.filter(notAdding) }
      : { queue: lists.queue.filter(notAdding), doNotDraft: [...lists.doNotDraft, ...adding].sort((one, another) => one.name.localeCompare(another.name)) };
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
  position: cardOpensAt(positions),
});

/** The players "Add my whole shortlist" adds in the preview, which Scouting's preview sets: its
 *  shortlist's players to begin with. */
let shortlisted: readonly Listed[] = [];
export const setPreviewShortlisted = (players: readonly ListedPlayer[]) => {
  shortlisted = players.filter(({ ownerTeamName }) => ownerTeamName === null).map(listedFromScouting);
};

/** Every player the preview lists, which Scouting's preview sets and the draft room's (./preview.ts)
 *  widens to its lists' players, for his panel's "Add to queue" and "Do not draft". */
let known: readonly ListedPlayer[] = [];
export const setPreviewPlayers = (players: readonly ListedPlayer[]) => {
  known = players;
};

const changes: DraftListChanges = {
  add: previewSaves(async (_leagueId: unknown, playerCode: number, list: DraftList) => {
    listInPreview([listedFromScouting(known.find(({ code }) => code === playerCode)!)], list);
    return null;
  }),
  remove: previewSaves(async (_leagueId: unknown, playerCode: number, list: DraftList) => {
    lists = { ...lists, [list]: lists[list].filter(({ code }) => code !== playerCode) };
    changed();
    return null;
  }),
  move: previewSaves(async (_leagueId: unknown, playerCode: number, place: number) => {
    const moving = lists.queue.find(({ code }) => code === playerCode)!;
    const rest = lists.queue.filter((each) => each !== moving);
    lists = { ...lists, queue: [...rest.slice(0, place - 1), moving, ...rest.slice(place - 1)] };
    changed();
    return null;
  }),
  addShortlist: async () => ({ added: listInPreview([...shortlisted].sort((one, other) => one.name.localeCompare(other.name))), leftOut: 0 }),
  turnOnAutoPick: previewSaves(() => setAutoPick(true)),
  takeControlBack: previewSaves(() => setAutoPick(false)),
};

export const previewLists: Pick<DraftSeam, "useLists" | "useListChanges"> = {
  useLists: () => useSyncExternalStore(subscribe, () => lists),
  useListChanges: () => changes,
};
