import { TickBox } from "../ui/TickBox";
import type { ScreenTeam, TradePick } from "./seam";
import {
  heldWords,
  pickRoundWords,
  pickTickLabel,
  PICKS_TITLE,
  picksTableLabel,
  viaWords,
} from "./words";

/** A squad's Picks block on the New offer tab (#1096; the approved trades README, Picks): the draft
 *  picks the team holds before the draft, a tick on each, at most one ticked. One traded to it
 *  shows "via" the team it came from; one held in a trade under review is greyed and can't be
 *  ticked. Nothing once the draft has started. */
export function PicksTable({
  team,
  ticked,
  tick,
}: {
  team: ScreenTeam;
  ticked: TradePick | null;
  tick: (pick: TradePick | null) => void;
}) {
  if (team.picks.length === 0) return null;
  return (
    <table
      aria-label={picksTableLabel(team.teamName)}
      className="w-full border-collapse"
    >
      <thead>
        <tr className="h-row border-t border-panel-rule">
          <th colSpan={2} scope="colgroup" className="px-2 text-left text-soft">
            {PICKS_TITLE}
          </th>
        </tr>
      </thead>
      <tbody>
        {team.picks.map((pick) => {
          const on =
            ticked?.round === pick.round && ticked.teamId === pick.teamId;
          return (
            <tr
              key={`${pick.round}-${pick.teamId}`}
              className={`h-row border-t border-panel-rule${on ? " bg-name-plate shadow-current-edge" : ""}`}
            >
              <td className="w-tap px-2">
                <TickBox
                  checked={on}
                  disabled={pick.held}
                  labelHidden
                  inTableRow
                  onChange={(checked) =>
                    tick(
                      checked
                        ? { round: pick.round, teamId: pick.teamId }
                        : null,
                    )
                  }
                >
                  {pickTickLabel(pick.round, pick.teamName)}
                </TickBox>
              </td>
              <th scope="row" className="px-2 text-left">
                <span
                  className={`inline-flex items-center gap-2${pick.held ? " text-muted" : ""}`}
                >
                  <span className="font-semibold">
                    {pickRoundWords(pick.round)}
                  </span>
                  {pick.teamId !== team.teamId && (
                    <span className="text-soft">{viaWords(pick.teamName)}</span>
                  )}
                  {pick.held && (
                    <span className="bg-head px-1 text-ground">
                      {heldWords}
                    </span>
                  )}
                </span>
              </th>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
