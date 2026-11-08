import type { ReactNode } from "react";
import { Panel } from "../ui/Panel";
import { CategoryLines, RoleWords } from "./Breakdown";
import { opponentWords, pointsOf, scoreOf } from "./gameLog";
import type { PlayedMatch } from "./seam";
import { MatchName } from "./MatchName";
import { breakdownLabel, figureWords, liveWords, matchTitle, noFigureWords, notArrivedWords, overriddenWords, provisionalWords, roleLineLabel } from "./words";

/** The selected match's breakdown, at the top of the right column (the approved picture): its
 *  title with his points, a line for each category he earned or lost points in, saying why, the
 *  version it was scored under, his role's line apart from his base points where his team started
 *  him (spec/05), and the league's override with its reason. `children` is what whoever runs the
 *  league does to it: the override (#32). */
export function MatchBreakdown({ match, shown, clubCode, children }: { match: PlayedMatch; shown: number; clubCode: number; children?: ReactNode }) {
  const opponent = opponentWords(match, clubCode);
  const total = pointsOf(match, shown);
  const { override } = match;
  return (
    <Panel
      title={opponent === null ? <MatchName match={match} /> : matchTitle(match.gameweek, opponent, scoreOf(match))}
      aside={
        total === null ? (
          <span title={notArrivedWords} className="text-muted">
            {noFigureWords}
          </span>
        ) : (
          <span className="font-bold text-figure">
            {match.provisional && (
              <span title={provisionalWords} className="mr-1 font-normal text-derived">
                {liveWords}
              </span>
            )}
            {figureWords(total)}
          </span>
        )
      }
    >
      {match.points[shown].total !== null && (
        <div aria-label={breakdownLabel(match.gameweek)} className="px-3 py-2">
          <CategoryLines categories={match.points[shown].categories} version={match.version} />
        </div>
      )}
      {override === null && match.role !== undefined && match.points[shown].total !== null && (
        <p aria-label={roleLineLabel(match.role.name)} className="border-t border-panel-rule px-3 py-2 text-soft">
          <RoleWords role={match.role} />
        </p>
      )}
      {override !== null && <p className="border-t border-panel-rule px-3 py-2 text-event">{overriddenWords(override.points, override.reason)}</p>}
      {children}
    </Panel>
  );
}
