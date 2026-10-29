import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { MatchupSide, MatchupSlot } from "../../convex/matchup/matchupShape";
import { ColumnHeads } from "../frame/ColumnHeads";
import { Loading, PageSection, Panel, PanelNote } from "../frame/Panel";
import { useMinute } from "../useMinute";
import { matchPath } from "../premierLeague/paths";
import { matchupLink } from "./paths";
import { Vidiprinter } from "./Vidiprinter";
import type { Matchup, MatchupAsked, MatchupSeam } from "./seam";
import {
  AREA_CODES,
  AREA_WORDS,
  autoSubWords,
  averageWords,
  BENCH_TITLE,
  byeWords,
  columns,
  finalWords,
  gameweekWords,
  leagueAverageWords,
  lineupLabel,
  loadingWords,
  MATCHUP_TITLE,
  nextGlyph,
  nextLabel,
  noFigureWords,
  noGamesWords,
  noGameWords,
  noCommentaryWords,
  noLineupWords,
  noRulesWords,
  notBegunWords,
  notCountingLabel,
  noTeamWords,
  previousGlyph,
  previousLabel,
  provisionalWords,
  SCORE_LABEL,
  scoreWords,
  statusLabels,
  statusWords,
  totalPointsWords,
  unscoredWords,
  versusWords,
  VIDIPRINTER_TITLE,
} from "./words";

type HeadToHead = Extract<Matchup, { kind: "headToHead" }>;
type Scored = Extract<HeadToHead["game"], { kind: "scored" }>;

/** The matchup (spec/10, The matchup, as a live match; spec/12): one head-to-head in one gameweek,
 *  the totals as the score at the top, both lineups under it, live until every match is final.
 *  A manager lands on My team (spec/12); this is a tab away, and any fixture links here. */
export function MatchupPage({ league, seam, asked }: { league: LeagueSummary; seam: MatchupSeam; asked: MatchupAsked }) {
  const matchup = useLastWhileLoading(seam.useMatchup(league.leagueId, useMinute(), asked), `${asked.teamId}/${asked.gameweek}`);
  return (
    <PageSection title={MATCHUP_TITLE} className="flex max-w-6xl flex-col gap-2">
      {matchup === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : matchup === null ? (
        <p className="text-muted">{noRulesWords}</p>
      ) : matchup.kind === "totalPoints" ? (
        <p className="text-muted">{totalPointsWords}</p>
      ) : matchup.kind === "noTeam" ? (
        <p className="text-muted">{noTeamWords}</p>
      ) : (
        <HeadToHeadMatchup matchup={matchup} />
      )}
    </PageSection>
  );
}

/** The matchup asked for, the last one held while the next minute's loads: the minute is in the
 *  query's arguments, and a live matchup mustn't blank every minute. Another matchup asked for
 *  (`key`) loads afresh. */
function useLastWhileLoading(matchup: Matchup | null | undefined, key: string): Matchup | null | undefined {
  const [held, setHeld] = useState<{ key: string; matchup: Matchup | null }>();
  if (matchup !== undefined && (held?.matchup !== matchup || held.key !== key)) setHeld({ key, matchup });
  return matchup !== undefined ? matchup : held?.key === key ? held.matchup : undefined;
}

function HeadToHeadMatchup({ matchup }: { matchup: HeadToHead }) {
  const { teamName, gameweek, deadline, game } = matchup;
  if (gameweek === null) return <p className="text-muted">{noGamesWords(teamName)}</p>;
  return (
    <>
      <Stepper matchup={matchup} gameweek={gameweek} />
      {game.kind === "scored" ? (
        <ScoredMatchup game={game} />
      ) : (
        <div className="bg-panel">
          {game.kind === "none" ? (
            <PanelNote>{noGameWords(teamName, gameweek)}</PanelNote>
          ) : game.kind === "bye" ? (
            <PanelNote>{byeWords(teamName)}</PanelNote>
          ) : (
            <>
              <Fixture teamName={teamName} opponent={game.opponent.kind === "team" ? game.opponent.teamName : leagueAverageWords} />
              <PanelNote>{game.kind === "notBegun" ? notBegunWords(deadline) : unscoredWords(game.reason)}</PanelNote>
            </>
          )}
        </div>
      )}
    </>
  );
}

const stepClasses = "flex min-w-tap items-center justify-center text-lead font-bold";

/** CM's ◄ GW ► stepper over the gameweeks the team plays, each a link to that gameweek's matchup. */
function Stepper({ matchup: { teamId, gameweeks }, gameweek }: { matchup: HeadToHead; gameweek: number }) {
  const index = gameweeks.indexOf(gameweek);
  const step = (to: number | undefined, label: string, glyph: string) =>
    to === undefined ? (
      <span aria-hidden="true" className={`${stepClasses} text-muted`}>
        {glyph}
      </span>
    ) : (
      <Link {...matchupLink(teamId, to)} aria-label={label} className={`${stepClasses} no-underline hover:bg-plate`}>
        <span aria-hidden="true">{glyph}</span>
      </Link>
    );
  return (
    <nav aria-label={gameweekWords(gameweek)} className="flex min-h-tap items-stretch bg-stepper">
      {step(index > 0 ? gameweeks[index - 1] : undefined, previousLabel, previousGlyph)}
      <h2 className="flex grow items-center justify-center text-lead font-bold">{gameweekWords(gameweek)}</h2>
      {step(index !== -1 && index < gameweeks.length - 1 ? gameweeks[index + 1] : undefined, nextLabel, nextGlyph)}
    </nav>
  );
}

const sideName = (side: MatchupSide) => (side.kind === "team" ? side.teamName : leagueAverageWords);

/** Two sides, the score between them once there is one. */
function Fixture({ teamName, opponent, score }: { teamName: string; opponent: string; score?: string }) {
  return (
    <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-3 px-3 py-2 text-lead font-bold sm:text-title">
      <span className="text-right">{teamName}</span>
      {score === undefined ? <span className="text-muted">{versusWords}</span> : <span className="text-figure whitespace-nowrap">{score}</span>}
      <span>{opponent}</span>
    </p>
  );
}

function ScoredMatchup({ game: { team, opponent, commentary } }: { game: Scored }) {
  const provisional = team.provisional || opponent.provisional;
  return (
    <>
      <section aria-label={SCORE_LABEL} className="bg-panel shadow-bevel-panel">
        <Fixture teamName={sideName(team)} opponent={sideName(opponent)} score={scoreWords(team.points, opponent.points)} />
        <p aria-live="polite" className={`px-3 pb-2 text-center ${provisional ? "text-derived" : "text-muted"}`}>
          {provisional ? provisionalWords : finalWords}
        </p>
      </section>
      <div className="grid items-start gap-2 lg:grid-cols-2">
        <SidePanel side={team} />
        <SidePanel side={opponent} />
        <Vidiprinter commentary={commentary} title={VIDIPRINTER_TITLE} noLinesWords={noCommentaryWords} className="lg:col-span-2" />
      </div>
    </>
  );
}

function SidePanel({ side }: { side: MatchupSide }) {
  const name = sideName(side);
  return (
    <Panel title={name}>
      {side.kind === "leagueAverage" ? (
        <PanelNote>{averageWords}</PanelNote>
      ) : side.lineup === null ? (
        <PanelNote>{noLineupWords(name)}</PanelNote>
      ) : (
        <table aria-label={lineupLabel(name)} className="w-full border-collapse">
          <ColumnHeads columns={columns} classOf={(column) => (column === "player" ? "px-2 text-left" : "px-2 text-right")} />
          <tbody>
            {side.lineup.starters.map((slot) => (
              <SlotRow key={slot.playerCode} slot={slot} />
            ))}
            <tr>
              <th colSpan={Object.keys(columns).length} scope="colgroup" className="bg-plate px-3 text-left font-bold shadow-bevel-plate">
                {BENCH_TITLE}
              </th>
            </tr>
            {side.lineup.bench.map((slot) => (
              <SlotRow key={slot.playerCode} slot={slot} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** One man: greyed while his points don't count (spec/14, On screen), his match's state, and what
 *  the auto-subs did with him. */
function SlotRow({ slot }: { slot: MatchupSlot }) {
  const { area, name, points, counts, status, autoSub } = slot;
  return (
    <tr className={`border-t border-panel-rule align-top ${counts ? "" : "text-muted"}`}>
      <td className="px-2 text-right">
        <abbr title={AREA_WORDS[area]} className="no-underline">
          {AREA_CODES[area]}
        </abbr>
      </td>
      <th scope="row" className={`px-2 text-left font-semibold ${counts ? "text-lead" : ""}`}>
        {name}
        {autoSub !== null && (
          <span className={`block text-data font-normal ${autoSub.kind === "on" ? "text-derived" : "text-muted"}`}>
            {autoSub.kind === "unreplaced" ? autoSubWords.unreplaced : autoSubWords[autoSub.kind](autoSub.playerName)}
          </span>
        )}
      </th>
      <td className={`px-2 text-right whitespace-nowrap ${status.kind === "playing" ? "text-derived" : ""}`}>
        {status.kind === "noMatch" ? (
          <StatusWords status={status} />
        ) : (
          // His match's page (spec/10, The match page), opened from his status.
          <Link to={matchPath(status.fixtureCode)} className="inline-flex min-h-tap items-center text-inherit lg:min-h-0">
            <StatusWords status={status} />
          </Link>
        )}
      </td>
      <td className={`px-2 text-right ${counts && points !== null ? "font-bold text-figure" : "text-muted"}`}>
        {points ?? noFigureWords}
        {!counts && <span className="sr-only"> {notCountingLabel}</span>}
      </td>
    </tr>
  );
}

/** His match's state, short, with the full words for screen readers. */
function StatusWords({ status }: { status: MatchupSlot["status"] }) {
  return (
    <>
      {/* The space between, not inside the hidden words, so a link's name keeps it. */}
      <span className="sr-only">{statusLabels[status.kind]}</span>{" "}
      <span aria-hidden={status.kind === "finished" || status.kind === "noMatch" ? true : undefined}>{statusText(status)}</span>
    </>
  );
}

function statusText(status: MatchupSlot["status"]): string {
  switch (status.kind) {
    case "yetToPlay":
      return statusWords.yetToPlay(status.kickoff);
    case "playing":
      return statusWords.playing(status.minute);
    case "finished":
      return statusWords.finished;
    case "noMatch":
      return statusWords.noMatch;
  }
}
