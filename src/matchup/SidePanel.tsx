import { Link } from "@tanstack/react-router";
import type { MatchupBenchSlot, MatchupSide, MatchupSlot, MatchupStarter } from "../../convex/matchup/matchupShape";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Panel, PanelNote } from "../ui/Panel";
import { matchPath } from "../premierLeague/paths";
import { formationOf } from "./formation";
import {
  AREA_CODES,
  AREA_WORDS,
  autoSubWords,
  averageWords,
  BENCH_TITLE,
  columns,
  figureWords,
  formationLabel,
  formationWords,
  leagueAverageWords,
  lineupLabel,
  noFigureWords,
  notCountingLabel,
  statusLabels,
  statusWords,
} from "./words";

// One side of a scored matchup (spec/10, The matchup, as a live match): its lineup slot by slot,
// each starter in his role, the bench under its own plate, and its formation on the panel's plate;
// or the league's average.

/** A side's name: its team's, or the league's average. */
export const sideName = (side: MatchupSide) => (side.kind === "team" ? side.teamName : leagueAverageWords);

/** A side's panel, under its name. */
export function SidePanel({ side }: { side: MatchupSide }) {
  const name = sideName(side);
  return (
    <Panel title={name} namesTeam={side.kind === "team"} aside={side.kind === "team" ? <Formation counts={formationOf(side.lineup)} /> : undefined}>
      {side.kind === "leagueAverage" ? (
        <PanelNote>{averageWords}</PanelNote>
      ) : (
        <table aria-label={lineupLabel(name)} className="w-full border-collapse">
          <ColumnHeads columns={columns} classOf={(column) => (column === "player" ? "px-2 text-left" : "px-2 text-right")} />
          <tbody>
            {side.lineup.starters.map((slot) => (
              <SlotRow key={slot.playerCode} slot={slot} />
            ))}
            <tr>
              <th colSpan={Object.keys(columns).length} scope="colgroup" className="bg-plate px-3 text-left font-bold shadow-bevel-plate">
                {BENCH_TITLE}
              </th>
            </tr>
            {side.lineup.bench.map((slot) => (
              <SlotRow key={slot.playerCode} slot={slot} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** The side's shape now, at the plate's far end: a reading worked out, so cyan (plate.md). Nothing
 *  while no one stands outfield. */
function Formation({ counts }: { counts: number[] }) {
  if (counts.length === 0) return null;
  return (
    <p className="font-bold text-derived">
      <span className="sr-only">{formationLabel} </span>
      {formationWords(counts)}
    </p>
  );
}

/** One man: greyed while his points don't count (spec/14, On screen), the role he plays under his
 *  name, as on the Tactics pitch (a bench player's once he has come on), his match's state, and
 *  what the auto-subs did with him. */
function SlotRow({ slot }: { slot: MatchupStarter | MatchupBenchSlot }) {
  const { area, name, role, points, counts, status, autoSub } = slot;
  return (
    <tr className={`border-t border-panel-rule align-top ${counts ? "" : "text-muted"}`}>
      <td className="px-2 text-right">
        <abbr title={AREA_WORDS[area]} className="no-underline">
          {AREA_CODES[area]}
        </abbr>
      </td>
      <th scope="row" className={`px-2 text-left font-semibold ${counts ? "text-lead" : ""}`}>
        {name}
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
          <Link to={matchPath(status.fixtureCode)} className="inline-flex min-h-tap items-center text-inherit lg:min-h-0">
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

function statusText(status: MatchupSlot["status"]): string {
  switch (status.kind) {
    case "yetToPlay":
      return statusWords.yetToPlay(status.kickoff);
    case "playing":
      return statusWords.playing(status.state, status.clockLabel, status.minute);
    case "finished":
      return statusWords.finished;
    case "noMatch":
      return statusWords.noMatch;
  }
}
