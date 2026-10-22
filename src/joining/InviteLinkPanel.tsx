import { joinPath, noLinkWords } from "../../convex/joining/joiningShared";
import { PanelTitle, Problem } from "../frame/Panel";
import { useChange } from "../useChange";
import type { InvitesPageData, JoiningSeam } from "./seam";
import { inviteLinkWords, linkHint } from "./words";

/** spec/13, Joining: the league's one invite link, to share; switching it off or replacing it
 *  stops the old one working. */
export function InviteLinkPanel({ page, joining }: { page: InvitesPageData; joining: JoiningSeam }) {
  const { busy, problem, run } = useChange();
  const makeLink = () => void run(() => joining.makeLink(page.leagueId));

  return (
    <section aria-labelledby="invite-link-title" className="bg-panel">
      <PanelTitle id="invite-link-title">{inviteLinkWords.title}</PanelTitle>
      <Problem problem={problem} />
      <div className="flex flex-col gap-2 p-3">
        {page.linkToken === null ? (
          <>
            <p>{noLinkWords}</p>
            <button type="button" disabled={busy} onClick={makeLink} className="action self-start">
              {inviteLinkWords.make}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="invite-link" className="font-semibold">
              {inviteLinkWords.label}
            </label>
            <input
              id="invite-link"
              readOnly
              value={new URL(joinPath(page.linkToken), window.location.origin).href}
              onFocus={(event) => event.target.select()}
              className="text-box"
            />
            <p className="text-muted">{linkHint}</p>
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
    </section>
  );
}
