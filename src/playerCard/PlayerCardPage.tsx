import { useCanGoBack, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { PositionCode, PositionCodes } from "../PositionCodes";
import { SCOUTING_PATH } from "../frame/menu";
import { Loading, PageSection, PANEL_BODY, PanelNote, PanelTitle } from "../frame/Panel";
import { useMinute } from "../useMinute";
import { gameweekWords, versusWords, whenWords } from "../words";
import type { PlayedMatch, PlayerCard, PlayerCardSeam } from "./seam";
import { OverridePoints } from "./OverridePoints";
import { ShortlistAction } from "./ShortlistAction";
import {
  backWords,
  breakdownLabel,
  chanceWords,
  clubLabel,
  columns,
  freeAgentWords,
  goneWords,
  LAST_SEASON_TITLE,
  listSeparator,
  lastSeasonNotHeldWords,
  loadingWords,
  NEXT_FIXTURES_TITLE,
  newsLabel,
  noFigureWords,
  noFixturesWords,
  noMatchesWords,
  noNewsWords,
  noPositionsWords,
  noSuchPlayerWords,
  notArrivedWords,
  nothingPaidWords,
  overriddenWords,
  ownerLabel,
  PLAYER_TITLE,
  positionsLabel,
  pricedNotes,
  SEASON_TITLE,
} from "./words";

const FACTS_ID = "card-facts";
const SEASON_ID = "card-season";
const LAST_SEASON_ID = "card-last-season";
const FIXTURES_ID = "card-fixtures";

/** A player's card (spec/12, The player card), its own page, for anyone in the league: who he is
 *  and who owns him, FPL's news, this season's matches by category, last season's line and his
 *  club's next fixtures. Its actions (shortlist, scout, claim or drop, trade) join below the facts
 *  as each is built: the shortlist is (#374), and for whoever `runs` the league, the override (#32). */
export function PlayerCardPage({ league, runs, playerCode, seam }: { league: LeagueSummary; runs: boolean; playerCode: number; seam: PlayerCardSeam }) {
  const card = seam.usePlayerCard(league.leagueId, playerCode, useMinute());
  return (
    <PageSection title={card?.fullName ?? PLAYER_TITLE} aside={<Back />} className="flex max-w-6xl flex-col gap-2">
      {card === undefined ? (
        <Loading className="bg-panel px-3 py-2">{loadingWords}</Loading>
      ) : card === null ? (
        <p className="bg-panel px-3 py-2 text-muted">{noSuchPlayerWords}</p>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-2">
            <Facts card={card}>
              <ShortlistAction leagueId={league.leagueId} playerCode={card.code} gone={card.gone} seam={seam} />
              {runs && <OverridePoints leagueId={league.leagueId} card={card} seam={seam} />}
            </Facts>
            <section aria-labelledby={LAST_SEASON_ID} className="bg-panel">
              <PanelTitle id={LAST_SEASON_ID}>{LAST_SEASON_TITLE}</PanelTitle>
              <PanelNote>{lastSeasonNotHeldWords}</PanelNote>
            </section>
            <NextFixtures card={card} />
          </div>
          <Season card={card} />
        </div>
      )}
    </PageSection>
  );
}

/** Back where the manager came from; to Scouting when the card was opened straight from a link. */
function Back() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const goBack = () => (canGoBack ? router.history.back() : void router.navigate({ to: SCOUTING_PATH }));
  return (
    <button type="button" onClick={goBack} className="secondary-action">
      {backWords}
    </button>
  );
}

/** The facts at the card's head, and under them its actions. */
function Facts({ card, children }: { card: PlayerCard; children: ReactNode }) {
  return (
    <section aria-labelledby={FACTS_ID} className="bg-panel">
      <PanelTitle id={FACTS_ID}>{PLAYER_TITLE}</PanelTitle>
      <dl className={`${PANEL_BODY} grid grid-cols-[auto_1fr] gap-x-3`}>
        <dt className="text-soft">{clubLabel}</dt>
        <dd>{card.club.name}</dd>
        <dt className="text-soft">{positionsLabel}</dt>
        <dd>{card.positions.length === 0 ? <span className="text-muted">{noPositionsWords}</span> : <PositionCodes positions={card.positions} />}</dd>
        <dt className="text-soft">{ownerLabel}</dt>
        <dd className={card.ownerTeamName === null ? "text-muted" : undefined}>{card.ownerTeamName ?? freeAgentWords}</dd>
        <dt className="text-soft">{newsLabel}</dt>
        {/* FPL's news names his chance of playing itself, so the chance stands alone only without news. */}
        {card.news !== null ? (
          <dd className="text-event">{card.news}</dd>
        ) : card.chanceOfPlaying !== null ? (
          <dd className="text-event">{chanceWords(card.chanceOfPlaying)}</dd>
        ) : (
          <dd className="text-muted">{noNewsWords}</dd>
        )}
      </dl>
      {card.gone && <PanelNote edge="b">{goneWords}</PanelNote>}
      {children}
    </section>
  );
}

/** "ARS v COV", each club's full name on hover. */
function MatchName({ match }: { match: Pick<PlayedMatch, "home" | "away"> }) {
  return (
    <>
      <abbr title={match.home.name} className="no-underline">
        {match.home.shortName}
      </abbr>{" "}
      {versusWords}{" "}
      <abbr title={match.away.name} className="no-underline">
        {match.away.shortName}
      </abbr>
    </>
  );
}

type Column = keyof typeof columns;
const COLUMNS: readonly Column[] = ["gameweek", "match", "minutes", "position", "points"];
const FIGURES: readonly Column[] = ["gameweek", "minutes", "points"];
const cellClasses = (column: Column) => `px-2 align-middle ${FIGURES.includes(column) ? "text-right" : "text-left"}`;

function Season({ card }: { card: PlayerCard }) {
  return (
    <section aria-labelledby={SEASON_ID} className="bg-panel">
      <PanelTitle id={SEASON_ID}>{SEASON_TITLE}</PanelTitle>
      {card.matches.length === 0 ? (
        <PanelNote>{noMatchesWords}</PanelNote>
      ) : (
        <>
          {/* Every match is priced alike until #29 keeps lineups. */}
          <PanelNote>{pricedNotes[card.matches[0].points.scoredAs]}</PanelNote>
          <table className="w-full border-collapse">
            <thead className="bg-head text-ground">
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" title={columns[column].long} className={cellClasses(column)}>
                    {columns[column].short}
                  </th>
                ))}
              </tr>
            </thead>
            {card.matches.map((match) => (
              <MatchRows key={match.fixtureCode} match={match} />
            ))}
          </table>
        </>
      )}
    </section>
  );
}

/** One match: its row of figures, the league's override in place of its points, and under it each
 *  category that paid, and the override's reason. */
function MatchRows({ match }: { match: PlayedMatch }) {
  const { position, categories } = match.points;
  const { override } = match;
  const total = override?.points ?? match.points.total;
  const paid = categories.filter((category) => category.points !== null && category.points !== 0);
  return (
    <tbody className="border-t border-panel-rule">
      <tr>
        <td className={cellClasses("gameweek")}>{match.gameweek}</td>
        <th scope="row" className={`${cellClasses("match")} font-normal`}>
          <MatchName match={match} />
        </th>
        <td className={cellClasses("minutes")}>{match.minutes ?? noFigureWords}</td>
        <td className={cellClasses("position")}>
          {position === null ? noFigureWords : <PositionCode position={position} />}
        </td>
        {total === null ? (
          <td title={notArrivedWords} className={`${cellClasses("points")} text-muted`}>
            {noFigureWords}
          </td>
        ) : (
          <td className={`${cellClasses("points")} font-bold text-figure`}>{total}</td>
        )}
      </tr>
      {total !== null && (
        <tr>
          {/* Under the match it breaks down, past the gameweek's column. */}
          <td />
          <td colSpan={COLUMNS.length - 1} aria-label={breakdownLabel(match.gameweek)} className="px-2 pb-1 text-soft">
            {paid.length === 0
              ? nothingPaidWords
              : paid.map((category, index) => (
                  <span key={category.stat}>
                    {index > 0 && listSeparator}
                    {category.name} <span className="text-figure">{category.points}</span>
                  </span>
                ))}
          </td>
        </tr>
      )}
      {override !== null && (
        <tr>
          <td />
          <td colSpan={COLUMNS.length - 1} className="px-2 pb-1 text-event">
            {overriddenWords(override.points, override.reason)}
          </td>
        </tr>
      )}
    </tbody>
  );
}

function NextFixtures({ card }: { card: PlayerCard }) {
  return (
    <section aria-labelledby={FIXTURES_ID} className="bg-panel">
      <PanelTitle id={FIXTURES_ID}>{NEXT_FIXTURES_TITLE}</PanelTitle>
      {card.nextFixtures.length === 0 ? (
        <PanelNote>{noFixturesWords}</PanelNote>
      ) : (
        <ul className="py-1">
          {card.nextFixtures.map((fixture) => (
            <li key={fixture.fixtureCode} className="grid grid-cols-[6rem_1fr_auto] gap-2 px-3">
              <span className="text-soft">{fixture.gameweek === null ? noFigureWords : gameweekWords(fixture.gameweek)}</span>
              <span>
                <MatchName match={fixture} />
              </span>
              <span>{fixture.kickoff === null ? noFigureWords : whenWords(fixture.kickoff)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
