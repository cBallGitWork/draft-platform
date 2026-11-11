import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { SCOUTING_PATH } from "../../frame/menu";
import { Choice } from "../../ui/Choice";
import { ColumnHeads } from "../../ui/ColumnHeads";
import { Panel, PanelNote } from "../../ui/Panel";
import { figureWords, noFigureWords } from "../words";
import { byRun, clashOf, groupOf, movedOnto } from "./claimGroups";
import { Chip, claimCellClass, DropCell, GROUP_ROW, PlayerName } from "./ClaimCells";
import { EveryTeamTable } from "./EveryTeamTable";
import type { PendingClaim, WaiversView } from "./seam";
import {
  claimColumns,
  CLAIMS_TITLE,
  claimsClosedWords,
  claimsCountWords,
  claimsInWords,
  claimsNotOpenWords,
  claimsTableLabel,
  claimsViewLabel,
  claimsViews,
  claimsViewWords,
  dragGlyph,
  dragHandleLabel,
  noClaimsWords,
  PENDING_CLAIMS_TITLE,
  playersOnWaiversWords,
  runGroupWords,
  selectClaimLabel,
  teamsWithoutClaimsWords,
  type ClaimsView,
} from "./words";

// The Transactions tab's pending claims (#1200; the waivers picture, 1440.png): the manager's own,
// grouped by run and ranked within each, a row's handle dragging it within its run; a click on a
// row selects it, its panel opening on the right (ClaimPanel.tsx). The commissioner switches to
// every team's (EveryTeamTable.tsx). While claims are closed, the panel says so in a word; in the
// lock the handles stay, since a claim in can still be ranked or withdrawn, only new ones shut
// (Craig, 11 Nov 2026, on #1590), and before the draft is over they go (the README's Not drawn).

const MINE_COLUMNS = ["handle", "rank", "positions", "claim", "points", "drop"] as const;

/** The word why claims can't be changed now, or null while they can. */
export function closedWords(waivers: WaiversView | undefined): string | null {
  if (!waivers) return null;
  if (!waivers.drafted) return claimsNotOpenWords;
  return waivers.locked ? claimsClosedWords : null;
}

/** Whether a claim in can be ranked again or withdrawn: in the lock too, only new claims and a
 *  change of drop being shut (Craig, 11 Nov 2026, on #1590). */
export function canRank(waivers: WaiversView | undefined): boolean {
  return waivers?.drafted !== false;
}

export function ClaimsPanel({
  claims,
  waivers,
  runsLeague,
  selected,
  onSelect,
  onReorder,
  busy,
}: {
  /** The claims the caller sees: his own, or every team's for whoever runs the league. */
  claims: readonly PendingClaim[];
  waivers: WaiversView | undefined;
  runsLeague: boolean;
  selected: Id<"waiverClaims"> | null;
  onSelect(claimId: Id<"waiverClaims">): void;
  onReorder(claimIds: Id<"waiverClaims">[]): void;
  /** A change is saving: a drag waits for it, as the Move buttons do, since an order built from
   *  the claims drawn before the first save landed would undo it (#1490). */
  busy: boolean;
}) {
  const [view, setView] = useState<ClaimsView>("mine");
  const mine = claims.filter(({ yours }) => yours);
  const closed = closedWords(waivers);
  const everyTeam = runsLeague && view === "everyTeam";
  const withoutClaims = (waivers?.teams.length ?? 0) - new Set(claims.map(({ teamId }) => teamId)).size;
  const aside = everyTeam ? (
    waivers && <span className="text-soft">{teamsWithoutClaimsWords(withoutClaims)}</span>
  ) : mine.length > 0 ? (
    <span className="text-soft">{claimsCountWords(mine.length)}</span>
  ) : undefined;
  return (
    <Panel title={runsLeague ? CLAIMS_TITLE : PENDING_CLAIMS_TITLE} aside={aside ?? undefined}>
      {runsLeague && (
        <div className="px-3 py-2">
          <Choice label={claimsViewLabel} labelShown={false} name="claims-view" options={claimsViews} words={claimsViewWords} chosen={view} onChoose={setView} />
        </div>
      )}
      {closed !== null && <PanelNote>{closed}</PanelNote>}
      {everyTeam ? (
        <EveryTeamTable claims={claims} waivers={waivers} />
      ) : mine.length === 0 ? (
        <PanelNote>{noClaimsWords}</PanelNote>
      ) : (
        <MineTable claims={mine} rankable={canRank(waivers)} busy={busy} selected={selected} onSelect={onSelect} onReorder={onReorder} />
      )}
      <p className="px-3 py-2">
        <Link to={SCOUTING_PATH} className="inline-flex min-h-tap items-center lg:min-h-0">
          {playersOnWaiversWords}
        </Link>
      </p>
    </Panel>
  );
}

function MineTable({
  claims,
  rankable,
  busy,
  selected,
  onSelect,
  onReorder,
}: {
  claims: readonly PendingClaim[];
  rankable: boolean;
  busy: boolean;
  selected: Id<"waiverClaims"> | null;
  onSelect(claimId: Id<"waiverClaims">): void;
  onReorder(claimIds: Id<"waiverClaims">[]): void;
}) {
  const [dragging, setDragging] = useState<Id<"waiverClaims"> | null>(null);
  const shown = rankable ? MINE_COLUMNS : MINE_COLUMNS.filter((column) => column !== "handle");
  function dropOnto(targetId: Id<"waiverClaims">) {
    const ids = dragging === null || busy ? null : movedOnto(claims, dragging, targetId);
    setDragging(null);
    if (ids !== null) onReorder(ids);
  }
  return (
    <table aria-label={claimsTableLabel} className="w-full border-collapse">
      <ColumnHeads columns={claimColumns} shown={shown} classOf={claimCellClass} />
      {byRun(claims).map((group) => (
        <tbody key={groupOf(group)}>
          <tr className={GROUP_ROW}>
            <th scope="rowgroup" colSpan={shown.length} className="px-3 py-1 text-left">
              <span className="font-semibold text-lead">{runGroupWords(group.run)}</span> <span className="text-soft">{claimsInWords(group.claims.length)}</span>
            </th>
          </tr>
          {group.claims.map((claim, index) => (
            <tr
              key={claim.claimId}
              aria-current={selected === claim.claimId || undefined}
              onClick={() => onSelect(claim.claimId)}
              onDragOver={rankable ? (event) => event.preventDefault() : undefined}
              onDrop={rankable ? () => dropOnto(claim.claimId) : undefined}
              className="cursor-pointer border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge"
            >
              {rankable && (
                <td className={claimCellClass("handle")}>
                  <span
                    draggable={!busy}
                    role="img"
                    aria-label={dragHandleLabel(claim.claim.playerName)}
                    onDragStart={() => setDragging(busy ? null : claim.claimId)}
                    onDragEnd={() => setDragging(null)}
                    className={busy ? "text-muted" : "cursor-grab text-muted"}
                  >
                    {dragGlyph}
                  </span>
                </td>
              )}
              <td className={claimCellClass("rank")}>{index + 1}</td>
              <td className={claimCellClass("positions")}>
                <Chip player={claim.claim} />
              </td>
              <th scope="row" className={claimCellClass("claim")}>
                <button
                  type="button"
                  aria-expanded={selected === claim.claimId}
                  aria-label={selectClaimLabel(claim.claim.playerName)}
                  className="flex min-h-tap items-center lg:min-h-0"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(claim.claimId);
                  }}
                >
                  <PlayerName player={claim.claim} />
                </button>
              </th>
              <td className={`${claimCellClass("points")} text-figure`}>{claim.claim.seasonPoints === null ? noFigureWords : figureWords(claim.claim.seasonPoints)}</td>
              <td className={claimCellClass("drop")}>
                <DropCell drop={claim.drop} clash={clashOf(group, index)} />
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
