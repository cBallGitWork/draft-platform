import { Loading, Panel, PanelNote } from "../ui/Panel";
import type { PanelProps } from "./panelProps";
import {
  approveAskLabel,
  approveWords,
  commissionerAsksLoadingWords,
  commissionerAsksTitle,
  moreAsksWords,
  noCommissionerAsksWords,
  refuseAskLabel,
  refuseWords,
} from "./words";

// Managers' asks to be commissioner of a league with none (spec/01 S01.3): he approves one, making
// its manager the commissioner at once, or refuses it. The dashboard has no approved picture: this
// copies its other panels.

export function CommissionerAsks({ seam, change }: Omit<PanelProps, "queue">) {
  const waiting = seam.useCommissionerAsks();
  return (
    <Panel title={commissionerAsksTitle}>
      {waiting === undefined ? (
        <Loading className="p-3">{commissionerAsksLoadingWords}</Loading>
      ) : waiting.asks.length === 0 ? (
        <PanelNote edge="b">{noCommissionerAsksWords}</PanelNote>
      ) : (
        <ul aria-label={commissionerAsksTitle} className="border-t border-panel-rule">
          {waiting.asks.map((ask) => (
            <li key={ask.askId} className="flex items-center justify-between gap-2 border-b border-panel-rule px-3 py-1">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{ask.email}</span>
                <span className="truncate text-event">{ask.leagueName}</span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={change.busy}
                  onClick={() => void change.run(() => seam.approveAsk(ask.askId))}
                  className="secondary-action"
                  aria-label={approveAskLabel(ask.email, ask.leagueName)}
                >
                  {approveWords}
                </button>
                <button
                  type="button"
                  disabled={change.busy}
                  onClick={() => void change.run(() => seam.refuseAsk(ask.askId))}
                  className="secondary-action"
                  aria-label={refuseAskLabel(ask.email, ask.leagueName)}
                >
                  {refuseWords}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {waiting?.more && <PanelNote edge="b">{moreAsksWords}</PanelNote>}
    </Panel>
  );
}
