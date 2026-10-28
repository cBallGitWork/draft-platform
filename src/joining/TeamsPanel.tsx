import { useState } from "react";
import { Confirm } from "../frame/Confirm";
import { Panel, Problem } from "../frame/Panel";
import { useChange } from "../useChange";
import type { InvitesPageData, JoiningSeam } from "./seam";
import { teamsWords } from "./words";

type Team = InvitesPageData["teams"][number];

/** spec/13, Leaving: the league's teams and who runs each, and removing a team's manager, after a
 *  plain confirm. The team stays, keeps its name, and can be handed on. */
export function TeamsPanel({ page, joining }: { page: InvitesPageData; joining: JoiningSeam }) {
  return (
    <Panel title={teamsWords.title}>
      <ul aria-label={teamsWords.title}>
        {page.teams.map((team) => (
          <TeamRow key={team.teamId} team={team} page={page} joining={joining} />
        ))}
      </ul>
    </Panel>
  );
}

function TeamRow({ team, page, joining }: { team: Team; page: InvitesPageData; joining: JoiningSeam }) {
  const [confirming, setConfirming] = useState(false);
  const { busy, problem, run } = useChange();
  const { managerEmail } = team;

  async function remove() {
    if (await run(() => joining.removeManager(page.leagueId, team.teamId))) setConfirming(false);
  }

  return (
    <li className="flex flex-col gap-2 border-b border-panel-rule px-3 py-2">
      <span>
        <span className="block text-lead font-semibold">{team.name}</span>
        <span className="text-muted wrap-anywhere">{managerEmail ?? teamsWords.noManager}</span>
      </span>
      <Problem problem={problem} />
      {managerEmail !== null &&
        (confirming ? (
          <Confirm
            question={teamsWords.confirm(managerEmail, team.name)}
            yes={teamsWords.yes}
            no={teamsWords.no}
            busy={busy}
            onYes={() => void remove()}
            onNo={() => setConfirming(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="secondary-action self-start"
            aria-label={teamsWords.removeLabel(managerEmail, team.name)}
          >
            {teamsWords.remove}
          </button>
        ))}
    </li>
  );
}
