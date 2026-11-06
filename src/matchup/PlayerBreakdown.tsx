import { Link } from "@tanstack/react-router";
import type { MatchBreakdown, MatchupSlot } from "../../convex/matchup/matchupShape";
import { CategoryLines, RoleWords } from "../playerCard/Breakdown";
import { playerCardPath } from "../playerCard/paths";
import { matchPath } from "../premierLeague/paths";
import { Panel, PanelNote } from "../ui/Panel";
import {
  breakdownMatchWords,
  closeBreakdownLabel,
  closeGlyph,
  figureWords,
  nextGlyph,
  noFigureWords,
  noMatchBreakdownWords,
  notArrivedWords,
  notCountedWords,
  overriddenWords,
  playerCardWords,
} from "./words";

// A lineup player's breakdown for the gameweek, opened by tapping him on the matchup (spec/10: "the
// opposition manager needs to see why his opponent got the points"; #798): each of his matches,
// each line saying why, his role's line included, as the table's scorer scored him. Under best
// match, the match that doesn't count is greyed (Craig, 6 Nov 2026). It opens over the matchup
// until the matchup's picture places it (#1026; Craig, 6 Nov 2026: "4 a").

export function PlayerBreakdown({ leagueId, slot, version, close }: { leagueId: string; slot: MatchupSlot; version: string | null; close(): void }) {
  return (
    <Panel
      title={slot.name}
      aside={
        <button type="button" aria-label={closeBreakdownLabel} onClick={close} className="min-h-tap min-w-tap text-title leading-none">
          {closeGlyph}
        </button>
      }
    >
      {slot.breakdown.length === 0 ? (
        <PanelNote>{noMatchBreakdownWords}</PanelNote>
      ) : (
        slot.breakdown.map((match) => <MatchLines key={match.fixtureCode} match={match} version={version} />)
      )}
      <div className="flex justify-end px-3 pb-2">
        <Link to={playerCardPath(leagueId, slot.playerCode)} className="flex min-h-tap items-center font-semibold">
          {playerCardWords} <span aria-hidden="true">&nbsp;{nextGlyph}</span>
        </Link>
      </div>
    </Panel>
  );
}

/** One match: its kickoff, opening its page, and his points there, then the lines that make them,
 *  or the league's override in their place. */
function MatchLines({ match, version }: { match: MatchBreakdown; version: string | null }) {
  const { points, counted, override } = match;
  return (
    <section className={`border-b border-panel-rule px-3 py-2 ${counted ? "" : "text-muted"}`}>
      <p className="flex items-baseline justify-between gap-2">
        <Link to={matchPath(match.fixtureCode)} className="inline-flex min-h-tap items-center font-semibold text-inherit lg:min-h-0">
          {breakdownMatchWords(match.kickoff)}
        </Link>
        <span className={counted && points !== null ? "font-bold text-figure" : ""} title={points === null ? notArrivedWords : undefined}>
          {points === null ? noFigureWords : figureWords(points)}
        </span>
      </p>
      {!counted && <p>{notCountedWords}</p>}
      {points !== null && (
        <div className={counted ? "text-soft" : ""}>
          <CategoryLines categories={match.categories} version={version} />
          {override === null && match.role !== undefined && (
            <p>
              <RoleWords role={match.role} />
            </p>
          )}
        </div>
      )}
      {override !== null && <p className="text-event">{overriddenWords(override.points, override.reason)}</p>}
    </section>
  );
}
