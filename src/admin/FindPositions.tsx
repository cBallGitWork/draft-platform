import { useState } from "react";
import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { Loading, PANEL_BODY, PANEL_LIST_ROW, Panel, PanelNote } from "../frame/Panel";
import type { Changing } from "../useChange";
import { useChoiceAmong } from "../useChoiceAmong";
import type { AdminSeam, FoundPlayerPositions } from "./seam";
import {
  findHint,
  flaggedNote,
  foundListLabel,
  positionsListLabel,
  removeWords,
  findLabel,
  findTitle,
  noneFoundWords,
  noPositionsWords,
  removeLabel,
  searchingWords,
  setLabel,
  setWords,
  sourceWords,
  unconfirmedNote,
} from "./words";

const FIND_NAME_ID = "admin-find-name";
const FIND_HINT_ID = "admin-find-hint";

// Correcting any player's positions (spec/06): find him, then remove a position or set one, SS among them.

export function FindPlayer({ seam, change }: { seam: AdminSeam; change: Changing }) {
  const [text, setText] = useState("");
  const found = seam.useFoundPlayers(text);
  return (
    <Panel title={findTitle}>
      <div className={PANEL_BODY}>
        <label htmlFor={FIND_NAME_ID} className="font-semibold">
          {findLabel}
        </label>
        <input
          id={FIND_NAME_ID}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby={FIND_HINT_ID}
          className="text-box"
        />
        <p id={FIND_HINT_ID} className="text-muted">
          {findHint}
        </p>
      </div>
      {text.trim() !== "" &&
        (found === undefined ? (
          <Loading className="px-3 pb-2">{searchingWords}</Loading>
        ) : found.length === 0 ? (
          <PanelNote edge="b">{noneFoundWords}</PanelNote>
        ) : (
          <ul aria-label={foundListLabel} className="border-t border-panel-rule">
            {found.map((player) => (
              <PlayerPositions key={player.code} player={player} seam={seam} change={change} />
            ))}
          </ul>
        ))}
    </Panel>
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
