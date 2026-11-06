import { Panel } from "../../../ui/Panel";
import { Placeholder } from "../../../ui/Placeholder";
import { FormChips } from "../../header/FormChips";
import { formHead, placeWords, pointsShort, tableHead } from "../../header/words";
import { OpponentLink } from "../../header/TeamHeader";
import { gameIn, standingOf } from "../../header/teamStanding";
import type { LeagueTable } from "../../../table/seam";
import { startersInOrder, type DraftLineup, type SquadMember } from "../lineupDraft";
import { positionMarksOf } from "../positionMarks";
import { LINEUP_CHECK_TITLE, lineupCheckPlaceholder, opponentTitle, outOfPositionLineWords, TEAM_TACTIC_TITLE, teamTacticPlaceholder } from "../words";

// The Tactics tab's widgets, each a panel with its title plate (plate.md, Tables and panels): the
// lineup check under the pitch, and the team tactic and the gameweek's opponent down the right.

/** Who to look at before the deadline: a line for each starter out of position, his name selecting
 *  him (#23; Craig, 6 Nov 2026), in the pitch's order; above what waits on the status chips' data
 *  (to-grill: Status chips' data; Who's doubtful, on Tactics), a placeholder in its place and size. */
export function LineupCheck({ draft, squad, onSelect }: { draft: DraftLineup; squad: ReadonlyMap<number, SquadMember>; onSelect(playerCode: number): void }) {
  const outOfPosition = startersInOrder(draft).flatMap((starter) => {
    const player = squad.get(starter.playerCode);
    // Out of position comes first of his marks.
    const mark = player === undefined ? undefined : positionMarksOf(player, starter)[0];
    return player !== undefined && mark?.kind === "outOfPosition" ? [{ player, position: mark.position }] : [];
  });
  return (
    <Panel title={LINEUP_CHECK_TITLE}>
      <div className="flex flex-col gap-2 p-3">
        {outOfPosition.length > 0 && (
          <ul>
            {outOfPosition.map(({ player, position }) => (
              <li key={player.playerCode}>
                <button type="button" onClick={() => onSelect(player.playerCode)} className="min-h-tap font-semibold text-event lg:min-h-0">
                  {player.name}
                </button>
                {outOfPositionLineWords(position)}
              </li>
            ))}
          </ul>
        )}
        <Placeholder label={lineupCheckPlaceholder} className="h-24 w-full" />
      </div>
    </Panel>
  );
}

/** The team tactic the formation unlocks: unspecced (SPEC.md, Second release; to-grill: Team tactic
 *  per formation), so a placeholder in its place and size. */
export function TeamTacticWidget() {
  return (
    <Panel title={TEAM_TACTIC_TITLE}>
      <div className="p-3">
        <Placeholder label={teamTacticPlaceholder} className="h-32 w-full" />
      </div>
    </Panel>
  );
}

/** The team's opponent in the gameweek being set (spec/05, What the pitch shows: "The team's next
 *  head-to-head opponent shows on the Tactics tab"): his name, a link to the matchup, with his
 *  place, points and form. None in total points, or before the league's table has loaded. */
export function OpponentWidget({ table, teamName, gameweek }: { table: LeagueTable | null | undefined; teamName: string; gameweek: number }) {
  if (!table) return null;
  const own = standingOf(table, teamName);
  const game = gameIn(table, teamName, gameweek);
  if (own === null || game === null) return null;
  const opponent = game.against.kind === "team" ? standingOf(table, game.against.team) : null;
  return (
    <Panel title={opponentTitle(gameweek)}>
      <div className="flex flex-col gap-2 p-3">
        <span className="text-lead">
          <OpponentLink game={game} teamId={own.teamId} />
        </span>
        {opponent !== null && (
          <dl className="grid grid-cols-facts items-center gap-x-3 gap-y-2">
            <dt className="text-muted">{tableHead}</dt>
            <dd>
              {placeWords(opponent.place)}, <span className="font-bold text-figure">{pointsShort(opponent.points)}</span>
            </dd>
            <dt className="text-muted">{formHead}</dt>
            <dd>
              <FormChips form={opponent.form} />
            </dd>
          </dl>
        )}
      </div>
    </Panel>
  );
}
