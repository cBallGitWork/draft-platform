import { PanelTitle, Problem } from "../frame/Panel";
import { useChange } from "../useChange";
import type { InvitesPageData, JoiningSeam } from "./seam";
import { TeamSelect, useTeamChoice } from "./TeamChoice";
import { noRequestsWords, requestsWords } from "./words";

/** The ids that pair a heading, label or hint with what it describes. */
const TITLE_ID = "requests-title";

type Request = InvitesPageData["requests"][number];

/** spec/15, Joining a league: the requests the invite link made, each approved to a team the
 *  commissioner picks, a vacated one included, or refused. */
export function RequestsPanel({ page, joining }: { page: InvitesPageData; joining: JoiningSeam }) {
  return (
    <section aria-labelledby={TITLE_ID} className="bg-panel">
      <PanelTitle id={TITLE_ID}>{requestsWords.title}</PanelTitle>
      {page.requests.length === 0 ? (
        <p className="px-3 py-2 text-muted">{noRequestsWords}</p>
      ) : (
        <ul aria-label={requestsWords.title}>
          {page.requests.map((request) => (
            <RequestRow key={request.requestId} request={request} page={page} joining={joining} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestRow({ request, page, joining }: { request: Request; page: InvitesPageData; joining: JoiningSeam }) {
  const choice = useTeamChoice(page);
  const { busy, problem, run } = useChange();
  const { teamId } = choice;
  return (
    <li className="flex flex-col gap-2 border-b border-panel-rule px-3 py-2">
      <span>
        <span className="block text-lead font-semibold wrap-anywhere">{request.email}</span>
        <span className="text-muted">{requestsWords.asked(request.askedAt)}</span>
      </span>
      <Problem problem={problem} />
      <TeamSelect id={`team-for-${request.requestId}`} label={requestsWords.teamLabel(request.email)} choice={choice} />
      <span className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || teamId === undefined}
          onClick={() => teamId !== undefined && void run(() => joining.approve(request.requestId, teamId))}
          className="action"
          aria-label={requestsWords.approveLabel(request.email)}
        >
          {requestsWords.approve}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => joining.refuse(request.requestId))}
          className="secondary-action"
          aria-label={requestsWords.refuseLabel(request.email)}
        >
          {requestsWords.refuse}
        </button>
      </span>
    </li>
  );
}
