import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { cardOpensAt } from "../../convex/playerCard/cardPoints";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { ShortlistAction } from "../playerCard/ShortlistAction";
import { MY_TEAM_TRANSACTIONS_PATH } from "../frame/menu";
import { byRun } from "../myTeam/claims/claimGroups";
import { useMinute } from "../shared/useMinute";
import { Per90Figures } from "./Per90Figures";
import { WaiverAction } from "../playerCard/WaiverAction";
import { playerCardPath } from "../playerCard/paths";
import { ClubMark, ClubShort } from "../ui/ClubName";
import { OwnerName } from "../ui/OwnerName";
import { Panel } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import { ShortlistStar } from "../ui/StarRating";
import type { ListedPlayer, ScoutingSeam } from "./seam";
import {
  closePanelLabel,
  compareWithAnotherWords,
  compareWithYourWords,
  figureWords,
  noFigureWords,
  noPointsYetWords,
  noRoleFitYetWords,
  notLastSeasonWords,
  onWaiversWords,
  panelMinutesWords,
  panelSeasonPointsWords,
  pickSecondWords,
  playerCardLinkWords,
  columns,
  shortlistedLabel,
  yourClaimWords,
} from "./words";

/** Where the manager's own pending claim on him stands, ranked within its run as My team's
 *  Transactions tab ranks it (claimGroups.ts), linking there; nothing with none. */
function YourClaim({ leagueId, playerCode, seam }: { leagueId: Id<"leagues">; playerCode: number; seam: ScoutingSeam }) {
  const yours = (seam.usePendingClaims(leagueId) ?? []).filter((claim) => claim.yours);
  const group = byRun(yours).find(({ claims }) => claims.some(({ claim }) => claim.playerCode === playerCode));
  if (group === undefined) return null;
  const rank = group.claims.findIndex(({ claim }) => claim.playerCode === playerCode) + 1;
  return (
    <Link to={MY_TEAM_TRANSACTIONS_PATH} className="inline-flex min-h-tap items-center text-event lg:min-h-0">
      {yourClaimWords(rank, group.runAt)}
    </Link>
  );
}

/** Compare with your [position], [player]: the manager's own player at his main position (Craig,
 *  9 Nov 2026, on #1028, answer 1); nothing with none, nor while it loads. */
function CompareWithYours({
  leagueId,
  playerCode,
  seam,
  compareWith,
}: {
  leagueId: Id<"leagues">;
  playerCode: number;
  seam: ScoutingSeam;
  compareWith: (playerCode: number) => void;
}) {
  const yours = seam.useYourPlayer(leagueId, playerCode, useMinute())?.player;
  if (yours === undefined || yours === null) return null;
  return (
    <button type="button" onClick={() => compareWith(yours.code)} className="secondary-action">
      {compareWithYourWords(yours.position, yours.name)}
    </button>
  );
}

const FACT_ROW ="flex items-center justify-between border-t border-panel-rule px-3 py-1";

/** The selected player's panel at the top of the right column (the approved picture; FM's player
 *  search): who he is and who holds him, his season points and minutes, role fit's placeholder, the
 *  player card's pickup or claim and shortlist actions, Compare with another… (then a second row
 *  of the list), and his card. `pointsSeason` names last season's points, as the list does. */
export function SelectedPlayer({
  leagueId,
  player,
  pointsSeason,
  stat,
  shortlisted,
  comparing,
  seam,
  compare,
  compareWith,
  close,
}: {
  leagueId: Id<"leagues">;
  player: ListedPlayer;
  pointsSeason: number | null;
  /** The list's stat, which joins his figures per 90. */
  stat: CatalogueStat | null;
  shortlisted: boolean;
  /** Whether Compare with another… is waiting for a second row. */
  comparing: boolean;
  seam: ScoutingSeam;
  compare: () => void;
  /** Compares him with the manager's own player with this code. */
  compareWith: (playerCode: number) => void;
  close: () => void;
}) {
  const main = cardOpensAt(player.positions);
  const title = (
    <span className="flex items-center gap-2">
      {main !== null && <PositionChip label={main} />}
      <span title={player.fullName}>{player.name}</span>
      {shortlisted && <ShortlistStar label={shortlistedLabel} />}
      <span className="font-normal text-soft">
        <ClubMark code={player.club.code} />
        <ClubShort club={player.club} />
      </span>
      <span className="font-normal">{player.onWaivers === null ? <OwnerName teamName={player.ownerTeamName} /> : onWaiversWords(player.onWaivers.firstRunAt)}</span>
    </span>
  );
  const closeButton = (
    <button type="button" aria-label={closePanelLabel} onClick={close} className="min-h-tap min-w-tap font-bold lg:min-h-0">
      ✕
    </button>
  );
  return (
    <Panel title={title} aside={closeButton}>
      <dl>
        <div className={FACT_ROW}>
          <dt className="text-soft">{panelSeasonPointsWords}</dt>
          {player.seasonPoints === null ? (
            <dd title={pointsSeason === null ? noPointsYetWords : notLastSeasonWords} className="text-muted">
              {noFigureWords}
            </dd>
          ) : (
            <dd className="font-bold text-figure">{figureWords(player.seasonPoints)}</dd>
          )}
        </div>
        <div className={FACT_ROW}>
          <dt className="text-soft">{panelMinutesWords}</dt>
          <dd className="font-bold text-figure">{figureWords(player.figures.minutes)}</dd>
        </div>
        <div className={FACT_ROW}>
          <dt className="text-soft">{columns.roleFit.long}</dt>
          <dd className="text-muted">{noRoleFitYetWords}</dd>
        </div>
      </dl>
      <Per90Figures leagueId={leagueId} playerCode={player.code} stat={stat} seam={seam} />
      <div className="flex flex-col gap-2 border-t border-panel-rule p-3">
        <YourClaim leagueId={leagueId} playerCode={player.code} seam={seam} />
        <WaiverAction leagueId={leagueId} card={player} seam={seam} />
        <ShortlistAction leagueId={leagueId} playerCode={player.code} gone={false} seam={seam} />
        <div className="flex flex-wrap items-center gap-2">
          <CompareWithYours leagueId={leagueId} playerCode={player.code} seam={seam} compareWith={compareWith} />
          <button type="button" aria-pressed={comparing} onClick={compare} className="secondary-action">
            {compareWithAnotherWords}
          </button>
        </div>
        {comparing && <p className="text-soft">{pickSecondWords(player.name)}</p>}
        <Link to={playerCardPath(leagueId, player.code)} className="inline-flex min-h-tap items-center self-end lg:min-h-0">
          {playerCardLinkWords}
        </Link>
      </div>
    </Panel>
  );
}
