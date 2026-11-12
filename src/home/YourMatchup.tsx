import { Link } from "@tanstack/react-router";
import { MY_TEAM_PATH } from "../frame/menu";
import { matchupLink } from "../matchup/paths";
import { matchupLinkLabel } from "../matchup/words";
import { FormChips } from "../ui/FormChips";
import { Panel } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import type { LeagueHome } from "./seam";
import { gameweekShort, leagueAverageWords, MATCHUP_PANEL_TITLE, openMatchupLink, scoreToComeLabel, scoreWords, setLineupLink, standingWords } from "./words";

type Row = LeagueHome["table"][number];

/** One side of the head-to-head: its name, and its place, points and form where the table shows
 *  its row. */
function Side({ name, row, end }: { name: string; row: Row | undefined; end: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${end ? "items-end text-right" : "items-start"}`}>
      <span className="display-face text-lead">{name}</span>
      {row !== undefined && (
        <>
          <span className="text-soft">{standingWords(row.position, row.points)}</span>
          <FormChips form={row.form} />
        </>
      )}
    </div>
  );
}

/** Your matchup (docs/design/approved/home/1440.png): the reader's head-to-head this gameweek, his
 *  side first, the score once begun (an outline before), and Set lineup until it begins. Only for
 *  someone running a team in a head-to-head league with this gameweek drawn. */
export function YourMatchup({ home: { thisGameweek, table } }: { home: LeagueHome }) {
  const mine = table.find((row) => row.mine);
  if (thisGameweek === null || mine === undefined) return null;
  const fixture = thisGameweek.fixtures.find(({ team, opponent }) => team === mine.teamName || opponent === mine.teamName);
  if (fixture === undefined) return null;
  const home = fixture.team === mine.teamName;
  const opponent = home ? fixture.opponent : fixture.team;
  const points = fixture.points && (home ? fixture.points : { team: fixture.points.opponent, opponent: fixture.points.team });
  const { gameweek } = thisGameweek;
  const link = matchupLink(mine.teamId, gameweek);
  return (
    <Panel
      title={
        <>
          {MATCHUP_PANEL_TITLE} <span className="ml-1 font-normal text-soft">{gameweekShort(gameweek)}</span>
        </>
      }
      aside={
        <Link {...link} className="inline-flex min-h-tap items-center lg:min-h-0">
          {openMatchupLink}
        </Link>
      }
    >
      <div className="grid grid-cols-sides items-center gap-4 border-b border-panel-rule px-4 py-3">
        <Side name={mine.teamName} row={mine} end={false} />
        {points === null ? (
          <Placeholder label={scoreToComeLabel} className="h-11 w-30" />
        ) : (
          <Link {...link} aria-label={matchupLinkLabel(mine.teamName, opponent, gameweek)} className="flex h-11 min-w-30 items-center justify-center border border-muted px-3 text-title font-bold text-figure">
            {scoreWords(points.team, points.opponent)}
          </Link>
        )}
        <Side name={opponent ?? leagueAverageWords} row={opponent === null ? undefined : table.find((row) => row.teamName === opponent)} end />
      </div>
      {points === null && (
        <div className="flex justify-end px-4 py-2">
          <Link to={MY_TEAM_PATH} className="action">
            {setLineupLink}
          </Link>
        </div>
      )}
    </Panel>
  );
}
