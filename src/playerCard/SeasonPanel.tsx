import { useState } from "react";
import { STAT_CATALOGUE } from "../../convex/scoring/statCatalogueList";
import { MINUTES_STAT } from "../../convex/stats/matchRecords";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import { Choice } from "../ui/Choice";
import { cellClassOf, ColumnHeads, type ColumnWords } from "../ui/ColumnHeads";
import { Panel, PanelNote } from "../ui/Panel";
import type { PlayedMatch, PlayerCard } from "./seam";
import { MatchName } from "./MatchName";
import { opponentWords, type LogRow, logRowsOf, scoreOf } from "./gameLog";
import {
  columns,
  figureWords,
  LAST_SEASON_TITLE,
  lastSeasonNotHeldWords,
  lastSeasonWords,
  liveWords,
  logViewLabel,
  logViews,
  noFigureWords,
  noMatchesWords,
  notArrivedWords,
  notInLastSeasonWords,
  overriddenWasWords,
  postponedWords,
  pricedAtLabel,
  provisionalWords,
  SEASON_TITLE,
} from "./words";

/** The switches' radio groups' names. */
const PRICED_AT_CHOICE = "card-priced-at";
const LOG_VIEW_CHOICE = "card-log-view";
const LOG_VIEWS = ["scoring", "all"] as const;
type LogView = (typeof LOG_VIEWS)[number];

/** The card's switch (spec/12; Craig, 31 Oct 2026): which of his positions every figure on it is
 *  priced at, this season's and last season's alike (Craig, 6 Nov 2026), opening on the first.
 *  `shown` is its place in each match's points, which come in pricedAt's order; with no position
 *  priced, the one at his best. */
export function usePricedAt(card: PlayerCard) {
  const [chosen, choose] = useChoiceAmong(card.pricedAt);
  const shown = chosen === undefined ? 0 : card.pricedAt.indexOf(chosen);
  return { chosen, choose, shown };
}
type PricedAt =ReturnType<typeof usePricedAt>;

/** A stat's column: its key, and its head's words. */
type StatColumn = { stat: string; words: ColumnWords };

const CATALOGUE_ORDER = new Map(STAT_CATALOGUE.map((each, index) => [each.stat, index]));
const CATALOGUE_WORDS = new Map(STAT_CATALOGUE.map(({ stat, name, shortCode }) => [stat, { short: shortCode, long: name }]));

/** The game log's stat columns: under Scoring, each of the site's categories that scores at the
 *  position the switch is on, so a striker never sees CS (Craig, 7 Nov 2026: "just common sense");
 *  under All stats, every stat his records hold, in the catalogue's order. Minutes have their own. */
function statColumnsOf(card: PlayerCard, view: LogView, shown: number): StatColumn[] {
  if (view === "scoring") {
    return card.categories.filter((each) => each.scoresAt[shown]).map(({ stat, shortCode, name }) => ({ stat, words: { short: shortCode, long: name } }));
  }
  const held = new Set(card.matches.flatMap((match) => Object.keys(match.stats ?? {})));
  held.delete(MINUTES_STAT);
  return [...held]
    .toSorted((one, other) => (CATALOGUE_ORDER.get(one) ?? Infinity) - (CATALOGUE_ORDER.get(other) ?? Infinity) || one.localeCompare(other))
    .map((stat) => ({ stat, words: CATALOGUE_WORDS.get(stat) ?? { short: stat, long: stat } }));
}

/** A stat's figure in a match: under Scoring, how many the category counted; under All stats,
 *  what his record holds; a dash while his whole record hasn't arrived. */
function statFigure(match: PlayedMatch, view: LogView, shown: number, stat: string): string {
  if (view === "all") return match.stats === null ? noFigureWords : figureWords(match.stats[stat] ?? 0);
  const category = match.points[shown].categories.find((each) => each.stat === stat);
  return category === undefined || category.points === null ? noFigureWords : figureWords(category.why.actions);
}

const FIXED_LEFT = ["gameweek", "opponent"] as const;
const FIXED_RIGHT = ["score", "minutes"] as const;
const cellClasses = (left: boolean) => cellClassOf(left);

/** This season's matches as a game log, as FPL and Fantrax show it (spec/12): newest first, a row
 *  a match with his minutes, a column a stat and his base points, at the position the switch picks.
 *  A postponed match keeps its row. Pressing a match shows its breakdown in the right column;
 *  `selected` is the one shown. Last season's one line sits under it. */
export function Season({
  card,
  pricedAt: { chosen, choose, shown },
  selected,
  select,
}: {
  card: PlayerCard;
  pricedAt: PricedAt;
  selected: number | null;
  select: (fixtureCode: number) => void;
}) {
  const [view, setView] = useState<LogView>("scoring");
  const statColumns = statColumnsOf(card, view, shown);
  const rows = logRowsOf(card);
  const heads: Record<string, ColumnWords> = { ...columns, ...Object.fromEntries(statColumns.map(({ stat, words }) => [`stat:${stat}`, words])) };
  const shownHeads = [...FIXED_LEFT, ...FIXED_RIGHT, ...statColumns.map(({ stat }) => `stat:${stat}`), "points"];
  const switches = (
    <span className="flex flex-wrap items-center gap-3">
      {chosen !== undefined && card.pricedAt.length > 1 && (
        <Choice label={pricedAtLabel} name={PRICED_AT_CHOICE} options={card.pricedAt} words={(position) => position} chosen={chosen} onChoose={choose} labelShown={false} />
      )}
      {rows.length > 0 && <Choice label={logViewLabel} name={LOG_VIEW_CHOICE} options={LOG_VIEWS} words={logViews} chosen={view} onChoose={setView} labelShown={false} />}
    </span>
  );
  return (
    <Panel title={SEASON_TITLE} aside={switches}>
      {rows.length === 0 ? (
        <PanelNote>{noMatchesWords}</PanelNote>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse whitespace-nowrap">
            <ColumnHeads columns={heads} shown={shownHeads} classOf={(column) => cellClasses(column === "opponent")} />
            <tbody>
              {rows.map((row) => (
                <LogLine key={row.fixtureCode} row={row} card={card} view={view} shown={shown} statColumns={statColumns} selected={selected} select={select} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LastSeason lastSeason={card.lastSeason} shown={shown} />
    </Panel>
  );
}

/** One row of the game log: a match, or a postponed one saying so across its figures. */
function LogLine({
  row,
  card,
  view,
  shown,
  statColumns,
  selected,
  select,
}: {
  row: LogRow;
  card: PlayerCard;
  view: LogView;
  shown: number;
  statColumns: readonly StatColumn[];
  selected: number | null;
  select: (fixtureCode: number) => void;
}) {
  const opponent = opponentWords(row, card.club.code);
  const isSelected = row.kind === "played" && row.fixtureCode === selected;
  return (
    <tr aria-current={isSelected || undefined} className="border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge lg:h-row">
      <td className={cellClasses(false)}>{row.gameweek ?? noFigureWords}</td>
      <th scope="row" className={`${cellClasses(true)} font-normal`}>
        {row.kind === "postponed" ? (
          opponent ?? <MatchName match={row} />
        ) : (
          <button type="button" aria-pressed={isSelected} onClick={() => select(row.fixtureCode)} className="min-h-tap min-w-tap text-align-inherit lg:min-h-0 lg:min-w-0">
            {opponent ?? <MatchName match={row} />}
          </button>
        )}
      </th>
      {row.kind === "postponed" ? (
        <td colSpan={FIXED_RIGHT.length + statColumns.length + 1} className={`${cellClasses(true)} text-event`}>
          {postponedWords}
        </td>
      ) : (
        <>
          <td className={cellClasses(false)}>{scoreOf(row.match) ?? noFigureWords}</td>
          <td className={cellClasses(false)}>{row.match.minutes ?? noFigureWords}</td>
          {statColumns.map(({ stat }) => (
            <td key={stat} className={`${cellClasses(false)} text-soft`}>
              {statFigure(row.match, view, shown, stat)}
            </td>
          ))}
          <PointsCell match={row.match} shown={shown} />
        </>
      )}
    </tr>
  );
}

/** His points in the match: the league's override in place of his base points, saying what they
 *  were with its reason on hover, and "Live" after points that may still move. */
function PointsCell({ match, shown }: { match: PlayedMatch; shown: number }) {
  const base = match.points[shown].total;
  const { override } = match;
  const total = override?.points ?? base;
  if (total === null) {
    return (
      <td title={notArrivedWords} className={`${cellClasses(false)} text-muted`}>
        {noFigureWords}
      </td>
    );
  }
  return (
    <td className={cellClasses(false)}>
      {override !== null && (
        <span title={override.reason} className="mr-2 text-event">
          {overriddenWasWords(base)}
        </span>
      )}
      <span className="font-bold text-figure">{figureWords(total)}</span>
      {match.provisional && (
        <span title={provisionalWords} className="ml-1 text-derived">
          {liveWords}
        </span>
      )}
    </td>
  );
}

/** Last season's one line (spec/12), at the position the card's switch picks (Craig, 6 Nov 2026). */
function LastSeason({ lastSeason, shown }: { lastSeason: PlayerCard["lastSeason"]; shown: number }) {
  return (
    <p aria-label={LAST_SEASON_TITLE} className="border-t border-panel-rule px-3 py-2">
      <span className="mr-2 text-muted">{LAST_SEASON_TITLE}</span>
      {lastSeason === null ? (
        <span className="text-muted">{lastSeasonNotHeldWords}</span>
      ) : lastSeason.played === null ? (
        <span className="text-muted">{notInLastSeasonWords}</span>
      ) : (
        lastSeasonWords(lastSeason.season, { ...lastSeason.played, points: lastSeason.played.points[shown] ?? 0 })
      )}
    </p>
  );
}
