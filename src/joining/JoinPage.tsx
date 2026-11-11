import { Link } from "@tanstack/react-router";
import { linkOffWords } from "../../convex/joining/joiningShared";
import { Loading, PageSection, Panel, PANEL_BODY, Problem, Status } from "../ui/Panel";
import { LEAGUES_PATH } from "../leagues/paths";
import { LEAGUES_TITLE, teamsOfMostWords } from "../leagues/words";
import { useChange } from "../shared/useChange";
import type { JoiningSeam, JoinPageData } from "./seam";
import { joinPageWords } from "./words";

/** A league's invite link, opened signed in (spec/13, Joining): the league, who runs it and how
 *  full it is, to ask to join, then see the request waiting for the commissioner, or that you're
 *  in; beside it, how joining goes (approved/join/1440.png). */
export function JoinPage({ token, joining }: { token: string; joining: JoiningSeam }) {
  const page = joining.useJoinPage(token);
  const { busy, problem, run } = useChange();
  const waiting = page?.standing === "waiting" ? joinPageWords.waiting(page.leagueName) : null;

  return (
    <div className="grid items-start gap-2 lg:grid-cols-sign-in">
      <PageSection title={joinPageWords.title} className="bg-panel">
        <Problem problem={problem} />
        {/* Outside the stacked lines below, so while empty it adds no gap; its top padding is that gap. */}
        {page && <Status words={waiting} className="px-3 pt-2" />}
        <div className={PANEL_BODY}>
          {page === undefined && <Loading>{joinPageWords.loading}</Loading>}
          {page === null && <p>{linkOffWords}</p>}
          {page && <League page={page} />}
          {page?.standing === "mayAsk" && (
            <button type="button" disabled={busy} onClick={() => void run(() => joining.askToJoin(token))} className="action self-start">
              {joinPageWords.ask}
            </button>
          )}
          {page?.standing === "inLeague" && <p>{joinPageWords.inLeague(page.leagueName, page.teamName)}</p>}
          {page?.standing !== "mayAsk" && (
            <Link to={LEAGUES_PATH} className="flex min-h-tap items-center self-start">
              {LEAGUES_TITLE}
            </Link>
          )}
        </div>
      </PageSection>
      <Panel title={joinPageWords.joiningTitle}>
        <p className={PANEL_BODY}>{joinPageWords.joining}</p>
      </Panel>
    </div>
  );
}

/** The league's name, its commissioner and how many of its teams it has. */
function League({ page }: { page: NonNullable<JoinPageData> }) {
  return (
    <>
      <h2 className="text-title display-face">{page.leagueName}</h2>
      <dl className="grid grid-cols-facts gap-x-6 gap-y-1">
        <dt className="text-soft">{joinPageWords.commissioner}</dt>
        <dd className="wrap-anywhere">{page.commissionerEmail}</dd>
        <dt className="text-soft">{joinPageWords.teams}</dt>
        <dd>
          <span className="text-figure">{page.teams}</span>
          {teamsOfMostWords}
          <span className="text-figure">{page.maxTeams}</span>
          {joinPageWords.teamsAfter}
        </dd>
      </dl>
    </>
  );
}
