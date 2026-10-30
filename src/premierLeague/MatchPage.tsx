import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Loading, Notice, PAGE_STACK, PageSection, Panel, PanelNote } from "../ui/Panel";
import { Vidiprinter } from "../matchup/Vidiprinter";
import { PositionCode } from "../ui/PositionCodes";
import type { MatchMan, MatchPageData, PremierLeagueSeam } from "./seam";
import {
  cameOnWords,
  clockWords,
  COMMENTARY_TITLE,
  fullTime,
  goalsWords,
  inGameweekWords,
  halfTime,
  kickoffDayWords,
  loadingMatchWords,
  MATCH_TITLE,
  matchColumns,
  MOVED_TITLE,
  noFigureWords,
  noLinesWords,
  noMatchWords,
  noMenWords,
  notCountingLabel,
  noTeamStatsWords,
  pointsProblemWords,
  possessionWords,
  SCORE_LABEL,
  sheetLabel,
  STAT_COLUMN_LABEL,
  SUBSTITUTES_TITLE,
  TEAM_STATS_TITLE,
  teamStatRows,
  teamStatsLabel,
  unusedLabel,
  versusWords,
} from "./words";

/** One real Premier League match (spec/10, The match page), live: the score and clock, each club's
 *  team sheet with every man owned in the league showing his team and his points, the five team
 *  stats, and the match's commentary, newest first. Opened from the Premier League's fixtures (spec/18) and from a
 *  player's status on the matchup. */
export function MatchPage({ league, seam, fixtureCode }: { league: LeagueSummary; seam: PremierLeagueSeam; fixtureCode: number }) {
  const match = seam.useMatch(league.leagueId, fixtureCode);
  return (
    <PageSection title={MATCH_TITLE} className={PAGE_STACK}>
      {match === undefined ? (
        <Loading>{loadingMatchWords}</Loading>
      ) : match === null ? (
        <p className="text-muted">{noMatchWords}</p>
      ) : (
        <HeldMatch match={match} />
      )}
    </PageSection>
  );
}

function HeldMatch({ match }: { match: MatchPageData }) {
  const { home, away, men, pointsProblem, teamStats, commentary } = match;
  const moved = men.filter((man) => man.side === null);
  return (
    <>
      <Scoreboard match={match} />
      {pointsProblem !== null && <Notice>{pointsProblemWords(pointsProblem)}</Notice>}
      <div className="grid items-start gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <TeamSheet title={home.name} men={men.filter((man) => man.side === "home")} />
        <TeamSheet title={away.name} men={men.filter((man) => man.side === "away")} />
        {/* Side by side under the sheets on the desk, stacked in the third column on a wide one. */}
        <div className="grid items-start gap-2 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
          <TeamStats home={home.shortName} away={away.shortName} stats={teamStats} />
          <Vidiprinter commentary={commentary} title={COMMENTARY_TITLE} noLinesWords={noLinesWords} />
        </div>
        {moved.length > 0 && <TeamSheet title={MOVED_TITLE} men={moved} />}
      </div>
    </>
  );
}

/** The clubs with the score between them, or "v" before kickoff, and where the match stands. */
function Scoreboard({ match: { home, away, score, kickoff, gameweek } }: { match: MatchPageData }) {
  const goals = goalsWords(score);
  return (
    <section aria-label={SCORE_LABEL} className="bg-panel shadow-bevel-panel">
      <p className="grid grid-cols-sides items-baseline gap-3 px-3 pt-2 text-lead font-bold sm:text-title">
        <span className="text-right">{home.name}</span>
        {goals === null ? <span className="text-muted">{versusWords}</span> : <span className="whitespace-nowrap text-figure">{goals}</span>}
        <span>{away.name}</span>
      </p>
      <p aria-live="polite" className="px-3 pb-2 text-center">
        <MatchState score={score} kickoff={kickoff} />
        {gameweek !== null && <span className="text-muted">{inGameweekWords(gameweek)}</span>}
      </p>
    </section>
  );
}

function MatchState({ score, kickoff }: Pick<MatchPageData, "score" | "kickoff">) {
  switch (score?.state) {
    case "live":
      return <span className="font-semibold text-derived">{clockWords(score.clockLabel, score.minutes)}</span>;
    case "halfTime":
      return <span className="font-semibold text-derived">{halfTime.long}</span>;
    case "fullTime":
      return <span className="text-muted">{fullTime.long}</span>;
    default:
      return <span className="text-muted">{kickoff === null ? "" : kickoffDayWords(kickoff)}</span>;
  }
}

type SideStats = NonNullable<MatchPageData["teamStats"]>["home"];

/** Each side's five, home's figure left of the stat and away's right, as a scoreboard reads. */
function TeamStats({ home, away, stats }: { home: string; away: string; stats: MatchPageData["teamStats"] }) {
  return (
    <Panel title={TEAM_STATS_TITLE}>
      {stats === null ? (
        <PanelNote>{noTeamStatsWords}</PanelNote>
      ) : (
        <table aria-label={teamStatsLabel(home, away)} className="w-full table-fixed border-collapse">
          <thead className="bg-head text-ground">
            <tr>
              <th scope="col" className="px-2 text-right">{home}</th>
              <th scope="col" className="w-1/2 px-2 text-center">
                <span className="sr-only">{STAT_COLUMN_LABEL}</span>
              </th>
              <th scope="col" className="px-2 text-left">{away}</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(teamStatRows) as (keyof typeof teamStatRows)[]).map((stat) => (
              <tr key={stat} className="border-t border-panel-rule">
                <td className="px-2 text-right font-bold">{statWords(stats.home, stat)}</td>
                <th scope="row" className="px-2 text-center font-normal text-muted">{teamStatRows[stat]}</th>
                <td className="px-2 text-left font-bold">{statWords(stats.away, stat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function statWords(side: SideStats, stat: keyof SideStats): string {
  const value = side[stat];
  if (value === null) return noFigureWords;
  return stat === "possession" ? possessionWords(value) : String(value);
}

/** A club's men as the sheet named them: the starters, then a Substitutes plate and the bench. */
function TeamSheet({ title, men }: { title: string; men: MatchMan[] }) {
  const starters = men.filter((man) => man.started);
  const substitutes = men.filter((man) => !man.started);
  return (
    <Panel title={title}>
      {men.length === 0 ? (
        <PanelNote>{noMenWords}</PanelNote>
      ) : (
        <table aria-label={sheetLabel(title)} className="w-full border-collapse">
          <ColumnHeads columns={matchColumns} classOf={(column) => (column === "player" ? "px-2 text-left" : "px-2 text-right")} />
          <tbody>
            {starters.map((man) => (
              <ManRow key={man.playerCode} man={man} />
            ))}
            {substitutes.length > 0 && (
              <tr>
                <th colSpan={Object.keys(matchColumns).length} scope="colgroup" className="bg-plate px-3 text-left font-bold shadow-bevel-plate">
                  {SUBSTITUTES_TITLE}
                </th>
              </tr>
            )}
            {substitutes.map((man) => (
              <ManRow key={man.playerCode} man={man} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** One man: an unused substitute greyed, one who came on marked, and for a man owned in the
 *  league, the team that owns him and his points, greyed while they don't count for it. */
function ManRow({ man: { name, position, started, played, ownerTeamName, points, counts } }: { man: MatchMan }) {
  const unused = !started && played === false;
  return (
    <tr className={`border-t border-panel-rule align-top ${unused ? "text-muted" : ""}`}>
      <td className="px-2 text-right">{position === null ? noFigureWords : <PositionCode position={position} />}</td>
      <th scope="row" className={`px-2 text-left font-semibold ${unused ? "" : "text-lead"}`}>
        {name}
        {!started && played === true && <span className="ml-2 font-normal text-event">{cameOnWords}</span>}
        {unused && <span className="sr-only"> {unusedLabel}</span>}
        {ownerTeamName !== null && <span className="block text-data font-normal text-muted">{ownerTeamName}</span>}
      </th>
      <td className={`px-2 text-right ${counts && points !== null ? "font-bold text-figure" : "text-muted"}`}>
        {ownerTeamName === null ? null : (points ?? noFigureWords)}
        {ownerTeamName !== null && !counts && <span className="sr-only"> {notCountingLabel}</span>}
      </td>
    </tr>
  );
}
