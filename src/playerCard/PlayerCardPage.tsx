import { useCanGoBack, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { PositionCodes } from "../ui/PositionCodes";
import { OwnerName } from "../ui/OwnerName";
import { SCOUTING_PATH } from "../frame/menu";
import { Loading, PAGE_STACK, PageSection, Panel, PANEL_BODY, PanelNote } from "../ui/Panel";
import { useMinute } from "../shared/useMinute";
import { gameweekWords, whenWords } from "../shared/words";
import type { PlayerCard, PlayerCardSeam } from "./seam";
import { MatchName } from "./MatchName";
import { Season } from "./SeasonPanel";
import { OverridePoints } from "./OverridePoints";
import { ShortlistAction } from "./ShortlistAction";
import {
  backWords,
  chanceWords,
  clubLabel,
  goneWords,
  LAST_SEASON_TITLE,
  lastSeasonNotHeldWords,
  loadingWords,
  NEXT_FIXTURES_TITLE,
  newsLabel,
  noFigureWords,
  noFixturesWords,
  noNewsWords,
  noPositionsWords,
  noSuchPlayerWords,
  ownerLabel,
  PLAYER_TITLE,
  positionsLabel,
} from "./words";

/** A player's card (spec/12, The player card), its own page, for anyone in the league: who he is
 *  and who owns him, FPL's news, this season's matches by category, last season's line and his
 *  club's next fixtures. Its actions (shortlist, scout, claim or drop, trade) join below the facts
 *  as each is built: the shortlist is (#374), and for whoever `runs` the league, the override (#32). */
export function PlayerCardPage({ league, runs, playerCode, seam }: { league: LeagueSummary; runs: boolean; playerCode: number; seam: PlayerCardSeam }) {
  const card = seam.usePlayerCard(league.leagueId, playerCode, useMinute());
  return (
    <PageSection title={card?.fullName ?? PLAYER_TITLE} aside={<Back />} className={PAGE_STACK}>
      {card === undefined ? (
        <Loading className="bg-panel px-3 py-2">{loadingWords}</Loading>
      ) : card === null ? (
        <p className="bg-panel px-3 py-2 text-muted">{noSuchPlayerWords}</p>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-card">
          <div className="flex flex-col gap-2">
            <Facts card={card}>
              <ShortlistAction leagueId={league.leagueId} playerCode={card.code} gone={card.gone} seam={seam} />
              {runs && <OverridePoints leagueId={league.leagueId} card={card} seam={seam} />}
            </Facts>
            <Panel title={LAST_SEASON_TITLE}>
              <PanelNote>{lastSeasonNotHeldWords}</PanelNote>
            </Panel>
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
    <Panel title={PLAYER_TITLE}>
      <dl className={`${PANEL_BODY} grid grid-cols-facts gap-x-3`}>
        <dt className="text-soft">{clubLabel}</dt>
        <dd>{card.club.name}</dd>
        <dt className="text-soft">{positionsLabel}</dt>
        <dd>{card.positions.length === 0 ? <span className="text-muted">{noPositionsWords}</span> : <PositionCodes positions={card.positions} />}</dd>
        <dt className="text-soft">{ownerLabel}</dt>
        <dd>
          <OwnerName teamName={card.ownerTeamName} />
        </dd>
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
    </Panel>
  );
}

function NextFixtures({ card }: { card: PlayerCard }) {
  return (
    <Panel title={NEXT_FIXTURES_TITLE}>
      {card.nextFixtures.length === 0 ? (
        <PanelNote>{noFixturesWords}</PanelNote>
      ) : (
        <ul className="py-1">
          {card.nextFixtures.map((fixture) => (
            <li key={fixture.fixtureCode} className="grid grid-cols-next-fixture gap-2 px-3">
              <span className="text-soft">{fixture.gameweek === null ? noFigureWords : gameweekWords(fixture.gameweek)}</span>
              <span>
                <MatchName match={fixture} />
              </span>
              <span>{fixture.kickoff === null ? noFigureWords : whenWords(fixture.kickoff)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
