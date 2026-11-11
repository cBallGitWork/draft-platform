import { Link } from "@tanstack/react-router";
import { useState, type DragEvent, type KeyboardEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { SCOUTING_PATH } from "../frame/menu";
import { ClubShort } from "../ui/ClubName";
import { useChange } from "../shared/useChange";
import { Loading, Panel, PanelNote, Problem, Status } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import type { DraftList, DraftLists, DraftSeam } from "./seam";
import {
  addWholeShortlistWords,
  DO_NOT_DRAFT_TITLE,
  doNotDraftAside,
  doNotDraftListLabel,
  emptyQueueWords,
  fromShortlistWords,
  loadingListsWords,
  moveLabel,
  QUEUE_TITLE,
  queueAside,
  queueListLabel,
  shortlistAddedWords,
  takeOffLabel,
} from "./words";

// The draft room's queue and do-not-draft list (spec/04, The queue and the ranking; #1100), in the
// right-hand column as the approved picture has them: the queue first choice first, a row dragged
// to reorder it (or moved a place with the arrow keys on its handle), the cross taking a player
// off; the shortlist feeding it, a link to Scouting's shortlist and "Add my whole shortlist" (Craig,
// 5 Nov 2026, on #1100); and under it the do-not-draft list, the cross taking a player off. A
// player is put on either list from his panel (PickPanel.tsx; #1474). Private to the manager: nothing shows for
// someone who runs no team.

type Listed = DraftLists["queue"][number];

export function QueuePanel({ leagueId, seam }: { leagueId: Id<"leagues">; seam: DraftSeam }) {
  const lists = seam.useLists(leagueId);
  const changes = seam.useListChanges();
  const change = useChange();
  const [added, setAdded] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  if (lists === null) return null;

  const run = (make: () => Promise<string | null>) => {
    setAdded(null);
    void change.run(make);
  };
  const remove = (player: Listed, list: DraftList) => run(() => changes.remove(leagueId, player.code, list));
  const moveTo = (code: number, place: number) => run(() => changes.move(leagueId, code, place));
  const addShortlist = () => {
    setAdded(null);
    void change.run(async () => {
      const answer = await changes.addShortlist(leagueId);
      if (typeof answer === "string") return answer;
      setAdded(shortlistAddedWords(answer.added, answer.leftOut));
      return null;
    });
  };

  return (
    <Panel title={QUEUE_TITLE} aside={lists && <span className="text-soft">{queueAside(lists.queue.length)}</span>}>
      <Problem problem={change.problem} />
      {lists === undefined ? (
        <Loading className="px-3 py-2">{loadingListsWords}</Loading>
      ) : (
        <>
          {lists.queue.length === 0 ? (
            <PanelNote>{emptyQueueWords}</PanelNote>
          ) : (
            <ol aria-label={queueListLabel}>
              {lists.queue.map((player, index) => (
                <QueueRow
                  key={player.code}
                  player={player}
                  place={index + 1}
                  last={index === lists.queue.length - 1}
                  busy={change.busy}
                  onDragStart={() => setDragging(player.code)}
                  onDragEnd={() => setDragging(null)}
                  onDrop={() => {
                    if (dragging !== null && dragging !== player.code) moveTo(dragging, index + 1);
                    setDragging(null);
                  }}
                  onMove={(place) => moveTo(player.code, place)}
                  onRemove={() => remove(player, "queue")}
                />
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-panel-rule px-3 py-1">
            <Link to={SCOUTING_PATH} className="inline-flex min-h-tap items-center">
              {fromShortlistWords} ▸
            </Link>
            <button type="button" disabled={change.busy} onClick={addShortlist} className="secondary-action">
              {addWholeShortlistWords}
            </button>
          </div>
          <Status words={added} className="px-3 py-1 text-soft" />
          <DoNotDraft players={lists.doNotDraft} busy={change.busy} onRemove={(player) => remove(player, "doNotDraft")} />
        </>
      )}
    </Panel>
  );
}

/** One queued player: his handle, his place, his position, name and club, and the cross. */
function QueueRow({
  player,
  place,
  last,
  busy,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onRemove,
}: {
  player: Listed;
  place: number;
  last: boolean;
  busy: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (place: number) => void;
  onRemove: () => void;
}) {
  const allowDrop = (event: DragEvent) => event.preventDefault();
  const drop = (event: DragEvent) => {
    event.preventDefault();
    onDrop();
  };
  const startDrag = (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(player.code));
    onDragStart();
  };
  const keyMove = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" && place > 1) onMove(place - 1);
    else if (event.key === "ArrowDown" && !last) onMove(place + 1);
    else return;
    event.preventDefault();
  };
  return (
    <li draggable={!busy} onDragStart={startDrag} onDragEnd={onDragEnd} onDragOver={allowDrop} onDrop={drop} className="flex items-center gap-2 border-t border-panel-rule pr-1">
      <button type="button" disabled={busy} onKeyDown={keyMove} aria-label={moveLabel(player.name, place)} className="min-h-tap min-w-tap cursor-grab text-muted">
        ⠿
      </button>
      <span className="w-6 text-right text-soft">{place}</span>
      <ListedName player={player} />
      <TakeOff name={player.name} list="queue" busy={busy} onRemove={onRemove} />
    </li>
  );
}

/** A listed player's position chip, name and club. */
function ListedName({ player }: { player: Listed }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {player.position !== null && <PositionChip label={player.position} />}
      <span className="truncate font-semibold" title={player.fullName}>
        {player.name}
      </span>
      <ClubShort club={player.club} className="text-muted" />
    </span>
  );
}

function TakeOff({ name, list, busy, onRemove }: { name: string; list: DraftList; busy: boolean; onRemove: () => void }) {
  return (
    <button type="button" disabled={busy} onClick={onRemove} aria-label={takeOffLabel(name, list)} className="min-h-tap min-w-tap text-soft">
      ✕
    </button>
  );
}

/** The do-not-draft list, by name, under the queue: auto-pick never takes from it. */
function DoNotDraft({ players, busy, onRemove }: { players: readonly Listed[]; busy: boolean; onRemove: (player: Listed) => void }) {
  return (
    <section aria-label={DO_NOT_DRAFT_TITLE}>
      <h3 className="flex items-baseline justify-between bg-ground px-3 py-1">
        <span className="font-semibold">{DO_NOT_DRAFT_TITLE}</span>
        <span className="text-soft">{doNotDraftAside(players.length)}</span>
      </h3>
      {players.length > 0 && (
        <ul aria-label={doNotDraftListLabel}>
          {players.map((player) => (
            <li key={player.code} className="flex items-center gap-2 border-t border-panel-rule pr-1 pl-12">
              <ListedName player={player} />
              <TakeOff name={player.name} list="doNotDraft" busy={busy} onRemove={() => onRemove(player)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
