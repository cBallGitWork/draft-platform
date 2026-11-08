import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { RunsSwitch } from "../myTeam/tactics/TacticsControls";
import { SidePitch } from "./SidePitch";
import type { MatchupBenchSlot, MatchupSide, MatchupSlot, MatchupStarter } from "../../convex/matchup/matchupShape";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Panel, PanelNote } from "../ui/Panel";
import { matchPath } from "../premierLeague/paths";
import {
  AREA_CODES,
  AREA_WORDS,
  autoSubWords,
  averageWords,
  BENCH_TITLE,
  columns,
  figureWords,
  leagueAverageWords,
  lineupLabel,
  noFigureWords,
  notCountingLabel,
  openBreakdownLabel,
  statusLabels,
  statusText,
} from "./words";

// One side of a scored matchup (spec/10, The matchup, as a live match): its pitch, each man at his
// slot with its label, his role and its run (./SidePitch.tsx; #850), then its lineup slot by slot,
// each starter in his role, the bench under its own plate; or the league's average.

/** A side's name: its team's, or the league's average. */
export const sideName = (side: MatchupSide) => (side.kind === "team" ? side.teamName : leagueAverageWords);

/** Which man's breakdown is open, if any, and opening another's. */
export type Picking = { picked: number | null; pick(playerCode: number): void };

/** A side's panel, under its name: tapping a man opens his breakdown (#798). Its pitch's runs show
 *  until its own switch hides them, one on each side as the approved picture has it (spec/05 Runs). */
export function SidePanel({ side, picking }: { side: MatchupSide; picking: Picking }) {
  const name = sideName(side);
  const [runsShown, setRunsShown] = useState(true);
  return (
    <Panel title={name} namesTeam={side.kind === "team"} aside={side.kind === "team" ? <RunsSwitch shown={runsShown} onChange={setRunsShown} /> : undefined}>
      {side.kind === "leagueAverage" ? (
        <PanelNote>{averageWords}</PanelNote>
      ) : (
        <>
          <SidePitch side={side} picked={picking.picked} runsShown={runsShown} />
          <table aria-label={lineupLabel(name)} className="w-full border-collapse">
            <ColumnHeads columns={columns} classOf={(column) => (column === "player" ? "px-2 text-left" : "px-2 text-right")} />
            <tbody>
              {side.lineup.starters.map((slot) => (
                <SlotRow key={slot.playerCode} slot={slot} picking={picking} />
              ))}
              <tr>
                <th colSpan={Object.keys(columns).length} scope="colgroup" className="bg-plate px-3 text-left font-bold shadow-bevel-plate">
                  {BENCH_TITLE}
                </th>
              </tr>
              {side.lineup.bench.map((slot) => (
                <SlotRow key={slot.playerCode} slot={slot} picking={picking} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}

/** One man: greyed while his points don't count (spec/14, On screen), the role he plays under his
 *  name, as on the Tactics pitch (a bench player's once he has come on), his match's state, and
 *  what the auto-subs did with him. */
function SlotRow({ slot, picking }: { slot: MatchupStarter | MatchupBenchSlot; picking: Picking }) {
  const { playerCode, area, name, role, points, counts, status, autoSub } = slot;
  return (
    <tr className={`border-t border-panel-rule align-top ${counts ? "" : "text-muted"}`}>
      <td className="px-2 text-right">
        <abbr title={AREA_WORDS[area]} className="no-underline">
          {AREA_CODES[area]}
        </abbr>
      </td>
      <th scope="row" className={`px-2 text-left font-semibold ${counts ? "text-lead" : ""}`}>
        <button
          type="button"
          aria-expanded={picking.picked === playerCode}
          aria-label={openBreakdownLabel(name)}
          onClick={() => picking.pick(playerCode)}
          className="inline-flex min-h-tap min-w-tap items-center text-inherit text-align-inherit font-semibold lg:min-h-0 lg:min-w-0"
        >
          {name}
        </button>
        {role !== null && <span className={`block text-data font-normal ${counts ? "text-soft" : ""}`}>{role.name}</span>}
        {autoSub !== null && (
          <span className={`block text-data font-normal ${autoSub.kind === "on" ? "text-derived" : "text-muted"}`}>
            {autoSub.kind === "unreplaced" ? autoSubWords.unreplaced : autoSubWords[autoSub.kind](autoSub.playerName)}
          </span>
        )}
      </th>
      <td className={`px-2 text-right whitespace-nowrap ${status.kind === "playing" ? "text-derived" : ""}`}>
        {status.kind === "noMatch" ? (
          <StatusWords status={status} />
        ) : (
          // His match's page (spec/10, The match page), opened from his status.
          <Link to={matchPath(status.fixtureCode)} className="inline-flex min-h-tap min-w-tap items-center justify-end text-inherit lg:min-h-0 lg:min-w-0">
            <StatusWords status={status} />
          </Link>
        )}
      </td>
      <td className={`px-2 text-right ${counts && points !== null ? "font-bold text-figure" : "text-muted"}`}>
        {points === null ? noFigureWords : figureWords(points)}
        {!counts && <span className="sr-only"> {notCountingLabel}</span>}
      </td>
    </tr>
  );
}

/** His match's state, short, with the full words for screen readers. */
function StatusWords({ status }: { status: MatchupSlot["status"] }) {
  // "HT" is said in full, as "FT" is.
  const atHalfTime = status.kind === "playing" && status.state === "halfTime";
  return (
    <>
      {/* The space between, not inside the hidden words, so a link's name keeps it. */}
      <span className="sr-only">{atHalfTime ? statusLabels.halfTime : statusLabels[status.kind]}</span>{" "}
      <span aria-hidden={atHalfTime || status.kind === "finished" || status.kind === "noMatch" ? true : undefined}>{statusText(status)}</span>
    </>
  );
}
