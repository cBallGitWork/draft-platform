import { Link } from "@tanstack/react-router";
import type { Id } from "../../../convex/_generated/dataModel";
import { Loading, Panel, PanelNote, Problem } from "../../ui/Panel";
import { playerCardPath } from "../../playerCard/paths";
import { useChange } from "../../shared/useChange";
import { OwnerName } from "../../ui/OwnerName";
import { ClubShort } from "../../premierLeague/ClubName";
import type { ShortlistSeam } from "./seam";
import {
  emptyShortlistWords,
  goneWords,
  loadingShortlistWords,
  removeNamedLabel,
  SHORTLIST_TITLE,
  shortlistListLabel,
  takeOffWords,
} from "./words";

/** The manager's own shortlist (spec/19, The shortlist), on Scouting: each player by name, opening
 *  his card, with his club and who owns him, and a button taking him off. A player is added from
 *  his card. Nothing shows for someone in the league who runs no team, who has none. */
export function ShortlistPanel({ leagueId, seam }: { leagueId: Id<"leagues">; seam: ShortlistSeam }) {
  const players = seam.useShortlist(leagueId);
  const changes = seam.useShortlistChanges();
  const change = useChange();
  if (players === null) return null;
  return (
    <Panel title={SHORTLIST_TITLE}>
      <Problem problem={change.problem} />
      {players === undefined ? (
        <Loading className="px-3 py-2">{loadingShortlistWords}</Loading>
      ) : players.length === 0 ? (
        <PanelNote>{emptyShortlistWords}</PanelNote>
      ) : (
        <ul aria-label={shortlistListLabel}>
          {players.map((player) => (
            <li key={player.code} className="flex items-center justify-between gap-2 border-t border-panel-rule px-3 py-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <Link to={playerCardPath(leagueId, player.code)} title={player.fullName} className="tap-link font-semibold">
                  {player.name}
                </Link>
                <ClubShort club={player.club} className="text-muted" />
                {player.gone ? (
                  <span className="text-event">{goneWords}</span>
                ) : (
                  <OwnerName teamName={player.ownerTeamName} />
                )}
              </span>
              <button
                type="button"
                disabled={change.busy}
                onClick={() => void change.run(() => changes.remove(leagueId, player.code))}
                className="secondary-action"
                aria-label={removeNamedLabel(player.name)}
              >
                {takeOffWords}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
