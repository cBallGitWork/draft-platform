import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FEWEST_TEAMS, MOST_TEAMS } from "../../convex/leagues/leagueLimits";
import { ADMIN_PATH } from "../admin/paths";
import { ADMIN_TITLE } from "../admin/words";
import { Panel, PANEL_BODY, Problem } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import type { LeaguesSeam } from "./seam";
import { BackToLeagues, LEAGUE_DESK, LEAGUE_DESK_MAIN, SIDE_PANEL_LINK } from "./LeagueLinks";
import { LEAGUES_PATH } from "./paths";
import { adminWords, createLeagueHint, LEAGUES_TITLE, leagueNameHint, maxTeamsHint, NEW_LEAGUE_TITLE, newLeagueLabels } from "./words";

const NAME_ID = "league-name";
const NAME_HINT_ID = "league-name-hint";
const MAX_TEAMS_ID = "league-max-teams";
const MAX_TEAMS_HINT_ID = "league-max-teams-hint";
const COMMISSIONER_ID = "league-commissioner";

/** A text field in the form, at the picture's width rather than the panel's. */
const TEXT_FIELD = "text-box max-w-xl";

/** The admin's "Create a league" (spec/13, Creating a league), built to its approved picture
 *  (docs/design/approved/leagues-new): its name, its maximum teams and its commissioner's email in
 *  the main column, and the Admin panel beside it. Once made, it is on the admin's leagues page. */
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
    <div className={LEAGUE_DESK}>
      <Panel title={NEW_LEAGUE_TITLE} pageTitle className={LEAGUE_DESK_MAIN}>
        <Problem problem={problem} />
        <form onSubmit={create} className={PANEL_BODY}>
          <label htmlFor={NAME_ID} className="font-semibold">
            {newLeagueLabels.name}
          </label>
          <input
            id={NAME_ID}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={NAME_HINT_ID}
            className={TEXT_FIELD}
          />
          <p id={NAME_HINT_ID} className="text-muted">
            {leagueNameHint}
          </p>

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
            className={TEXT_FIELD}
          />

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={creating} className="action">
              {newLeagueLabels.create}
            </button>
            <BackToLeagues />
          </div>
          <p>{createLeagueHint}</p>
        </form>
      </Panel>
      <Panel title={adminWords}>
        <div className={PANEL_BODY}>
          <Link to={ADMIN_PATH} className={SIDE_PANEL_LINK}>
            {ADMIN_TITLE}
          </Link>
          <Link to={LEAGUES_PATH} className={SIDE_PANEL_LINK}>
            {LEAGUES_TITLE}
          </Link>
        </div>
      </Panel>
    </div>
  );
}
