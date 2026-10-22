import { Link } from "@tanstack/react-router";
import { linkOffWords } from "../../convex/joining/joiningShared";
import { Loading, PageSection, Problem } from "../frame/Panel";
import { LEAGUES_PATH } from "../leagues/paths";
import { LEAGUES_TITLE } from "../leagues/words";
import { useChange } from "../useChange";
import type { JoiningSeam } from "./seam";
import { joinPageWords } from "./words";

/** A league's invite link, opened signed in (spec/13, Joining): ask to join, then see the request
 *  waiting for the commissioner, or that you're in. */
export function JoinPage({ token, joining }: { token: string; joining: JoiningSeam }) {
  const page = joining.useJoinPage(token);
  const { busy, problem, run } = useChange();

  return (
    <PageSection title={page?.leagueName ?? joinPageWords.title} className="max-w-md bg-panel">
      <Problem problem={problem} />
      <div className="flex flex-col gap-2 px-3 py-2">
        {page === undefined && <Loading>{joinPageWords.loading}</Loading>}
        {page === null && <p>{linkOffWords}</p>}
        {page?.standing === "mayAsk" && (
          <>
            <p>{joinPageWords.mayAsk(page.leagueName)}</p>
            <button type="button" disabled={busy} onClick={() => void run(() => joining.askToJoin(token))} className="action self-start">
              {joinPageWords.ask}
            </button>
          </>
        )}
        {page?.standing === "waiting" && <p role="status">{joinPageWords.waiting(page.leagueName)}</p>}
        {page?.standing === "inLeague" && <p>{joinPageWords.inLeague(page.leagueName, page.teamName)}</p>}
        {page?.standing !== "mayAsk" && (
          <Link to={LEAGUES_PATH} className="flex min-h-tap items-center self-start">
            {LEAGUES_TITLE}
          </Link>
        )}
      </div>
    </PageSection>
  );
}
