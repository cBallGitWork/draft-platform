import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { footballLink, matchPath } from "./paths";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { inkOn, type Ink } from "../../convex/football/clubColours";
import { useClubColours } from "../shared/clubColours";
import { ClubMark } from "../ui/ClubName";
import { ClubLink } from "./ClubLink";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Loading, Notice, PAGE_STACK, PageSection, Panel, PanelNote, Status } from "../ui/Panel";
import { Vidiprinter } from "../matchup/Vidiprinter";
import { OwnerName } from "../ui/OwnerName";
import { useMinute } from "../shared/useMinute";
import { PositionCode } from "../ui/PositionCodes";
import type { MatchMan, MatchPageData, PremierLeagueSeam } from "./seam";
import { MatchMarks } from "./MatchMarks";
import { MatchPlayerStats, PointsCell, StatViewSwitch, ViewSwitch } from "./MatchPlayerStats";
import { MatchPitch, offPitch } from "./MatchPitch";
import { MatchManPanel } from "./MatchManPanel";
import { TeamStats } from "./MatchTeamStats";
import { PlateTabs } from "../ui/PlateTabs";
import { MatchState } from "./MatchState";
import { AbandonedMark } from "./AbandonedMark";
import {
  backLabel,
  backWords,
  cameOnWords,
  COMMENTARY_TITLE,
  goalsWords,
  highlightsNotHeldLabel,
  inGameweekWords,
  LINEUP_VIEWS,
  lineupViewLabel,
  lineupViewWords,
  type LineupView,
  livePointsDelayedWords,
  loadingMatchWords,
  MATCH_TITLE,
  MATCH_TABS,
  matchColumns,
  type MatchTab,
  type StatView,
  matchTabsLabel,
  matchTabWords,
  matchWhereWords,
  MOVED_TITLE,
  noFigureWords,
  noLinesWords,
  noMatchWords,
  noMenWords,
  pointsProblemWords,
  previousGlyph,
  provisionalWords,
  provWords,
  SCORE_LABEL,
  scorersLabel,
  scorersWords,
  sheetLabel,
  SUBSTITUTES_TITLE,
  unusedLabel,
  versusWords,
} from "./words";

/** One real Premier League match (spec/10, The match page), live: the score and clock, each club's
 *  team sheet with every man's points and the team they're for, or "Free agent", the five team
 *  stats, and the match's commentary, newest first. Opened from the Premier League's fixtures (spec/18) and from a
 *  player's status on the matchup. `picked`, from the address, is the man whose panel is open (S10.9). */
export function MatchPage({ league, seam, fixtureCode, picked, isAdmin }: { league: LeagueSummary; seam: PremierLeagueSeam; fixtureCode: number; picked?: number; isAdmin: boolean }) {
  const match = seam.useMatch(league.leagueId, useMinute(), fixtureCode);
  const navigate = useNavigate();
  // Into the address, replacing it, so Back from his card and a reload keep him.
  const picking: Picking = { leagueId: league.leagueId, picked, pick: (playerCode) => void navigate({ to: matchPath(fixtureCode), search: { player: playerCode }, replace: true }) };
  return (
    <PageSection title={MATCH_TITLE} className={PAGE_STACK}>
      {match === undefined ? (
        <Loading>{loadingMatchWords}</Loading>
      ) : match === null ? (
        <p className="text-muted">{noMatchWords}</p>
      ) : (
        <HeldMatch match={match} picking={picking} mark={isAdmin ? <AbandonedMark seam={seam} fixtureCode={fixtureCode} abandoned={match.abandoned} /> : null} />
      )}
    </PageSection>
  );
}

/** The man whose panel is open on Overview (S10.9), and opening another's by his name. */
type Picking = { leagueId: string; picked: number | undefined; pick(playerCode: number): void };

/** `mark` is the admin's abandoned mark, at the scoreboard's foot; null for anyone else. */
function HeldMatch({ match, picking, mark }: { match: MatchPageData; picking: Picking; mark: ReactNode }) {
  const { pointsProblem, gameweek, provisional } = match;
  const [tab, choose] = useState<MatchTab>("overview");
  const [view, chooseView] = useState<StatView>("stats");
  const [lineupView, chooseLineupView] = useState<LineupView>("list");
  const prov = provisional ? <ProvTag /> : undefined;
  return (
    <>
      <BackRow gameweek={gameweek} />
      <Scoreboard match={match}>{mark}</Scoreboard>
      {/* Overview | Player stats | Highlights under the scoreboard (S10.8, S10.11); Highlights greyed until it is built. */}
      <div className="flex min-h-tap bg-plate text-lead shadow-bevel-plate">
        <PlateTabs label={matchTabsLabel} tabs={MATCH_TABS} words={matchTabWords} chosen={tab} choose={choose} greyed={{ highlights: highlightsNotHeldLabel }} alone />
        {tab === "playerStats" && <StatViewSwitch view={view} choose={chooseView} />}
        {tab === "overview" && (
          <ViewSwitch label={lineupViewLabel} name="match-lineup-view" views={LINEUP_VIEWS} words={lineupViewWords} view={lineupView} choose={chooseLineupView} />
        )}
      </div>
      {pointsProblem !== null && <Notice>{pointsProblemWords(pointsProblem)}</Notice>}
      {tab === "playerStats" ? <MatchPlayerStats match={match} aside={prov} view={view} /> : <Overview match={match} prov={prov} view={lineupView} picking={picking} />}
    </>
  );
}

/** The lineups beside the team stats and the commentary: two team sheets with List; with Pitch, both
 *  starting elevens on one pitch, each side's substitutes on its sheet beside it (S10.9). The picked
 *  man's panel tops the right column. */
function Overview({ match: { home, away, men, teamStats, commentary }, prov, view, picking }: { match: MatchPageData; prov: ReactNode; view: LineupView; picking: Picking }) {
  const pickedMan = men.find((man) => man.playerCode === picking.picked);
  const moved = men.filter((man) => man.side === null);
  const sideMen = { home: men.filter((man) => man.side === "home"), away: men.filter((man) => man.side === "away") };
  const beside = view === "pitch" ? offPitch : (each: MatchMan[]) => each;
  const sheets = (
    <>
      <TeamSheet title={home.name} men={beside(sideMen.home)} aside={prov} picking={picking} />
      <TeamSheet title={away.name} men={beside(sideMen.away)} aside={prov} picking={picking} />
    </>
  );
  return (
    <div className="grid items-start gap-2 lg:grid-cols-2 xl:grid-cols-3">
      {view === "pitch" ? (
        <>
          <div className="grid items-start gap-2">{sheets}</div>
          <MatchPitch home={home} away={away} men={men} pick={picking.pick} />
        </>
      ) : (
        sheets
      )}
      {/* Side by side under the lineups on the desk, stacked in the third column on a wide one. */}
      <div className="grid items-start gap-2 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
        {pickedMan !== undefined && (
          <MatchManPanel man={pickedMan} clubCode={pickedMan.side === null ? null : { home, away }[pickedMan.side].code} leagueId={picking.leagueId} prov={prov} />
        )}
        <TeamStats home={home} away={away} stats={teamStats} />
        <Vidiprinter commentary={commentary} title={COMMENTARY_TITLE} noLinesWords={noLinesWords} />
      </div>
      {moved.length > 0 && <TeamSheet title={MOVED_TITLE} men={moved} aside={prov} picking={picking} />}
    </div>
  );
}

/** Back to Football's fixtures in the match's gameweek, and where the match is (the approved
 *  picture's Back row): "◄ Back  Premier League, GW11". */
function BackRow({ gameweek }: { gameweek: number | null }) {
  return (
    <p className="flex items-center gap-3">
      <Link {...footballLink(gameweek)} aria-label={backLabel(gameweek)} className="flex min-h-tap min-w-tap items-center gap-1 text-soft hover:text-fact lg:min-h-0 lg:min-w-0">
        <span aria-hidden="true">{previousGlyph}</span>
        {backWords}
      </Link>
      <span className="text-muted">{matchWhereWords(gameweek)}</span>
    </p>
  );
}

/** The sheets' points are live until the gameweek's are final (spec/10 S10.10). */
function ProvTag() {
  return (
    <span title={provisionalWords} className="font-normal text-muted">
      {provWords}
    </span>
  );
}

/** The clubs with the score between them, or "v" before kickoff, and where the match stands. */
function Scoreboard({ match: { home, away, score, kickoff, gameweek, pointsDelayed, scorers }, children }: { match: MatchPageData; children: ReactNode }) {
  const goals = goalsWords(score);
  return (
    <section aria-label={SCORE_LABEL} className="bg-panel shadow-bevel-panel">
      <p className="grid grid-cols-sides items-baseline gap-3 px-3 pt-2 text-lead font-bold sm:text-title">
        <ScoreboardSide club={home} className="justify-self-end" />
        {goals === null ? <span className="text-muted">{versusWords}</span> : <span className="whitespace-nowrap text-figure">{goals}</span>}
        <ScoreboardSide club={away} className="justify-self-start" />
      </p>
      <div className="grid grid-cols-sides items-baseline gap-3 px-3 pb-2">
        <Scorers club={home} goals={scorers.home} className="text-left" />
        <p aria-live="polite" className="text-center">
          <MatchState score={score} kickoff={kickoff} long />
          {gameweek !== null && <span className="text-muted">{inGameweekWords(gameweek)}</span>}
        </p>
        <Scorers club={away} goals={scorers.away} className="text-right" />
      </div>
      <Status words={pointsDelayed ? livePointsDelayedWords : null} className="alert-strip" />
      {children}
    </section>
  );
}

/** A side's scorers under its name (S10.7; the approved picture: home's left, away's right); an
 *  empty cell before its first goal, keeping the clock in the middle. */
function Scorers({ club, goals, className }: { club: Club; goals: MatchPageData["scorers"]["home"]; className: string }) {
  return (
    <p aria-label={scorersLabel(club.name)} className={`text-soft ${className}`}>
      {scorersWords(goals)}
    </p>
  );
}

/** The ink a club's name takes on its colour: styles.css's two, as the shirts' numbers take them. */
const SIDE_INKS: Record<Ink, string> = { dark: "text-ground", light: "text-fact" };

/** One side of the scoreboard: the club's crest and name on its first colour (spec/10, The match
 *  page; spec/12, Club colours), inked in whichever of the two inks reads on it. */
function ScoreboardSide({ club, className }: { club: Club; className: string }) {
  const { primary } = useClubColours()(club.code);
  return (
    <span data-club-side={club.shortName} className={`display-face inline-flex items-center px-2 ${SIDE_INKS[inkOn(primary)]} ${className}`} style={{ backgroundColor: primary }}>
      <ClubMark code={club.code} />
      <ClubLink club={club} className="text-inherit">
        {club.name}
      </ClubLink>
    </span>
  );
}

type Club = MatchPageData["home"];

/** A club's men as the sheet named them: the starters, then a Substitutes plate and the bench. */
function TeamSheet({ title, men, aside, picking }: { title: string; men: MatchMan[]; aside: ReactNode; picking: Picking }) {
  const starters = men.filter((man) => man.started);
  const substitutes = men.filter((man) => !man.started);
  return (
    <Panel title={title} aside={aside}>
      {men.length === 0 ? (
        <PanelNote>{noMenWords}</PanelNote>
      ) : (
        <table aria-label={sheetLabel(title)} className="w-full border-collapse">
          <ColumnHeads columns={matchColumns} classOf={(column) => (column === "player" || column === "owner" ? "px-2 text-left" : "px-2 text-right")} />
          <tbody>
            {starters.map((man) => (
              <ManRow key={man.playerCode} man={man} picking={picking} />
            ))}
            {substitutes.length > 0 && (
              <tr>
                <th colSpan={Object.keys(matchColumns).length} scope="colgroup" className="bg-plate px-3 text-left font-bold shadow-bevel-plate">
                  {SUBSTITUTES_TITLE}
                </th>
              </tr>
            )}
            {substitutes.map((man) => (
              <ManRow key={man.playerCode} man={man} picking={picking} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** One man: an unused substitute greyed, one who came on marked, his goals, assists and cards
 *  marked after his name (S10.9), the team his points are for under Owner (S10.7), or "Free agent"
 *  for a man no lineup held at the deadline (once waivers are built, a man on waivers reads so
 *  instead), the viewer's own men lit, and his points, greyed while his team's lineup doesn't count
 *  them, as the matchup greys a bench man (spec/14). A free agent's show plainly: "people don't
 *  think grey means no teams" (Craig, 31 Oct 2026). His name opens his panel, and the picked man's
 *  row has the cyan bar (S10.9). */
function ManRow({ man, picking }: { man: MatchMan; picking: Picking }) {
  const { playerCode, name, position, started, played, ownerTeamName, mine, marks } = man;
  const unused = !started && played === false;
  const isPicked = picking.picked === playerCode;
  return (
    <tr aria-current={isPicked || undefined} className={`border-t border-panel-rule aria-current:shadow-current-edge ${unused ? "text-muted" : ""} ${mine ? "bg-row-lit" : ""}`}>
      <td className="px-2 text-right">{position === null ? noFigureWords : <PositionCode position={position} />}</td>
      <th scope="row" className={`px-2 text-left font-semibold ${unused ? "" : "text-lead"}`}>
        <button type="button" aria-expanded={isPicked} onClick={() => picking.pick(playerCode)} className="min-h-tap text-left font-semibold lg:min-h-0">
          {name}
        </button>
        <MatchMarks marks={marks} />
        {!started && played === true && <span className="ml-2 font-normal text-event">{cameOnWords}</span>}
        {unused && <span className="sr-only"> {unusedLabel}</span>}
      </th>
      <td className={`px-2 text-left ${mine ? "font-semibold text-fact" : ownerTeamName === null ? "" : "text-soft"}`}>
        <OwnerName teamName={ownerTeamName} />
      </td>
      <PointsCell man={man} />
    </tr>
  );
}
