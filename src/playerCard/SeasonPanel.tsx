import type { ReactNode } from "react";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import { Choice } from "../ui/Choice";
import { PositionCode } from "../ui/PositionCodes";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { LiveNote, Panel, PANEL_BODY, PanelNote } from "../ui/Panel";
import type { PlayedMatch, PlayerCard } from "./seam";
import { MatchName } from "./MatchName";
import {
  adjustmentWords,
  basePointsNote,
  bestPositionNote,
  breakdownLabel,
  columns,
  figureWords,
  listSeparator,
  liveWords,
  noFigureWords,
  noMatchesWords,
  notArrivedWords,
  nothingEarnedWords,
  overriddenWords,
  pricedAtLabel,
  provisionalWords,
  roleLineLabel,
  roleMadeOfWords,
  SEASON_TITLE,
} from "./words";

type Column = keyof typeof columns;
const COLUMNS: readonly Column[] = ["gameweek", "match", "minutes", "position", "points"];
const FIGURES: readonly Column[] = ["gameweek", "minutes", "points"];
const cellClasses = (column: Column) => cellClassOf(!FIGURES.includes(column));

/** The switch's radio group's name. */
const PRICED_AT_CHOICE = "card-priced-at";

/** This season's matches at his base points, each with its points by category under it (spec/12;
 *  Craig, 31 Oct 2026), at the position the switch picks: a key for each position he has, opening
 *  on the first, and no switch with fewer than two. */
export function Season({ card }: { card: PlayerCard }) {
  const [chosen, choose] = useChoiceAmong(card.pricedAt);
  // Each match's points come in pricedAt's order; with no position priced, the one at his best.
  const shown = chosen === undefined ? 0 : card.pricedAt.indexOf(chosen);
  return (
    <Panel title={SEASON_TITLE}>
      {card.matches.length === 0 ? (
        <PanelNote>{noMatchesWords}</PanelNote>
      ) : (
        <>
          <PanelNote>{basePointsNote}</PanelNote>
          {card.pricedAt.length === 0 && <PanelNote>{bestPositionNote}</PanelNote>}
          {chosen !== undefined && card.pricedAt.length > 1 && (
            <div className={PANEL_BODY}>
              <Choice
                label={pricedAtLabel}
                name={PRICED_AT_CHOICE}
                options={card.pricedAt}
                words={(position) => position}
                chosen={chosen}
                onChoose={choose}
              />
            </div>
          )}
          {card.matches.some((match) => match.provisional) && <LiveNote>{provisionalWords}</LiveNote>}
          <table className="w-full border-collapse">
            <ColumnHeads columns={columns} shown={COLUMNS} classOf={cellClasses} />
            {card.matches.map((match) => (
              <MatchRows key={match.fixtureCode} match={match} shown={shown} />
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
 *  "Attacking full-back +2", and what made it, apart from his base points and never in them. Not
 *  shown under an override, the match's whole score. */
function RoleLine({ role }: { role: NonNullable<PlayedMatch["role"]> }) {
  return (
    <UnderRow tone="text-soft" label={roleLineLabel(role.name)}>
      {role.name} <span className="text-figure">{adjustmentWords(role.points)}</span>
      {role.lines.length > 0 && <span className="text-muted"> ({roleMadeOfWords(role.lines)})</span>}
    </UnderRow>
  );
}

/** One match at the `shown`th of its prices: its row of figures, the league's override in place of
 *  its points, and under it each category he earned or lost points in, his role's line and the
 *  override's reason. */
function MatchRows({ match, shown }: { match: PlayedMatch; shown: number }) {
  const { position, categories, total: base } = match.points[shown];
  const { override } = match;
  const total = override?.points ?? base;
  const earned = categories.filter((category): category is typeof category & { points: number } => category.points !== null && category.points !== 0);
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
          <td className={`${cellClasses("points")} font-bold text-figure`}>
            {figureWords(total)}
            {match.provisional && <span className="ml-1 font-normal text-derived">{liveWords}</span>}
          </td>
        )}
      </tr>
      {total !== null && (
        <UnderRow tone="text-soft" label={breakdownLabel(match.gameweek)}>
          {earned.length === 0
            ? nothingEarnedWords
            : earned.map((category, index) => (
                <span key={category.stat}>
                  {index > 0 && listSeparator}
                  {category.name} <span className="text-figure">{figureWords(category.points)}</span>
                </span>
              ))}
        </UnderRow>
      )}
      {total !== null && override === null && match.role !== undefined && <RoleLine role={match.role} />}
      {override !== null && (
        <UnderRow tone="text-event">{overriddenWords(override.points, override.reason)}</UnderRow>
      )}
    </tbody>
  );
}
