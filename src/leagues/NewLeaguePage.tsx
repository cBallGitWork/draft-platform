import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FEWEST_TEAMS, MOST_TEAMS } from "../../convex/leagueLimits";
import type { LeagueActions } from "./actions";
import { LEAGUES_PATH, NEW_LEAGUE_TITLE } from "./paths";
import { commissionerHint, maxTeamsHint } from "./words";

/** The admin's "Create a league" (spec/13, Creating a league): its name, its maximum teams and its
 *  commissioner's email. Once made, it is on the admin's leagues page. */
export function NewLeaguePage({ createLeague }: { createLeague: LeagueActions["createLeague"] }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState("");
  const [commissionerEmail, setCommissionerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const refused = await createLeague({ name, maxTeams: Number(maxTeams), commissionerEmail });
    setCreating(false);
    setProblem(refused);
    if (refused === null) void navigate({ to: LEAGUES_PATH });
  }

  return (
    <section aria-labelledby="page-title" className="max-w-md bg-panel">
      <h1 id="page-title" className="bg-plate px-4 py-1 text-title font-bold shadow-bevel-plate">
        {NEW_LEAGUE_TITLE}
      </h1>
      {problem && (
        <p role="alert" className="alert-strip">
          {problem}
        </p>
      )}
      <form onSubmit={create} className="flex flex-col gap-2 p-3">
        <label htmlFor="league-name" className="font-semibold">
          League name
        </label>
        <input id="league-name" required value={name} onChange={(event) => setName(event.target.value)} className="text-box" />

        <label htmlFor="league-max-teams" className="font-semibold">
          Maximum teams
        </label>
        <input
          id="league-max-teams"
          type="number"
          required
          min={FEWEST_TEAMS}
          max={MOST_TEAMS}
          step={1}
          value={maxTeams}
          onChange={(event) => setMaxTeams(event.target.value)}
          aria-describedby="league-max-teams-hint"
          className="text-box w-24"
        />
        <p id="league-max-teams-hint" className="text-muted">
          {maxTeamsHint}
        </p>

        <label htmlFor="league-commissioner" className="font-semibold">
          Commissioner's email
        </label>
        <input
          id="league-commissioner"
          type="email"
          required
          value={commissionerEmail}
          onChange={(event) => setCommissionerEmail(event.target.value)}
          aria-describedby="league-commissioner-hint"
          className="text-box"
        />
        <p id="league-commissioner-hint" className="text-muted">
          {commissionerHint}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={creating} className="action">
            Create the league
          </button>
          <Link to={LEAGUES_PATH} className="flex min-h-tap items-center">
            Back to your leagues
          </Link>
        </div>
      </form>
    </section>
  );
}
