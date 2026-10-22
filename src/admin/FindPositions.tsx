import { useState } from "react";
import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { Loading, PanelTitle } from "../frame/Panel";
import type { Changing } from "../useChange";
import type { AdminSeam, FoundPlayerPositions } from "./seam";
import {
  findHint,
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
  unconfirmedWords,
} from "./words";

// Correcting any player's positions (spec/06): find him, then remove a position or set one, SS among them.

export function FindPlayer({ seam, change }: { seam: AdminSeam; change: Changing }) {
  const [text, setText] = useState("");
  const found = seam.useFoundPlayers(text);
  return (
    <section aria-labelledby="admin-find-title" className="bg-panel">
      <PanelTitle id="admin-find-title">{findTitle}</PanelTitle>
      <div className="flex flex-col gap-2 p-3">
        <label htmlFor="admin-find-name" className="font-semibold">
          {findLabel}
        </label>
        <input id="admin-find-name" type="search" value={text} onChange={(event) => setText(event.target.value)} className="text-box" />
        <p className="text-muted">{findHint}</p>
      </div>
      {text.trim() !== "" &&
        (found === undefined ? (
          <Loading className="px-3 pb-2">{searchingWords}</Loading>
        ) : found.length === 0 ? (
          <p className="px-3 pb-2 text-muted">{noneFoundWords}</p>
        ) : (
          <ul aria-label={foundListLabel} className="border-t border-panel-rule">
            {found.map((player) => (
              <PlayerPositions key={player.code} player={player} seam={seam} change={change} />
            ))}
          </ul>
        ))}
    </section>
  );
}

/** One player's positions: where each came from, whether it's confirmed; remove one, or set one. */
function PlayerPositions({ player, seam, change }: { player: FoundPlayerPositions; seam: AdminSeam; change: Changing }) {
  const held = new Set(player.positions.map((each) => each.position));
  const givable = POSITIONS.filter((position) => !held.has(position));
  const [chosen, choose] = useState<Position | undefined>(undefined);
  const position = chosen !== undefined && givable.includes(chosen) ? chosen : givable[0];
  const selectId = `give-${player.code}`;
  return (
    <li className="flex flex-col gap-1 border-b border-panel-rule px-3 py-2">
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
                  {each.confirmed ? "" : `, ${unconfirmedWords}`}
                </span>
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
