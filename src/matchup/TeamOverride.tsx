import { useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchupSide } from "../../convex/matchup/matchupShape";
import { OVERRIDE_REASON_MAX, TEAM_OVERRIDE_POINTS_MOST } from "../../convex/table/overrideLimits";
import { PANEL_BODY, Problem, Status } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import type { MatchupSeam } from "./seam";
import {
  cancelOverrideWords,
  OVERRIDE_TOTAL_TITLE,
  overriddenDoneWords,
  overrideHint,
  overrideTotalLabel,
  overrideTotalLabels,
  overrideWords,
  removeOverrideWords,
  removeTotalOverrideLabel,
  totalOverrideRemovedWords,
} from "./words";

const POINTS_ID = "team-override-points";
const REASON_ID = "team-override-reason";
/** The hint, what an override does, describes the points box. */
const HINT_ID = "team-override-hint";
/** Points are kept to a tenth (spec/14). */
const POINTS_STEP = 0.1;

type TeamSide = Extract<MatchupSide, { kind: "team" }>;

/** The team override (spec/14 S14.3 to S14.6; #903), for whoever runs the league: under each team's
 *  name, "Override total" opens a form for its total in the gameweek and why; once its total is
 *  overridden, "Remove override" puts the scored total back. The league's average has none. Each
 *  change sends the league a letter (convex/table/teamOverrides.ts). */
export function TeamOverrides({ leagueId, gameweek, sides, seam }: { leagueId: Id<"leagues">; gameweek: number; sides: readonly MatchupSide[]; seam: MatchupSeam }) {
  const override = seam.useOverrideTeam();
  const removeOverride = seam.useRemoveTeamOverride();
  const change = useChange();
  const [open, setOpen] = useState<TeamSide | null>(null);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const unfilled = points === "" || reason.trim() === "";

  /** Shuts the form, forgetting what was typed and said. */
  function shut() {
    setOpen(null);
    setPoints("");
    setReason("");
    change.clear();
  }

  function opening(side: TeamSide) {
    shut();
    setDone(null);
    setOpen(side);
  }

  async function save(event: FormEvent<HTMLFormElement>, side: TeamSide) {
    event.preventDefault();
    setDone(null);
    if (!(await change.run(() => override(leagueId, { gameweek, teamId: side.teamId, points: Number(points), reason })))) return;
    shut();
    setDone(overriddenDoneWords);
  }

  async function remove(side: TeamSide) {
    shut();
    setDone(null);
    if (await change.run(() => removeOverride(leagueId, { gameweek, teamId: side.teamId }))) setDone(totalOverrideRemovedWords);
  }

  const control = (side: MatchupSide, className: string) => (
    <div className={className}>
      {side.kind === "team" &&
        (side.overridden ? (
          <button type="button" onClick={() => remove(side)} disabled={change.busy} aria-label={removeTotalOverrideLabel(side.teamName)} className="secondary-action">
            {removeOverrideWords}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => opening(side)}
            aria-expanded={open?.teamId === side.teamId}
            aria-label={overrideTotalLabel(side.teamName)}
            className="secondary-action"
          >
            {OVERRIDE_TOTAL_TITLE}
          </button>
        ))}
    </div>
  );

  const [team, opponent] = sides;
  return (
    <div className="pb-2">
      <div className="grid grid-cols-sides gap-3 px-3">
        {control(team, "text-right")}
        <span />
        {control(opponent, "")}
      </div>
      <Problem problem={change.problem} />
      <Status words={done} className="px-3 pt-2 text-center text-derived" />
      {open !== null && (
        <form onSubmit={(event) => save(event, open)} aria-label={overrideTotalLabel(open.teamName)} className={PANEL_BODY}>
          <p id={HINT_ID} className="text-muted">
            {overrideHint}
          </p>
          <label htmlFor={POINTS_ID} className="font-semibold">
            {overrideTotalLabels.points}
          </label>
          <input
            id={POINTS_ID}
            type="number"
            required
            step={POINTS_STEP}
            min={-TEAM_OVERRIDE_POINTS_MOST}
            max={TEAM_OVERRIDE_POINTS_MOST}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            aria-describedby={HINT_ID}
            className="text-box"
          />
          <label htmlFor={REASON_ID} className="font-semibold">
            {overrideTotalLabels.reason}
          </label>
          <input id={REASON_ID} required maxLength={OVERRIDE_REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} className="text-box" />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={unfilled || change.busy} className={unfilled ? "action-idle" : "action"}>
              {overrideWords}
            </button>
            <button type="button" onClick={shut} className="secondary-action">
              {cancelOverrideWords}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
