import { Panel } from "../../../ui/Panel";
import { Placeholder } from "../../../ui/Placeholder";
import { FormChips } from "../../header/FormChips";
import { formHead, placeWords, pointsShort, tableHead } from "../../header/words";
import { OpponentLink } from "../../header/TeamHeader";
import { gameIn, standingOf } from "../../header/teamStanding";
import type { LeagueTable } from "../../../table/seam";
import { LINEUP_CHECK_TITLE, lineupCheckPlaceholder, opponentTitle, TEAM_TACTIC_TITLE, teamTacticPlaceholder } from "../words";

// The Tactics tab's widgets, each a panel with its title plate (plate.md, Tables and panels): the
// lineup check under the pitch, and the team tactic and the gameweek's opponent down the right.

/** Who to look at before the deadline: waits on the status chips' data (to-grill: Status chips'
 *  data; Who's doubtful, on Tactics), so a placeholder in its place and size. */
export function LineupCheck() {
  return (
    <Panel title={LINEUP_CHECK_TITLE}>
      <div className="p-3">
        <Placeholder label={lineupCheckPlaceholder} className="h-36 w-full" />
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
        <Placeholder label={teamTacticPlaceholder} className="h-40 w-full" />
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
