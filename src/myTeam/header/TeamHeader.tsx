import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { gameModeOf, type GameMode } from "../../../convex/rules/gameMode";
import { BYE } from "../../../convex/table/teamGames";
import { matchupLink } from "../../matchup/paths";
import { useMinute } from "../../shared/useMinute";
import { NextGlyph } from "../../ui/MoreLink";
import { PageSection, PanelNote } from "../../ui/Panel";
import type { MyTeamSeam } from "../seam";
import { AutoTeamSwitch } from "./AutoTeamSwitch";
import { FormChips } from "./FormChips";
import { gamesIn, standingOf, type Standing, type TeamGame } from "./teamStanding";
import {
  againstWords,
  autoTeamHead,
  countdownWords,
  deadlineHead,
  formHead,
  gameweekShort,
  lastGameWords,
  liveWords,
  meterListLabel,
  noDeadlineWords,
  noFigureWords,
  noTeamWords,
  placeWords,
  pointsShort,
  tableHead,
  versusWords,
  whenWords,
} from "./words";

// My team's header band, one on every My team tab (the approved Tactics picture; FM's team meters
// across the header): the team's name on the page's plate, then the next deadline and its
// countdown, the opponent then, the last result, the form, the table place and the auto team's
// switch (AutoTeamSwitch.tsx, the approved auto-team picture). Each reading shows
// once its data has loaded, and only where the league has it: no opponent or form in total points.
// While the table loads its readings wait.
// The Tactics and Squad tabs both wrap their page in it.

/** A tab's page under My team's header band: `children` is the tab's own. */
export function TeamPage({ league, teamName, seam, children }: { league: LeagueSummary; teamName: string; seam: MyTeamSeam; children?: ReactNode }) {
  return (
    <PageSection
      title={teamName}
      aside={
        <div role="group" aria-label={meterListLabel}>
          <TeamMeters league={league} teamName={teamName} seam={seam} />
        </div>
      }
    >
      {children}
    </PageSection>
  );
}

/** A tab's page for a viewer who runs no team in the league: its title, and saying so. */
export function NoTeam({ title }: { title: string }) {
  return (
    <PageSection title={title} className="bg-panel">
      <PanelNote>{noTeamWords}</PanelNote>
    </PageSection>
  );
}

/** One reading: its head over its value, ruled off from the one before. */
function Meter({ head, children }: { head: string; children: ReactNode }) {
  return (
    <div className="flex flex-col border-l border-plate-rule px-3">
      <dt className="text-soft">{head}</dt>
      <dd className="text-lead font-semibold">{children}</dd>
    </div>
  );
}

function TeamMeters({ league, teamName, seam }: { league: LeagueSummary; teamName: string; seam: MyTeamSeam }) {
  const now = useMinute();
  const tactics = seam.useTactics(league.leagueId, now);
  const table = seam.useLeagueTable(league.leagueId);
  const open = tactics?.kind === "open" ? tactics : null;
  const standing = table ? standingOf(table, teamName) : null;
  const next = open !== null && table ? gamesIn(table, teamName, open.gameweek) : [];
  const mode = table ? gameModeOf(table) : null;
  const headToHead = mode?.hasMatchups ?? false;
  return (
    <dl className="flex flex-wrap items-stretch">
      {open !== null && (
        <Meter head={deadlineHead(open.gameweek)}>
          {open.deadline === null ? (
            <span title={noDeadlineWords(open.gameweek)} className="text-muted">
              {noFigureWords}
            </span>
          ) : (
            <>
              {whenWords(open.deadline)} <span className="text-derived">{countdownWords(open.deadline - now)}</span>
            </>
          )}
        </Meter>
      )}
      {open !== null && headToHead && standing !== null && (
        <Meter head={versusWords}>
          <Opponents games={next} teamId={standing.teamId} />
        </Meter>
      )}
      {standing !== null && mode !== null && <LastMeter standing={standing} mode={mode} />}
      {standing !== null && headToHead && (
        <Meter head={formHead}>
          <FormChips form={standing.form} />
        </Meter>
      )}
      {standing !== null && (
        <Meter head={tableHead}>
          {placeWords(standing.place)}, <span className="text-figure">{pointsShort(standing.points)}</span>
        </Meter>
      )}
      <Meter head={autoTeamHead}>
        <AutoTeamSwitch league={league} seam={seam} />
      </Meter>
    </dl>
  );
}

/** The team's opponents in the gameweek, each opening its own matchup: both in a gameweek of two
 *  games (#849; Craig, 6 Nov 2026), and "—" where it has none, before the fixtures are drawn. */
function Opponents({ games, teamId }: { games: readonly TeamGame[]; teamId: Standing["teamId"] }) {
  if (games.length === 0) return <span className="text-muted">{noFigureWords}</span>;
  return (
    <span className="flex flex-wrap gap-x-3">
      {games.map((game, index) => (
        <OpponentLink key={index} game={game} teamId={teamId} />
      ))}
    </span>
  );
}

/** The opponent in the gameweek, as a link to the team's matchup, in the second face (plate.md,
 *  Type); a bye has none. The band's and the Tactics tab's GW opponent widget's. */
export function OpponentLink({ game, teamId }: { game: TeamGame; teamId: Standing["teamId"] }) {
  const name = againstWords(game.against);
  if (game.against.kind === BYE) return <span className="text-muted">{name}</span>;
  return (
    <Link {...matchupLink(teamId, game.gameweek, game.game)} className="inline-flex min-h-tap items-center gap-1 display-face lg:min-h-0">
      {name}
      <NextGlyph />
    </Link>
  );
}

/** The last gameweek: the head-to-head result, live or final, or the points in total points. */
function LastMeter({ standing: { last, lastPoints }, mode }: { standing: Standing; mode: GameMode }) {
  if (mode.hasMatchups) {
    if (last?.score == null) return null;
    return (
      <Meter head={gameweekShort(last.gameweek)}>
        {lastGameWords({ ...last, score: last.score }, mode)}
        {last.score.provisional && <span className="ml-1 text-derived">{liveWords}</span>}
      </Meter>
    );
  }
  if (lastPoints === null) return null;
  return (
    <Meter head={gameweekShort(lastPoints.gameweek)}>
      <span className="text-figure">{pointsShort(lastPoints.points)}</span>
      {lastPoints.provisional && <span className="ml-1 text-derived">{liveWords}</span>}
    </Meter>
  );
}
