import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { clubResultOf, goalsOf } from "../../convex/football/clubFixtures";
import { useMinute } from "../shared/useMinute";
import { formHead, gameweekShort, tableHead } from "../shared/words";
import { ClubMark } from "../ui/ClubName";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { FormChips, ResultChip } from "../ui/FormChips";
import { Loading, PAGE_STACK, PageSection, Panel, PANEL_COLUMNS, PanelNote } from "../ui/Panel";
import { PlateTabs } from "../ui/PlateTabs";
import { ClubLink } from "./ClubLink";
import { MatchState } from "./MatchState";
import { matchPath } from "./paths";
import type { ClubPageData, ClubPageFixture, PremierLeagueSeam } from "./seam";
import {
  CLUB_TABS,
  CLUB_TITLE,
  clubFixtureColumns,
  clubTabsLabel,
  clubTabWords,
  daysAwayWords,
  goalsWords,
  kickoffDayWords,
  kickoffHead,
  loadingClubWords,
  matchLinkLabel,
  NEXT_MATCH_TITLE,
  noClubFixturesWords,
  noClubWords,
  noDateWords,
  noNextMatchWords,
  notInTableWords,
  placeWords,
  scoreWords,
  venueWords,
  type ClubTab,
} from "./words";

/** A real club's page under Football (spec/18, Club pages): its mark and name on the title plate
 *  with its tabs; its table place and last five results beside its next match as an opponent card
 *  (`S18.7`); and the Fixtures tab, its matches this season, each opening its match page (`S18.9`).
 *  No difficulty colours. */
export function ClubPage({ league, seam, clubCode }: { league: LeagueSummary; seam: PremierLeagueSeam; clubCode: number }) {
  const page = seam.useClub(league.leagueId, clubCode);
  const [tab, choose] = useState<ClubTab>("fixtures");
  if (page === undefined || page === null) {
    return (
      <PageSection title={CLUB_TITLE} className="bg-panel">
        {page === undefined ? <Loading className="px-3 py-2">{loadingClubWords}</Loading> : <PanelNote>{noClubWords}</PanelNote>}
      </PageSection>
    );
  }
  const title = (
    <>
      <ClubMark code={page.club.code} />
      {page.club.name}
    </>
  );
  const tabs = <PlateTabs label={clubTabsLabel} tabs={CLUB_TABS} words={clubTabWords} chosen={tab} choose={choose} />;
  return (
    <PageSection title={title} aside={tabs} className={PAGE_STACK}>
      <div className={PANEL_COLUMNS}>
        <Panel title={CLUB_TITLE}>
          <dl className="grid grid-cols-facts items-center gap-x-3 gap-y-2 p-3">
            <dt className="text-muted">{tableHead}</dt>
            <dd className="font-bold text-figure">{page.position === null ? notInTableWords : placeWords(page.position)}</dd>
            <dt className="text-muted">{formHead}</dt>
            <dd>
              <FormChips form={page.form} />
            </dd>
          </dl>
        </Panel>
        <NextMatch next={page.next} />
      </div>
      <ClubFixtures club={page.club} fixtures={page.fixtures} />
    </PageSection>
  );
}

/** The opponent card (`S18.7`): who the club meets next and where, their table place and form, and
 *  how many days away, the kickoff opening the match page. */
function NextMatch({ next }: { next: ClubPageData["next"] }) {
  const now = useMinute();
  return (
    <Panel title={NEXT_MATCH_TITLE}>
      {next === null ? (
        <PanelNote>{noNextMatchWords}</PanelNote>
      ) : (
        <div className="flex flex-col gap-2 p-3">
          <span className="text-lead font-semibold">
            <ClubMark code={next.opponent.code} />
            <ClubLink club={next.opponent} /> {venueWords(next.atHome)}
          </span>
          <dl className="grid grid-cols-facts items-center gap-x-3 gap-y-2">
            <dt className="text-muted">{tableHead}</dt>
            <dd>{next.opponentPosition === null ? notInTableWords : placeWords(next.opponentPosition)}</dd>
            <dt className="text-muted">{formHead}</dt>
            <dd>
              <FormChips form={next.opponentForm} />
            </dd>
            <dt className="text-muted">{kickoffHead}</dt>
            <dd>
              <Link to={matchPath(next.fixtureCode)} className="inline-flex min-h-tap items-center lg:min-h-0">{kickoffDayWords(next.kickoff)}</Link> <span className="text-derived">{daysAwayWords(next.kickoff, now)}</span>
            </dd>
          </dl>
        </div>
      )}
    </Panel>
  );
}

type Column = keyof typeof clubFixtureColumns;
const cellClasses = (column: Column) => cellClassOf(column !== "gameweek");

/** The Fixtures tab (`S18.9`): every match the club plays this season, in kickoff order, with its
 *  gameweek, the opponent and home or away, and its result or kick-off opening its match page. */
function ClubFixtures({ club, fixtures }: { club: ClubPageData["club"]; fixtures: ClubPageData["fixtures"] }) {
  return (
    <Panel title={clubTabWords.fixtures}>
      {fixtures.length === 0 ? (
        <PanelNote>{noClubFixturesWords}</PanelNote>
      ) : (
        <table className="w-full border-collapse">
          <ColumnHeads columns={clubFixtureColumns} classOf={cellClasses} />
          <tbody>
            {fixtures.map((fixture) => (
              <tr key={fixture.fixtureCode} className="border-t border-panel-rule">
                <td className={`${cellClasses("gameweek")} text-muted`}>{fixture.gameweek === null ? "" : gameweekShort(fixture.gameweek)}</td>
                <th scope="row" className={`${cellClasses("opponent")} font-semibold`}>
                  <ClubMark code={fixture.opponent.code} />
                  <ClubLink club={fixture.opponent} /> <span className="font-normal text-muted">{venueWords(fixture.atHome)}</span>
                </th>
                <td className={cellClasses("result")}>
                  <FixtureResult club={club} fixture={fixture} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** A match's result from the club's side, its chip and score once at full time; the clock and the
 *  score while it is played; its kick-off before; a link to its match page all the same. */
function FixtureResult({ club, fixture }: { club: ClubPageData["club"]; fixture: ClubPageFixture }) {
  const goals = goalsOf(fixture);
  const result = clubResultOf(fixture);
  const [home, away] = fixture.atHome ? [club, fixture.opponent] : [fixture.opponent, club];
  return (
    <Link to={matchPath(fixture.fixtureCode)} aria-label={matchLinkLabel(home.name, away.name, goalsWords(fixture.score))} className="inline-flex min-h-tap items-center gap-2 lg:min-h-0">
      {result !== null && <ResultChip result={result} />}
      {goals === null ? (
        fixture.kickoff === null ? (
          <span className="text-muted">{noDateWords}</span>
        ) : (
          <span>{kickoffDayWords(fixture.kickoff)}</span>
        )
      ) : (
        <>
          {result === null && <MatchState kickoff={fixture.kickoff} score={fixture.score} long={false} />}
          <span className="whitespace-nowrap font-bold text-figure">{scoreWords(goals.scored, goals.conceded)}</span>
        </>
      )}
    </Link>
  );
}
