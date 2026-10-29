import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FEWEST_TEAMS, MOST_TEAMS } from "../../convex/leagues/leagueLimits";
import { PageSection, PANEL_BODY, Problem } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import type { LeaguesSeam } from "./seam";
import { BackToLeagues } from "./LeagueLinks";
import { LEAGUES_PATH } from "./paths";
import { commissionerHint, maxTeamsHint, NEW_LEAGUE_TITLE, newLeagueLabels } from "./words";

const NAME_ID = "league-name";
const MAX_TEAMS_ID = "league-max-teams";
const MAX_TEAMS_HINT_ID = "league-max-teams-hint";
const COMMISSIONER_ID = "league-commissioner";
const COMMISSIONER_HINT_ID = "league-commissioner-hint";

/** The admin's "Create a league" (spec/13, Creating a league): its name, its maximum teams and its
 *  commissioner's email. Once made, it is on the admin's leagues page. */
export function NewLeaguePage({ createLeague }: { createLeague: LeaguesSeam["createLeague"] }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState("");
  const [commissionerEmail, setCommissionerEmail] = useState("");
  const { busy: creating, problem, run } = useChange();

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await run(() => createLeague({ name, maxTeams: Number(maxTeams), commissionerEmail }))) void navigate({ to: LEAGUES_PATH });
  }

  return (
    <PageSection title={NEW_LEAGUE_TITLE} className="max-w-md bg-panel">
      <Problem problem={problem} />
      <form onSubmit={create} className={PANEL_BODY}>
        <label htmlFor={NAME_ID} className="font-semibold">
          {newLeagueLabels.name}
        </label>
        <input id={NAME_ID} required value={name} onChange={(event) => setName(event.target.value)} className="text-box" />

        <label htmlFor={MAX_TEAMS_ID} className="font-semibold">
          {newLeagueLabels.maxTeams}
        </label>
        <input
          id={MAX_TEAMS_ID}
          type="number"
          required
          min={FEWEST_TEAMS}
          max={MOST_TEAMS}
          step={1}
          value={maxTeams}
          onChange={(event) => setMaxTeams(event.target.value)}
          aria-describedby={MAX_TEAMS_HINT_ID}
          className="text-box w-wide-number-box"
        />
        <p id={MAX_TEAMS_HINT_ID} className="text-muted">
          {maxTeamsHint}
        </p>

        <label htmlFor={COMMISSIONER_ID} className="font-semibold">
          {newLeagueLabels.commissionerEmail}
        </label>
        <input
          id={COMMISSIONER_ID}
          type="email"
          required
          value={commissionerEmail}
          onChange={(event) => setCommissionerEmail(event.target.value)}
          aria-describedby={COMMISSIONER_HINT_ID}
          className="text-box"
        />
        <p id={COMMISSIONER_HINT_ID} className="text-muted">
          {commissionerHint}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={creating} className="action">
            {newLeagueLabels.create}
          </button>
          <BackToLeagues />
        </div>
      </form>
    </PageSection>
  );
}
