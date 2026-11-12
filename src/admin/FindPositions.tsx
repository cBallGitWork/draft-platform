import { useState } from "react";
import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { FindPlayerPanel } from "../ui/FindPlayerPanel";
import { PANEL_LIST_ROW } from "../ui/Panel";
import type { Changing } from "../shared/useChange";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import type { AdminSeam, FoundPlayerPositions } from "./seam";
import {
  findHint,
  flaggedNote,
  positionsListLabel,
  removeWords,
  noPositionsWords,
  removeLabel,
  setLabel,
  setWords,
  sourceWords,
  unconfirmedNote,
} from "./words";

// Correcting any player's positions (spec/06): find him, then remove a position or set one, SS among them.

export function FindPlayer({ seam, change }: { seam: AdminSeam; change: Changing }) {
  const [text, setText] = useState("");
  const found = seam.useFoundPlayers(text);
  return (
    <FindPlayerPanel text={text} onText={setText} found={found} hint={findHint}>
      {(player) => <PlayerPositions key={player.code} player={player} seam={seam} change={change} />}
    </FindPlayerPanel>
  );
}

/** One player's positions: where each came from, whether it's confirmed; remove one, or set one. */
function PlayerPositions({ player, seam, change }: { player: FoundPlayerPositions; seam: AdminSeam; change: Changing }) {
  const held = new Set(player.positions.map((each) => each.position));
  const givable = POSITIONS.filter((position) => !held.has(position));
  const [position, choose] = useChoiceAmong(givable);
  const selectId = `give-${player.code}`;
  return (
    <li className={PANEL_LIST_ROW}>
      <span className="text-lead font-semibold">{player.fullName}</span>
      {player.positions.length === 0 ? (
        <span className="text-muted">{noPositionsWords}</span>
      ) : (
        <ul aria-label={positionsListLabel(player.name)} className="flex flex-col gap-1">
          {player.positions.map((each) => (
            <li key={each.position} className="flex items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{each.position}</span>{" "}
                <span className="text-muted">
                  {sourceWords[each.source]}
                  {each.confirmed ? "" : unconfirmedNote}
                </span>
                {each.flaggedElsewhere !== null && <span className="text-event">{flaggedNote(each.flaggedElsewhere)}</span>}
              </span>
              <button
                type="button"
                disabled={change.busy}
                onClick={() => void change.run(() => seam.removePosition(player.code, each.position))}
                className="secondary-action"
                aria-label={removeLabel(each.position, player.name)}
              >
                {removeWords}
              </button>
            </li>
          ))}
        </ul>
      )}
      {position !== undefined && (
        <span className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            {setLabel(player.name)}
          </label>
          <select id={selectId} value={position} onChange={(event) => choose(event.target.value as Position)} className="text-box">
            {givable.map((each) => (
              <option key={each} value={each}>
                {each}
              </option>
            ))}
          </select>
          <button type="button" disabled={change.busy} onClick={() => void change.run(() => seam.setPosition(player.code, position))} className="secondary-action">
            {setWords}
          </button>
        </span>
      )}
    </li>
  );
}
