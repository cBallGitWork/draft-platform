import { useId, type ReactNode } from "react";
import { findLabel, findTitle, foundListLabel, noneFoundWords, searchingWords } from "../shared/words";
import { Loading, PANEL_BODY, Panel, PanelNote } from "./Panel";

/** The "Find a player" panel, on the admin's dashboard and the squads page alike: a name box,
 *  then "Searching…", the note that none was found, or the players found, each its caller's row.
 *  With a `hint` the label shows above the box and the hint under it; without, the label is
 *  for screen readers and the box is narrower. */
export function FindPlayerPanel<Player>({
  text,
  onText,
  found,
  hint,
  notice,
  children,
}: {
  text: string;
  onText: (text: string) => void;
  /** The players found for `text`; undefined while searching. */
  found: readonly Player[] | undefined;
  hint?: string;
  /** Shown above the box, such as a warning that the league has no teams. */
  notice?: ReactNode;
  /** One player's row, an `li` with its own key. */
  children: (player: Player) => ReactNode;
}) {
  const inputId = useId();
  const hintId = useId();
  return (
    <Panel title={findTitle}>
      {notice}
      <div className={PANEL_BODY}>
        <label htmlFor={inputId} className={hint === undefined ? "sr-only" : "font-semibold"}>
          {findLabel}
        </label>
        <input
          id={inputId}
          type="search"
          value={text}
          onChange={(event) => onText(event.target.value)}
          aria-describedby={hint === undefined ? undefined : hintId}
          className={hint === undefined ? "text-box max-w-sm" : "text-box"}
        />
        {hint !== undefined && (
          <p id={hintId} className="text-muted">
            {hint}
          </p>
        )}
      </div>
      {text.trim() !== "" &&
        (found === undefined ? (
          <Loading className="px-3 pb-2">{searchingWords}</Loading>
        ) : found.length === 0 ? (
          <PanelNote edge="b">{noneFoundWords}</PanelNote>
        ) : (
          <ul aria-label={foundListLabel} className="border-t border-panel-rule">
            {found.map(children)}
          </ul>
        ))}
    </Panel>
  );
}
