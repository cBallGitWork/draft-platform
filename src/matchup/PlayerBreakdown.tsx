import { Link } from "@tanstack/react-router";
import type { MatchBreakdown } from "../../convex/matchup/matchupShape";
import { PositionChip } from "../ui/PositionChip";
import type { TileMan } from "./PlayerTile";
import { CategoryLines, RoleWords } from "../playerCard/Breakdown";
import { playerCardPath } from "../playerCard/paths";
import { matchPath } from "../premierLeague/paths";
import { MoreLink } from "../ui/MoreLink";
import { CloseButton, Panel, PanelNote } from "../ui/Panel";
import {
  breakdownMatchWords,
  breakdownRoleWords,
  closeBreakdownLabel,
  figureWords,
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
// match, the match that doesn't count is greyed (Craig, 6 Nov 2026). It opens at the top of the
// matchup's centre column, over the vidiprinter (the approved picture; #1026).

export function PlayerBreakdown({ leagueId, slot, teamName, version, close }: { leagueId: string; slot: TileMan; teamName: string; version: string | null; close(): void }) {
  return (
    <Panel
      title={
        // His slot's chip, his name, then his role and team (the approved picture: "ST Wood Target man, Kroos Control").
        <span className="flex items-center gap-2">
          {/* Spaces between, so the panel's name reads "ST Wood Target man, Kroos Control". */}
          {slot.place !== null && <PositionChip label={slot.place.label} />} <span>{slot.name}</span>{" "}
          <span className="text-data font-normal text-soft">{breakdownRoleWords(slot.role?.name ?? null, teamName)}</span>
        </span>
      }
      aside={<CloseButton label={closeBreakdownLabel} close={close} className="text-title leading-none" />}
    >
      {slot.breakdown.length === 0 ? (
        <PanelNote>{noMatchBreakdownWords}</PanelNote>
      ) : (
        slot.breakdown.map((match) => <MatchLines key={match.fixtureCode} match={match} version={version} />)
      )}
      <div className="flex justify-end px-3 pb-2">
        <MoreLink to={playerCardPath(leagueId, slot.playerCode)}>{playerCardWords}</MoreLink>
      </div>
    </Panel>
  );
}

/** One match: its clubs, score and clock, opening its page, and his points there, then the lines that make them,
 *  or the league's override in their place. */
function MatchLines({ match, version }: { match: MatchBreakdown; version: string | null }) {
  const { points, counted, override } = match;
  return (
    <section className={`border-b border-panel-rule px-3 py-2 ${counted ? "" : "text-muted"}`}>
      <p className="flex items-center justify-between gap-2">
        <Link to={matchPath(match.fixtureCode)} className="flex min-h-tap shrink-0 items-center font-semibold text-inherit lg:min-h-0">
          {breakdownMatchWords(match)}
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
          {override === null &&
            match.instructions?.map((instruction) => (
              <p key={instruction.name}>
                <RoleWords role={instruction} />
              </p>
            ))}
        </div>
      )}
      {override !== null && <p className="text-event">{overriddenWords(override.points, override.reason)}</p>}
    </section>
  );
}
