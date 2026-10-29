import type { ReactNode } from "react";
import { PositionCode } from "../ui/PositionCodes";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { LiveNote, Panel, PanelNote } from "../ui/Panel";
import type { PlayedMatch, PlayerCard } from "./seam";
import { MatchName } from "./MatchName";
import {
  adjustmentWords,
  breakdownLabel,
  columns,
  listSeparator,
  liveWords,
  noFigureWords,
  noMatchesWords,
  notArrivedWords,
  notCountedWords,
  nothingEarnedWords,
  overriddenWords,
  pricedNotes,
  provisionalWords,
  roleLineLabel,
  roleMadeOfWords,
  SEASON_TITLE,
} from "./words";

type Column = keyof typeof columns;
const COLUMNS: readonly Column[] = ["gameweek", "match", "minutes", "position", "points"];
const FIGURES: readonly Column[] = ["gameweek", "minutes", "points"];
const cellClasses = (column: Column) => cellClassOf(!FIGURES.includes(column));

/** This season's matches, each with its points by category under it. */
export function Season({ card }: { card: PlayerCard }) {
  return (
    <Panel title={SEASON_TITLE}>
      {card.matches.length === 0 ? (
        <PanelNote>{noMatchesWords}</PanelNote>
      ) : (
        <>
          {/* A match his team started him in is priced at his slot, any other at his best position:
              each way the card prices says so. */}
          {[...new Set(card.matches.map((match) => match.points.scoredAs))].map((scoredAs) => (
            <PanelNote key={scoredAs}>{pricedNotes[scoredAs]}</PanelNote>
          ))}
          {card.matches.some((match) => match.provisional) && <LiveNote>{provisionalWords}</LiveNote>}
          <table className="w-full border-collapse">
            <ColumnHeads columns={columns} shown={COLUMNS} classOf={cellClasses} />
            {card.matches.map((match) => (
              <MatchRows key={match.fixtureCode} match={match} />
            ))}
          </table>
        </>
      )}
    </Panel>
  );
}

/** A line under a match, past the gameweek's column, in the given tone. */
function UnderRow({ tone, label, children }: { tone: string; label?: string; children: ReactNode }) {
  return (
    <tr>
      <td />
      <td colSpan={COLUMNS.length - 1} aria-label={label} className={`px-2 pb-1 ${tone}`}>
        {children}
      </td>
    </tr>
  );
}

/** Under a match his team started him in, what his role did to his points (spec/05 Roles):
 *  "Attacking full-back +2", and what made it. Not shown under an override, the match's whole score. */
function RoleLine({ role }: { role: NonNullable<PlayedMatch["points"]["role"]> }) {
  return (
    <UnderRow tone="text-soft" label={roleLineLabel(role.name)}>
      {role.name} <span className="text-figure">{adjustmentWords(role.points)}</span>
      {role.lines.length > 0 && <span className="text-muted"> ({roleMadeOfWords(role.lines)})</span>}
    </UnderRow>
  );
}

/** One match: its row of figures, the league's override in place of its points, and under it each
 *  category he earned or lost points in, and the override's reason. */
function MatchRows({ match }: { match: PlayedMatch }) {
  const { position, categories } = match.points;
  const { override } = match;
  const total = override?.points ?? match.points.total;
  const earned = categories.filter((category) => category.points !== null && category.points !== 0);
  // A bench player who didn't come on: his points greyed, as the matchup greys them (spec/14, On screen).
  const notCounted = match.points.scoredAs === "notCounted";
  return (
    <tbody className="border-t border-panel-rule">
      <tr>
        <td className={cellClasses("gameweek")}>{match.gameweek}</td>
        <th scope="row" className={`${cellClasses("match")} font-normal`}>
          <MatchName match={match} />
        </th>
        <td className={cellClasses("minutes")}>{match.minutes ?? noFigureWords}</td>
        <td className={cellClasses("position")}>
          {position === null ? noFigureWords : <PositionCode position={position} />}
        </td>
        {total === null ? (
          <td title={notArrivedWords} className={`${cellClasses("points")} text-muted`}>
            {noFigureWords}
          </td>
        ) : (
          <td className={`${cellClasses("points")} ${notCounted ? "text-muted" : "font-bold text-figure"}`}>
            {total}
            {match.provisional && <span className="ml-1 font-normal text-derived">{liveWords}</span>}
          </td>
        )}
      </tr>
      {notCounted && (
        <UnderRow tone="text-muted">{notCountedWords}</UnderRow>
      )}
      {total !== null && (
        <UnderRow tone="text-soft" label={breakdownLabel(match.gameweek)}>
          {earned.length === 0
            ? nothingEarnedWords
            : earned.map((category, index) => (
                <span key={category.stat}>
                  {index > 0 && listSeparator}
                  {category.name} <span className="text-figure">{category.points}</span>
                </span>
              ))}
        </UnderRow>
      )}
      {total !== null && override === null && match.points.role !== undefined && <RoleLine role={match.points.role} />}
      {override !== null && (
        <UnderRow tone="text-event">{overriddenWords(override.points, override.reason)}</UnderRow>
      )}
    </tbody>
  );
}
