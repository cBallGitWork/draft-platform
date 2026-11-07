import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Change } from "../../shared/refusal";
import { Loading, Panel, PanelNote, Problem, Status } from "../../ui/Panel";
import { playerCardPath } from "../../playerCard/paths";
import { useChange } from "../../shared/useChange";
import { OwnerName } from "../../ui/OwnerName";
import { ClubShort } from "../../premierLeague/ClubName";
import type { QueueFromShortlist, ShortlistSeam } from "./seam";
import {
  addToQueueNamedLabel,
  addToQueueWords,
  queuedWords,
  emptyShortlistWords,
  goneWords,
  loadingShortlistWords,
  removeNamedLabel,
  SHORTLIST_TITLE,
  shortlistListLabel,
  takeOffWords,
} from "./words";

/** The manager's own shortlist (spec/19, The shortlist), on Scouting: each player by name, opening
 *  his card, with his club and who owns him, a button putting him at the bottom of the draft queue
 *  (spec/04; Craig, 5 Nov 2026, on #1100), and one taking him off. A player is added from his card.
 *  Nothing shows for someone in the league who runs no team, who has none. */
export function ShortlistPanel({ leagueId, seam }: { leagueId: Id<"leagues">; seam: ShortlistSeam & QueueFromShortlist }) {
  const players = seam.useShortlist(leagueId);
  const changes = seam.useShortlistChanges();
  const addToQueue = seam.useAddToQueue();
  const change = useChange();
  const [done, setDone] = useState<string | null>(null);
  if (players === null) return null;
  /** Makes the change, saying `made` once it is. */
  const run = async (make: () => Change, made: string | null) => {
    setDone(null);
    if (await change.run(make)) setDone(made);
  };
  return (
    <Panel title={SHORTLIST_TITLE}>
      <Problem problem={change.problem} />
      {players === undefined ? (
        <Loading className="px-3 py-2">{loadingShortlistWords}</Loading>
      ) : players.length === 0 ? (
        <PanelNote>{emptyShortlistWords}</PanelNote>
      ) : (
        <ul aria-label={shortlistListLabel}>
          {players.map((player) => (
            <li key={player.code} className="flex items-center justify-between gap-2 border-t border-panel-rule px-3 py-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <Link to={playerCardPath(leagueId, player.code)} title={player.fullName} className="inline-flex min-h-tap min-w-tap items-center font-semibold">
                  {player.name}
                </Link>
                <ClubShort club={player.club} className="text-muted" />
                {player.gone ? (
                  <span className="text-event">{goneWords}</span>
                ) : (
                  <OwnerName teamName={player.ownerTeamName} />
                )}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={change.busy}
                  onClick={() => void run(() => addToQueue(leagueId, player.code), queuedWords(player.name))}
                  className="secondary-action"
                  aria-label={addToQueueNamedLabel(player.name)}
                >
                  {addToQueueWords}
                </button>
                <button
                  type="button"
                  disabled={change.busy}
                  onClick={() => void run(() => changes.remove(leagueId, player.code), null)}
                  className="secondary-action"
                  aria-label={removeNamedLabel(player.name)}
                >
                  {takeOffWords}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {players !== undefined && players.length > 0 && <Status words={done} className="px-3 py-1 text-soft" />}
    </Panel>
  );
}
