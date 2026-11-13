import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PageSection, Panel, PanelNote } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import { useMinute } from "../shared/useMinute";
import { gameweekShort, whenWords } from "../shared/words";
import { CardHead } from "./CardHead";
import { opponentWords } from "./gameLog";
import { MatchBreakdown } from "./MatchBreakdown";
import { MatchName } from "./MatchName";
import { OverridePoints } from "./OverridePoints";
import type { PlayerCard, PlayerCardSeam } from "./seam";
import { ScoutReport } from "./ScoutReport";
import { Season, usePricedAt } from "./SeasonPanel";
import {
  CAPTAIN_TITLE,
  captainLabel,
  chanceWords,
  difficultyNotRatedWords,
  hintNotHeldLabel,
  loadingWords,
  NEWS_TITLE,
  newsNotesLabel,
  nextFixturesTitle,
  noFigureWords,
  noFixturesWords,
  noNewsWords,
  noSuchPlayerWords,
  PLAYER_TITLE,
  ROLE_FIT_TITLE,
  roleFitLabel,
} from "./words";

/** A player's card (spec/12, The player card), its own page, for anyone in the league, laid out to
 *  its approved picture: his head across the top; down the left, FPL's news and his role fit; in the
 *  middle, this season's game log, his club's next fixtures and the club captain hint;
 *  down the right, the selected match's breakdown and his team's scout reports (#375). Whoever
 *  `runs` the league overrides a match's points from the breakdown (#32). */
export function PlayerCardPage({ league, runs, playerCode, seam }: { league: LeagueSummary; runs: boolean; playerCode: number; seam: PlayerCardSeam }) {
  const card = seam.usePlayerCard(league.leagueId, playerCode, useMinute());
  if (card === undefined || card === null) {
    return (
      <PageSection title={PLAYER_TITLE}>
        {card === undefined ? <Loading className="bg-panel px-3 py-2">{loadingWords}</Loading> : <p className="bg-panel px-3 py-2 text-muted">{noSuchPlayerWords}</p>}
      </PageSection>
    );
  }
  return <Card key={card.code} league={league} runs={runs} card={card} seam={seam} />;
}

function Card({ league, runs, card, seam }: { league: LeagueSummary; runs: boolean; card: PlayerCard; seam: PlayerCardSeam }) {
  const pricedAt = usePricedAt(card);
  // The newest match is selected when the card opens (the README's interaction notes).
  const [picked, pick] = useState<number | null>(null);
  const selected = card.matches.find((match) => match.fixtureCode === picked) ?? card.matches[0];
  return (
    <div className="flex flex-col gap-2">
      <CardHead league={league} card={card} shown={pricedAt.shown} seam={seam} />
      <div className="grid items-start gap-2 lg:grid-cols-card">
        <div className="flex flex-col gap-2">
          <News card={card} />
          <Panel title={ROLE_FIT_TITLE}>
            <div className="p-3">
              <Placeholder label={roleFitLabel} className="h-24 w-full" />
            </div>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Season card={card} pricedAt={pricedAt} selected={selected?.fixtureCode ?? null} select={pick} />
          <NextFixtures card={card} />
          <ClubCaptain />
        </div>
        <div className="flex flex-col gap-2">
          {selected !== undefined && (
            <MatchBreakdown match={selected} shown={pricedAt.shown} clubCode={card.club.code}>
              {/* Keyed on the match, so the form opens afresh on each match pressed (#1535). */}
              {runs && <OverridePoints key={selected.fixtureCode} leagueId={league.leagueId} card={card} selected={selected.fixtureCode} seam={seam} />}
            </MatchBreakdown>
          )}
          <ScoutReport leagueId={league.leagueId} playerCode={card.code} seam={seam} />
        </div>
      </div>
    </div>
  );
}

/** FPL's news on him, which names his chance of playing itself, so the chance stands alone only
 *  without news; then his news notes (spec/21), a placeholder until the news job is built. */
function News({ card }: { card: PlayerCard }) {
  const news = card.news ?? (card.chanceOfPlaying === null ? null : chanceWords(card.chanceOfPlaying));
  return (
    <Panel title={NEWS_TITLE}>
      {news === null ? <PanelNote>{noNewsWords}</PanelNote> : <p className="px-3 py-2 text-event">{news}</p>}
      <div className="border-t border-panel-rule p-3">
        <Placeholder label={newsNotesLabel} className="h-16 w-full" />
      </div>
    </Panel>
  );
}

/** His club's next fixtures in a single row (Craig, 7 Nov 2026), each cell's fill waiting for
 *  fixture difficulty (to-grill), so it is the placeholder's outline round the match. */
function NextFixtures({ card }: { card: PlayerCard }) {
  return (
    <Panel title={nextFixturesTitle(card.club.name)}>
      {card.nextFixtures.length === 0 ? (
        <PanelNote>{noFixturesWords}</PanelNote>
      ) : (
        <ul className="flex gap-px p-3">
          {card.nextFixtures.map((fixture) => {
            const opponent = opponentWords(fixture, card.club.code);
            return (
              <li key={fixture.fixtureCode} className="flex min-w-0 grow basis-0 flex-col gap-1">
                <span className="text-soft">{fixture.gameweek === null ? noFigureWords : gameweekShort(fixture.gameweek)}</span>
                <Placeholder label={`${opponent ?? ""} ${difficultyNotRatedWords}`.trim()} className="py-1 text-center font-semibold">
                  {opponent ?? <MatchName match={fixture} />}
                </Placeholder>
                <span className="text-muted">{fixture.kickoff === null ? noFigureWords : whenWords(fixture.kickoff)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** The club captain hint (spec/17 `S17.7`), a placeholder until it comes after the mini beta. */
function ClubCaptain() {
  return (
    <Panel title={CAPTAIN_TITLE}>
      <dl className="grid grid-cols-facts items-center gap-x-6 gap-y-2 p-3">
        <dt className="text-soft">{captainLabel}</dt>
        <dd>
          <Placeholder label={hintNotHeldLabel(captainLabel)} className="h-5 w-40" />
        </dd>
      </dl>
    </Panel>
  );
}
