import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueGameweek } from "../../convex/gameweeks/leagueGameweeks";
import { isLocked } from "../../convex/gameweeks/deadline";
import { snakeOrder } from "../../convex/draft/snakeOrder";
import { DRAFT_PATH, TRADES_PATH } from "../frame/menu";
import { offerLink } from "../trades/paths";
import { gameweeksPath } from "../gameweeks/paths";
import { gameweekShort, whenWords } from "../shared/when/words";
import { noFigureWords, notSetWords } from "../shared/words";
import { useNowEachMinute } from "../shared/useMinute";
import { Loading, Panel } from "../ui/Panel";
import type { LeagueSettingsSeam } from "./seam";
import {
  draftBegunWords,
  draftOrderLinkWords,
  draftPicksLabel,
  draftRoomWords,
  draftRoundsLabel,
  draftStartLabel,
  draftStartLoadingWords,
  draftTeamsLabel,
  draftWidgetTitle,
  editGameweeksWords,
  gameweeksLoadingWords,
  gameweeksWidgetTitle,
  inReviewLoadingWords,
  inReviewWidgetTitle,
  noneInReviewWords,
  noScoresWords,
  notUsedWords,
  presetsWidgetTitle,
  reversedWords,
  reviewEndsAtWords,
  roundTwoWidgetTitle,
  scoringStartsWords,
  teamOrderLoadingWords,
  tradeInReviewWords,
  tradesLinkWords,
} from "./words";

// League settings' right-hand widgets (docs/design/approved/settings/, README "Interaction notes"):
// read-only, each showing what its tab's rules lead to.

const ROW = "flex items-baseline gap-3 border-t border-panel-rule px-3 py-1 first:border-t-0";
/** As many gameweeks as the approved picture shows. */
export const GAMEWEEKS_SHOWN = 7;

/** The league's next gameweeks from the first not begun (the season's last ones once every one
 *  has), the scoring start marked in cyan, a ticked gameweek before it scoring nothing and an
 *  unticked one muted; Edit › opens the Gameweeks screen. */
export function GameweeksWidget({ leagueId, seam }: { leagueId: Id<"leagues">; seam: LeagueSettingsSeam }) {
  const gameweeks = seam.useGameweeks(leagueId);
  const scoring = seam.useScoringStart(leagueId);
  const now = useNowEachMinute();
  const aside = (
    <Link to={gameweeksPath(leagueId)} className="inline-flex min-h-tap min-w-tap items-center justify-end lg:min-h-0 lg:min-w-0">
      {editGameweeksWords}
    </Link>
  );
  return (
    <Panel title={gameweeksWidgetTitle} aside={aside}>
      {gameweeks === undefined || scoring === undefined ? (
        <Loading className="px-3 py-2">{gameweeksLoadingWords}</Loading>
      ) : (
        <ul>
          {shownOf(gameweeks, now).map((each) => (
            <GameweekRow key={each.gameweek} gameweek={each} start={scoring.start} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function GameweekRow({ gameweek: { gameweek, used, deadline }, start }: { gameweek: LeagueGameweek; start: number | null }) {
  const starts = used && gameweek === start;
  const note = !used ? notUsedWords : starts ? scoringStartsWords : start !== null && gameweek < start ? noScoresWords : null;
  const marks = !used ? "text-muted" : starts ? "bg-row-lit shadow-current-edge" : "";
  return (
    <li className={`${ROW} ${marks}`}>
      <span className="font-bold">{gameweekShort(gameweek)}</span>
      <span className="grow">{deadline === null ? noFigureWords : whenWords(deadline)}</span>
      {note !== null && <span className={starts ? "text-derived" : undefined}>{note}</span>}
    </li>
  );
}

/** GAMEWEEKS_SHOWN gameweeks from the first whose deadline hasn't passed. */
function shownOf(gameweeks: readonly LeagueGameweek[], now: number): readonly LeagueGameweek[] {
  const next = gameweeks.findIndex(({ deadline }) => !isLocked(deadline, now));
  const from = next === -1 ? gameweeks.length - GAMEWEEKS_SHOWN : next;
  return gameweeks.slice(Math.max(0, from), Math.max(0, from) + GAMEWEEKS_SHOWN);
}

/** The draft's start, rounds, picks and teams, with ways to the draft room, for the league the app
 *  is in (the draft room is that league's: `inCurrentLeague`), and to the Draft order tab. */
export function DraftWidget({
  leagueId,
  seam,
  inCurrentLeague,
  openDraftOrder,
}: {
  leagueId: Id<"leagues">;
  seam: LeagueSettingsSeam;
  inCurrentLeague: boolean;
  openDraftOrder: () => void;
}) {
  const draft = seam.useDraftStart(leagueId);
  if (draft === undefined) return <Loading>{draftStartLoadingWords}</Loading>;
  const starts = draft.started ? draftBegunWords : draft.startsAt === null ? notSetWords : whenWords(draft.startsAt);
  const facts = [
    [draftStartLabel, starts],
    [draftRoundsLabel, draft.rounds ?? noFigureWords],
    [draftPicksLabel, draft.rounds === null ? noFigureWords : draft.rounds * draft.teams],
    [draftTeamsLabel, draft.teams],
  ] as const;
  return (
    <Panel title={draftWidgetTitle}>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label} className={ROW}>
            <dt className="grow font-bold">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={ROW}>
        {inCurrentLeague && (
          <Link to={DRAFT_PATH} className="inline-flex min-h-tap items-center lg:min-h-0">
            {draftRoomWords}
          </Link>
        )}
        <button type="button" onClick={openDraftOrder} className="ml-auto inline-flex min-h-tap items-center lg:min-h-0">
          {draftOrderLinkWords}
        </button>
      </p>
    </Panel>
  );
}

/** Every trade in review in the league, the soonest to end first, each with its end (S08.30). A
 *  trade Offers shows the commissioner, as its reviewer or one of its teams, opens there, as does
 *  Trades ›, for the league the app is in (`inCurrentLeague`), whose Trades it is. */
export function InReviewWidget({ leagueId, seam, inCurrentLeague }: { leagueId: Id<"leagues">; seam: LeagueSettingsSeam; inCurrentLeague: boolean }) {
  const trades = seam.useTradesInReview(leagueId);
  if (trades === undefined) return <Loading>{inReviewLoadingWords}</Loading>;
  return (
    <Panel title={inReviewWidgetTitle}>
      <ul>
        {trades.length === 0 && <li className={`${ROW} text-muted`}>{noneInReviewWords}</li>}
        {trades.map(({ offerId, fromTeamName, toTeamName, reviewEndsAt, opens }) => {
          const between = tradeInReviewWords(fromTeamName, toTeamName);
          return (
            <li key={offerId} className={ROW}>
              <span className="grow font-bold">
                {opens && inCurrentLeague ? (
                  <Link {...offerLink(offerId)} className="inline-flex min-h-tap items-center lg:min-h-0">
                    {between}
                  </Link>
                ) : (
                  between
                )}
              </span>
              <span>{reviewEndsAtWords(whenWords(reviewEndsAt))}</span>
            </li>
          );
        })}
      </ul>
      {inCurrentLeague && (
        <p className={ROW}>
          <Link to={TRADES_PATH} className="inline-flex min-h-tap items-center lg:min-h-0">
            {tradesLinkWords}
          </Link>
        </p>
      )}
    </Panel>
  );
}

/** The draft order's second round: the snake runs it backwards (S04.18). */
export function RoundTwoWidget({ leagueId, seam }: { leagueId: Id<"leagues">; seam: LeagueSettingsSeam }) {
  const order = seam.useTeamOrder(leagueId);
  if (order === undefined) return <Loading>{teamOrderLoadingWords}</Loading>;
  return (
    <Panel title={roundTwoWidgetTitle} aside={<span className="text-soft">{reversedWords}</span>}>
      <ol>
        {snakeOrder(order.teams, 2)
          .slice(order.teams.length)
          .map(({ teamId, name }, place) => (
            <li key={teamId} className={ROW}>
              <span className="w-4 tabular-nums">{place + 1}</span>
              <span className="font-bold">{name}</span>
            </li>
          ))}
      </ol>
    </Panel>
  );
}

/** The league's formation presets by name, read-only (S03.10). */
export function PresetsWidget({ presetNames }: { presetNames: readonly string[] }) {
  return (
    <Panel title={presetsWidgetTitle} aside={<span className="text-soft tabular-nums">{presetNames.length}</span>}>
      <ul className="grid grid-cols-4 gap-x-3 px-3 py-1">
        {presetNames.map((name) => (
          <li key={name} className="py-1 text-derived">
            {name}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
