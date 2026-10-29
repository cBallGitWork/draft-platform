import { joinPath, noLinkWords } from "../../convex/joining/joiningShared";
import { PANEL_BODY, Panel, Problem } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import type { InvitesPageData, JoiningSeam } from "./seam";
import { inviteLinkWords, linkHint } from "./words";

const LINK_ID = "invite-link";
const LINK_HINT_ID = "invite-link-hint";

/** spec/13, Joining: the league's one invite link, to share; switching it off or replacing it
 *  stops the old one working. */
export function InviteLinkPanel({ page, joining }: { page: InvitesPageData; joining: JoiningSeam }) {
  const { busy, problem, run } = useChange();
  const makeLink = () => void run(() => joining.makeLink(page.leagueId));

  return (
    <Panel title={inviteLinkWords.title}>
      <Problem problem={problem} />
      <div className={PANEL_BODY}>
        {page.linkToken === null ? (
          <>
            <p>{noLinkWords}</p>
            <button type="button" disabled={busy} onClick={makeLink} className="action self-start">
              {inviteLinkWords.make}
            </button>
          </>
        ) : (
          <>
            <label htmlFor={LINK_ID} className="font-semibold">
              {inviteLinkWords.label}
            </label>
            <input
              id={LINK_ID}
              readOnly
              value={new URL(joinPath(page.linkToken), window.location.origin).href}
              onFocus={(event) => event.target.select()}
              aria-describedby={LINK_HINT_ID}
              className="text-box"
            />
            <p id={LINK_HINT_ID} className="text-muted">
              {linkHint}
            </p>
            <span className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={makeLink} className="secondary-action">
                {inviteLinkWords.replace}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => joining.switchOffLink(page.leagueId))}
                className="secondary-action"
              >
                {inviteLinkWords.switchOff}
              </button>
            </span>
          </>
        )}
      </div>
    </Panel>
  );
}
