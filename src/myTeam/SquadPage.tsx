import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ENTER_KEY } from "../shared/browserEvents";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Loading, Notice, PageSection, PanelNote, Problem } from "../ui/Panel";
import { playerCardPath } from "../playerCard/paths";
import { PositionCodes } from "../ui/PositionCodes";
import { ClubShort } from "../premierLeague/ClubName";
import { useChange, type Changing } from "../shared/useChange";
import { unheldNoticeWords, unheldPlayerWords } from "../shared/words";
import type { MyTeamSeam, SquadNumberChanges, TeamSquad } from "./seam";
import {
  figureWords,
  goneWords,
  lastGameweekLong,
  nextFixtureLong,
  nextFixtureShort,
  noFigureWords,
  noNextFixtureWords,
  noPointsWords,
  noSquadWords,
  noTeamWords,
  numberLabel,
  shortThenLongName,
  SQUAD_TITLE,
  squadColumns,
  squadLoadingWords,
  squadTableLabel,
  whenWords,
} from "./words";

type Row = TeamSquad["players"][number];
type Column = keyof typeof squadColumns;
const COLUMNS: readonly Column[] = ["number", "positions", "player", "club", "next", "last", "season"];
/** A phone leaves out the club, for room (plate.md, The phone: the squad table drops Club). */
const DESK_ONLY: readonly Column[] = ["club"];
const FIGURES: readonly Column[] = ["last", "season"];

const cellClasses = (column: Column) =>
  cellClassOf(!FIGURES.includes(column), DESK_ONLY.includes(column));

/** My team's Squad tab (spec/12, My team's tabs): every player in the squad in one table. */
export function SquadPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  return (
    <PageSection title={SQUAD_TITLE} className="max-w-4xl bg-panel">
      {league.teamName === null ? <PanelNote>{noTeamWords}</PanelNote> : <SquadBody league={league} seam={seam} />}
    </PageSection>
  );
}

function SquadBody({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  const squad = seam.useTeamSquad(league.leagueId);
  if (squad === undefined) return <Loading className="px-3 py-2">{squadLoadingWords}</Loading>;
  if (squad.players.length + squad.unheld.length === 0) return <PanelNote>{noSquadWords}</PanelNote>;
  return <SquadNumbersTable leagueId={league.leagueId} squad={squad} numbers={seam.useSquadNumbers()} />;
}

/** The squad, each row's number his manager's to change in place (#13). */
function SquadNumbersTable({ leagueId, squad, numbers }: { leagueId: Id<"leagues">; squad: TeamSquad; numbers: SquadNumberChanges }) {
  const change = useChange();
  // The Last column's long word names the gameweek it shows, once there is one.
  const heads = squad.lastGameweek === null ? squadColumns : { ...squadColumns, last: { ...squadColumns.last, long: lastGameweekLong(squad.lastGameweek) } };
  return (
    <>
      <Problem problem={change.problem} />
      {squad.unheld.length > 0 && <Notice>{unheldNoticeWords}</Notice>}
      <table aria-label={squadTableLabel(squad.teamName)} className="w-full border-collapse">
        <ColumnHeads columns={heads} shown={COLUMNS} classOf={cellClasses} />
        <tbody>
          {squad.players.map((player) => (
            <tr key={player.code} className="border-t border-panel-rule">
              {COLUMNS.map((column) => (
                <SquadCell key={column} column={column} player={player} leagueId={leagueId} numbers={numbers} change={change} />
              ))}
            </tr>
          ))}
          {/* Data gone wrong, kept so it shows (#323): there's no player to fill the columns. */}
          {squad.unheld.map((code) => (
            <tr key={code} className="border-t border-panel-rule">
              <th scope="row" colSpan={COLUMNS.length} className={`${cellClasses("player")} text-event`}>
                {unheldPlayerWords(code)}
              </th>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** One cell of a player's row: his name heads it, his points are its figures. */
function SquadCell({
  column,
  player,
  leagueId,
  numbers,
  change,
}: {
  column: Column;
  player: Row;
  leagueId: Id<"leagues">;
  numbers: SquadNumberChanges;
  change: Changing;
}) {
  const className = cellClasses(column);
  switch (column) {
    case "number":
      return (
        <td className={className}>
          <SquadNumberBox player={player} change={change} save={(number) => numbers.set(leagueId, player.code, number)} />
        </td>
      );
    case "positions":
      return (
        <td className={className}>
          <PositionCodes positions={player.positions} />
        </td>
      );
    case "player":
      return (
        <th scope="row" title={player.fullName} className={`${className} text-lead font-semibold`}>
          <Link to={playerCardPath(leagueId, player.code)} className="tap-link">
            {player.name}
          </Link>
          {player.gone && <span className="block text-data font-normal text-event">{goneWords}</span>}
        </th>
      );
    case "club":
      return (
        <td className={className}>
          <ClubShort club={player.club} />
        </td>
      );
    case "next":
      return <td className={className}>{player.nextFixture === null ? <span title={noNextFixtureWords} className="text-muted">{noFigureWords}</span> : <NextFixture next={player.nextFixture} />}</td>;
    case "last":
      return <PointsCell className={className} points={player.lastGameweekPoints} />;
    case "season":
      return <PointsCell className={className} points={player.seasonPoints} />;
  }
}

/** His number, changed in place: it is sent when the box is left or Enter is pressed, and goes
 *  back to the one held if refused. An empty box takes his number away. What isn't a number from
 *  1 to 99 is sent as typed, and the server's refusal says why (squadNumbers.ts). */
function SquadNumberBox({ player, change, save }: { player: Row; change: Changing; save: (number: number | null) => ReturnType<SquadNumberChanges["set"]> }) {
  const held = player.number === null ? "" : String(player.number);
  const [typed, setTyped] = useState(held);
  // A number changed on another screen shows here at once: the box keeps the last one held and
  // takes the new one while it renders, as rules/NumberBox.tsx does.
  const [lastHeld, setLastHeld] = useState(held);
  if (lastHeld !== held) {
    setLastHeld(held);
    setTyped(held);
  }
  // Only this box waits while its number is sent, so a click into the next one isn't lost.
  const [sending, setSending] = useState(false);
  const send = async () => {
    const trimmed = typed.trim();
    if (trimmed === held) {
      change.clear();
      return;
    }
    const number = trimmed === "" ? null : Number(trimmed);
    setSending(true);
    const made = await change.run(() => save(number));
    setSending(false);
    // Made, the box shows what was sent ("07" as the 7 it was taken as, an emptied box empty);
    // refused, the one held comes back (it hasn't changed, so the sync above won't bring it).
    if (made) setTyped(number === null ? "" : String(number));
    else setTyped(held);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={numberLabel(player.name)}
      value={typed}
      disabled={sending}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={() => void send()}
      onKeyDown={(event) => {
        if (event.key === ENTER_KEY) event.currentTarget.blur();
      }}
      className="text-box w-squad-number lg:min-h-0"
    />
  );
}

function NextFixture({ next }: { next: NonNullable<Row["nextFixture"]> }) {
  const short = nextFixtureShort(next.opponent.shortName, next.home);
  const long = nextFixtureLong(next.opponent.name, next.home, whenWords(next.kickoff));
  return (
    <abbr title={long} aria-label={shortThenLongName({ short, long })} className="no-underline whitespace-nowrap">
      {short}
    </abbr>
  );
}

function PointsCell({ className, points }: { className: string; points: number | null }) {
  return points === null ? (
    <td title={noPointsWords} className={`${className} text-muted`}>
      {noFigureWords}
    </td>
  ) : (
    <td className={`${className} font-bold text-figure`}>{figureWords(points)}</td>
  );
}
