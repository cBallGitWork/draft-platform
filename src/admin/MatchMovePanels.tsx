import { useState, type FormEvent } from "react";
import { Loading, Notice, PANEL_BODY, PANEL_LIST_ROW, Panel, PanelNote } from "../ui/Panel";
import { whenWords } from "../shared/words";
import { NumberField } from "./fields";
import type { PanelProps } from "./panelProps";
import type { GameweekMatch } from "./seam";
import {
  clearMoveLabel,
  clearMoveWords,
  gameweekMatchesLoadingWords,
  moreMovesWords,
  movedFromWords,
  moveGameweekLabel,
  moveLogLoadingWords,
  moveLogTitle,
  moveLogWords,
  moveMatchTitle,
  moveToLabel,
  moveWords,
  noGameweekMatchesWords,
  noKickoffWords,
  noMovesWords,
} from "./words";

// The admin moves a match to another gameweek, and clears his move (#1417; spec/07 S07.9: "The
// admin can move a match"), the server warning him when a deadline lands badly; and his log of
// moves, which only he sees (spec/15). The dashboard has no approved picture: these copy its
// other panels.

type MovePanelProps = Omit<PanelProps, "queue">;

/** A whole gameweek number typed, or null for none. */
const gameweekTyped = (typed: string) => (/^\d+$/.test(typed.trim()) ? Number(typed) : null);

export function MoveMatch({ seam, change }: MovePanelProps) {
  const [typed, setTyped] = useState("");
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const gameweek = gameweekTyped(typed);
  const matches = seam.useGameweekMatches(gameweek);
  /** Moves the match, or with null clears his move, keeping the server's warnings to show. */
  function moveTo(fixtureCode: number, to: number | null) {
    setWarnings([]);
    void change.run(async () => {
      const answer = await seam.moveMatch(fixtureCode, to);
      if (typeof answer === "string") return answer;
      setWarnings(answer.warnings);
      return null;
    });
  }
  return (
    <Panel title={moveMatchTitle}>
      <div className={PANEL_BODY}>
        <NumberField id="move-gameweek" label={moveGameweekLabel} value={typed} onChange={setTyped} />
        {warnings.map((warning) => (
          <Notice key={warning}>{warning}</Notice>
        ))}
      </div>
      {gameweek === null ? null : matches === undefined ? (
        <Loading className="p-3">{gameweekMatchesLoadingWords}</Loading>
      ) : matches.length === 0 ? (
        <PanelNote edge="b">{noGameweekMatchesWords}</PanelNote>
      ) : (
        <ul aria-label={moveMatchTitle} className="border-t border-panel-rule">
          {matches.map((match) => (
            <MatchRow key={match.fixtureCode} match={match} busy={change.busy} moveTo={moveTo} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MatchRow({ match, busy, moveTo }: { match: GameweekMatch; busy: boolean; moveTo: (fixtureCode: number, to: number | null) => void }) {
  const [to, setTo] = useState("");
  const toGameweek = gameweekTyped(to);
  function move(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (toGameweek !== null) moveTo(match.fixtureCode, toGameweek);
  }
  return (
    <li className={PANEL_LIST_ROW}>
      <span className="font-semibold">{match.match}</span>
      <span className="text-event">{match.kickoff === null ? noKickoffWords : whenWords(match.kickoff)}</span>
      {match.move !== null && <span className="text-event">{movedFromWords(match.move.unmoved)}</span>}
      <form onSubmit={move} className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          aria-label={moveToLabel(match.match)}
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="text-box w-wide-number-box"
        />
        <button type="submit" disabled={busy || toGameweek === null} className="secondary-action">
          {moveWords}
        </button>
        {match.move !== null && (
          <button type="button" disabled={busy} onClick={() => moveTo(match.fixtureCode, null)} className="secondary-action" aria-label={clearMoveLabel(match.match)}>
            {clearMoveWords}
          </button>
        )}
      </form>
    </li>
  );
}

/** His moves and clears, newest first: for his eyes only (spec/15). */
export function MoveLog({ seam }: Pick<PanelProps, "seam">) {
  const log = seam.useMatchMoveLog();
  return (
    <Panel title={moveLogTitle}>
      {log === undefined ? (
        <Loading className="p-3">{moveLogLoadingWords}</Loading>
      ) : log.rows.length === 0 ? (
        <PanelNote>{noMovesWords}</PanelNote>
      ) : (
        <ul aria-label={moveLogTitle}>
          {log.rows.map((row) => (
            <li key={`${row.fixtureCode}-${row.at}`} className={PANEL_LIST_ROW}>
              <span className="font-semibold">{row.match}</span>
              <span>{moveLogWords(row)}</span>
              <span className="text-event">{whenWords(row.at)}</span>
            </li>
          ))}
        </ul>
      )}
      {log?.more === true && <PanelNote edge="b">{moreMovesWords(log.rows.length)}</PanelNote>}
    </Panel>
  );
}
