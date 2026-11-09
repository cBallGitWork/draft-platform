import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useId, type ReactNode } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { SCOUTING_PATH } from "../frame/menu";
import { otherTeamPath } from "../myTeam/paths";
import { ClubMark } from "../ui/ClubName";
import { OwnerName } from "../ui/OwnerName";
import { Placeholder } from "../ui/Placeholder";
import { PositionChip } from "../ui/PositionChip";
import { seasonFigures } from "./gameLog";
import type { PlayerCard, PlayerCardSeam } from "./seam";
import { ScoutAction } from "./ScoutAction";
import { ShortlistAction } from "./ShortlistAction";
import { WaiverAction } from "./WaiverAction";
import {
  backWords,
  figureLabels,
  figureWords,
  goneWords,
  noFigureWords,
  noPositionsWords,
  offerTradeWords,
  ownedByWords,
  portraitLabel,
  statusNotSettledLabel,
  tradeNotBuiltLabel,
} from "./words";

/** The card's head, across the page (the approved picture): Back, his portrait, his name, positions,
 *  club and owner, his figures beside them at the position the switch is on, and his actions. It
 *  holds the page's one heading, his name. */
export function CardHead({ league, card, shown, seam }: { league: LeagueSummary; card: PlayerCard; shown: number; seam: PlayerCardSeam }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-plate px-3 py-2 shadow-bevel-plate">
      <Back />
      <Placeholder label={portraitLabel} className="h-16 w-14 shrink-0" />
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <h1 id={titleId} className="text-title display-face">
            {card.fullName}
          </h1>
          {card.chanceOfPlaying !== null && <Placeholder label={statusNotSettledLabel} className="h-5 w-10 shrink-0" />}
          {card.gone && <span className="text-event">{goneWords}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex gap-px">
            {card.positions.length === 0 ? <span className="text-muted">{noPositionsWords}</span> : card.positions.map((position) => <PositionChip key={position} label={position} />)}
          </span>
          <span>
            <ClubMark code={card.club.code} />
            {card.club.name}
          </span>
          <span>
            <span className="text-soft">{ownedByWords}</span> <Owner leagueId={league.leagueId} card={card} />
          </span>
        </span>
      </div>
      <Figures card={card} shown={shown} />
      <div className="ml-auto flex flex-wrap items-start gap-2">
        <Actions league={league} card={card} seam={seam} />
      </div>
    </section>
  );
}

/** His owner's name, which opens that team's squad, read-only (#1027); a free agent's is plain. */
function Owner({ leagueId, card }: { leagueId: LeagueSummary["leagueId"]; card: PlayerCard }) {
  if (card.ownerTeamId === null) return <OwnerName teamName={card.ownerTeamName} />;
  return (
    <Link to={otherTeamPath(leagueId, card.ownerTeamId)}>
      <OwnerName teamName={card.ownerTeamName} />
    </Link>
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

/** His figures beside his name (spec/12 S12.1; #1027): base points this season, a match, his
 *  minutes and his last five matches' points, newest first. */
function Figures({ card, shown }: { card: PlayerCard; shown: number }) {
  const { seasonPoints, aMatch, minutes, lastFive } = seasonFigures(card.matches, shown);
  const figure = (value: number | null) => (value === null ? noFigureWords : figureWords(value));
  return (
    <dl className="flex gap-6 border-l border-plate-rule pl-6">
      <Figure label={figureLabels.seasonPoints}>{figure(seasonPoints)}</Figure>
      <Figure label={figureLabels.aMatch}>{figure(aMatch)}</Figure>
      <Figure label={figureLabels.minutes}>{figure(minutes)}</Figure>
      <Figure label={figureLabels.lastFive}>
        {lastFive.length === 0 ? (
          noFigureWords
        ) : (
          <span className="flex gap-px">
            {lastFive.map(({ fixtureCode, points }) => (
              <span key={fixtureCode} className="min-w-chip bg-name-plate px-1 text-center text-data">
                {figureWords(points)}
              </span>
            ))}
          </span>
        )}
      </Figure>
    </dl>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-soft">{label}</dt>
      <dd className="text-heading font-bold text-figure">{children}</dd>
    </div>
  );
}

/** The actions that follow who he is (#1027): another team's player, the shortlist, a scout and a
 *  trade; a free agent's, Claim or Pick up in place of the trade; the manager's own, Drop alone.
 *  Trades aren't built (#383), so the offer is a placeholder, never a dead button. */
function Actions({ league, card, seam }: { league: LeagueSummary; card: PlayerCard; seam: PlayerCardSeam }) {
  const action = seam.useCardAction(league.leagueId, card.code);
  if (action?.kind === "drop") return <WaiverAction leagueId={league.leagueId} card={card} seam={seam} />;
  return (
    <>
      <ShortlistAction leagueId={league.leagueId} playerCode={card.code} gone={card.gone} seam={seam} />
      <ScoutAction leagueId={league.leagueId} playerCode={card.code} gone={card.gone} seam={seam} />
      {card.ownerTeamName !== null ? (
        <Placeholder label={tradeNotBuiltLabel} className="px-3 py-1 text-muted">
          {offerTradeWords}
        </Placeholder>
      ) : (
        <WaiverAction leagueId={league.leagueId} card={card} seam={seam} />
      )}
    </>
  );
}
