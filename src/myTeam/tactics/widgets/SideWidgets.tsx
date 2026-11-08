import { Panel } from "../../../ui/Panel";
import { Placeholder } from "../../../ui/Placeholder";
import { FormChips } from "../../header/FormChips";
import { formHead, placeWords, pointsShort, tableHead } from "../../header/words";
import { noFigureWords } from "../../../shared/words";
import { OpponentLink } from "../../header/TeamHeader";
import { gamesIn, standingOf } from "../../header/teamStanding";
import type { LeagueTable } from "../../../table/seam";
import { startersInOrder, type EditedLineup, type SquadMember } from "../lineupEdits";
import { positionMarksOf } from "../positionMarks";
import { instructionsTitle, LINEUP_CHECK_TITLE, lineupCheckPlaceholder, opponentTitle, outOfPositionLineWords, pickedWords, SIDE_WORDS } from "../words";
import { offeredOn, SIDES, type Instruction, type InstructionPair } from "../../../../convex/lineup/instructions";
import type { Cell } from "../../../../convex/lineup/pitch";

// The Tactics tab's widgets, each a panel with its title plate (plate.md, Tables and panels): the
// lineup check under the pitch, and the team instructions and the gameweek's opponent down the right.

/** Who to look at before the deadline: a line for each starter out of position, his name selecting
 *  him (#23; Craig, 6 Nov 2026), in the pitch's order; above what waits on the status chips' data
 *  (to-grill: Status chips' data; Who's doubtful, on Tactics), a placeholder in its place and size. */
export function LineupCheck({ draft, squad, onSelect }: { draft: EditedLineup; squad: ReadonlyMap<number, SquadMember>; onSelect(playerCode: number): void }) {
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

/** The team instructions the formation unlocks (spec/05, Team instructions; #990): each side's
 *  offered ones, with what each rewards and costs, the picked one marked. */
export function TeamInstructionsWidget({
  formation,
  cells,
  instructions,
  picked,
}: {
  formation: string | null;
  cells: readonly Cell[];
  instructions: readonly Instruction[];
  picked: InstructionPair;
}) {
  return (
    <Panel title={instructionsTitle(formation)}>
      <div className="flex flex-col gap-3 p-3">
        {SIDES.map((side) => (
          <section key={side} aria-label={SIDE_WORDS[side]}>
            <h3 className="text-soft">{SIDE_WORDS[side]}</h3>
            <ul>
              {offeredOn(side, cells, instructions).map(({ key, name, description }) => (
                <li key={key} aria-current={key === picked[side] || undefined}>
                  <span className={key === picked[side] ? "font-semibold" : undefined}>{name}</span>
                  {key === picked[side] && <span className="text-soft"> {pickedWords}</span>}
                  <p className="text-soft">{description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}

/** The team's opponent in the gameweek being set (spec/05, What the pitch shows: "The team's next
 *  head-to-head opponent shows on the Tactics tab"), in the gameweek the lineup is for: each one's
 *  name, a link to its own matchup, with his place, points and form, both in a gameweek of two
 *  games, and "—" where the team has none, before the fixtures are drawn (#849; Craig, 6 Nov
 *  2026). None in total points, or before the league's table has loaded. */
export function OpponentWidget({ table, teamName, gameweek }: { table: LeagueTable | null | undefined; teamName: string; gameweek: number }) {
  if (!table || table.format !== "headToHead") return null;
  const own = standingOf(table, teamName);
  if (own === null) return null;
  const games = gamesIn(table, teamName, gameweek);
  return (
    <Panel title={opponentTitle(gameweek)}>
      <div className="flex flex-col gap-3 p-3">
        {games.length === 0 && <span className="text-muted">{noFigureWords}</span>}
        {games.map((game, index) => {
          const opponent = game.against.kind === "team" ? standingOf(table, game.against.team) : null;
          return (
            <div key={index} className="flex flex-col gap-2">
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
          );
        })}
      </div>
    </Panel>
  );
}
