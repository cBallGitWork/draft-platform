import { useState, type FormEvent, type ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchupSide } from "../../convex/matchup/matchupShape";
import { TEAM_OVERRIDE_POINTS_MOST } from "../../convex/table/overrideLimits";
import { OverrideFields } from "../ui/OverrideFields";
import { PANEL_BODY, Problem, Status } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import type { MatchupSeam } from "./seam";
import type { TeamSide } from "./SidePitch";
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

/** The form's boxes are `team-override-points` and `team-override-reason`. */
const ID_PREFIX = "team-override";
/** The hint, what an override does, describes the points box. */
const HINT_ID = `${ID_PREFIX}-hint`;

/** The team override (spec/14 S14.3 to S14.6; #903), for whoever runs the league: under each team's
 *  name, "Override total" opens a form for its total in the gameweek and why; once its total is
 *  overridden, "Remove override" puts the scored total back. The league's average has none. Each
 *  change sends the league a letter (convex/table/teamOverrides.ts). `layout` places each side's
 *  control, under its name in the matchup's head; the form opens under it. */
export function TeamOverrides({
  leagueId,
  gameweek,
  seam,
  layout,
}: {
  leagueId: Id<"leagues">;
  gameweek: number;
  seam: MatchupSeam;
  layout: (controlOf: (side: MatchupSide) => ReactNode) => ReactNode;
}) {
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

  const control = (side: MatchupSide) => (
    <div>
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

  return (
    <div>
      {layout(control)}
      <Problem problem={change.problem} />
      <Status words={done} className="px-3 pt-2 text-center text-derived" />
      {open !== null && (
        <form onSubmit={(event) => save(event, open)} aria-label={overrideTotalLabel(open.teamName)} className={PANEL_BODY}>
          <p id={HINT_ID} className="text-muted">
            {overrideHint}
          </p>
          <OverrideFields
            idPrefix={ID_PREFIX}
            labels={overrideTotalLabels}
            most={TEAM_OVERRIDE_POINTS_MOST}
            points={points}
            onPoints={setPoints}
            reason={reason}
            onReason={setReason}
            describedBy={HINT_ID}
          />
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
