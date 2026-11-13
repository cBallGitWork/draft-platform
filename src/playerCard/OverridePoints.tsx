import { useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { OVERRIDE_POINTS_MOST } from "../../convex/table/overrideLimits";
import { OverrideFields } from "../ui/OverrideFields";
import { PANEL_BODY, Problem, Status } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import type { PlayerCard, PlayerCardSeam } from "./seam";
import {
  cancelOverrideWords,
  OVERRIDE_TITLE,
  overriddenDoneWords,
  overrideHint,
  overrideLabels,
  overrideMatchWords,
  overrideRemovedWords,
  overrideWords,
  removeOverrideWords,
} from "./words";

/** The form's boxes are `override-match`, `override-points` and `override-reason`. */
const ID_PREFIX = "override";
const MATCH_ID = `${ID_PREFIX}-match`;
/** The hint, what an override does, describes the points box. */
const HINT_ID = `${ID_PREFIX}-hint`;

/** The card's override (spec/14, Changes and corrections; #32), for whoever runs the league: one of
 *  his matches this season, his points there and why. Shut until asked for, and again on Cancel;
 *  nothing while he has played no match. A match already overridden offers "Remove override",
 *  which puts his scored points back (#903, spec/14 S14.5). It opens on the `selected` match, the
 *  one whose breakdown it sits in (#1535). */
export function OverridePoints({ leagueId, card, selected, seam }: { leagueId: Id<"leagues">; card: PlayerCard; selected: number; seam: PlayerCardSeam }) {
  const override = seam.useOverride();
  const removeOverride = seam.useRemoveOverride();
  const change = useChange();
  const [open, setOpen] = useState(false);
  const [fixtureCode, setFixtureCode] = useChoiceAmong(
    card.matches.map((match) => match.fixtureCode),
    selected,
  );
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  if (fixtureCode === undefined) return null;
  const picked = fixtureCode;
  const unfilled = points === "" || reason.trim() === "";
  const overridden = (card.matches.find((match) => match.fixtureCode === picked)?.override ?? null) !== null;

  /** Shuts the form, forgetting what was typed and said. */
  function shut() {
    setOpen(false);
    setPoints("");
    setReason("");
    setDone(null);
    change.clear();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(null);
    const made = await change.run(() => override(leagueId, { fixtureCode: picked, playerCode: card.code, points: Number(points), reason }));
    if (!made) return;
    setDone(overriddenDoneWords);
    setPoints("");
    setReason("");
  }

  async function remove() {
    setDone(null);
    if (await change.run(() => removeOverride(leagueId, { fixtureCode: picked, playerCode: card.code }))) setDone(overrideRemovedWords);
  }

  return (
    <div className="border-t border-panel-rule">
      {!open ? (
        <div className="px-3 py-2">
          <button type="button" onClick={() => setOpen(true)} className="secondary-action">
            {OVERRIDE_TITLE}
          </button>
        </div>
      ) : (
        <>
          <Problem problem={change.problem} />
          <Status words={done} className="px-3 pt-2 text-derived" />
          <form onSubmit={save} aria-label={OVERRIDE_TITLE} className={PANEL_BODY}>
            <p id={HINT_ID} className="text-muted">
              {overrideHint}
            </p>
            <label htmlFor={MATCH_ID} className="font-semibold">
              {overrideLabels.match}
            </label>
            <select id={MATCH_ID} value={fixtureCode} onChange={(event) => setFixtureCode(Number(event.target.value))} className="text-box">
              {card.matches.map((match) => (
                <option key={match.fixtureCode} value={match.fixtureCode}>
                  {overrideMatchWords(match.gameweek, match.home.shortName, match.away.shortName)}
                </option>
              ))}
            </select>
            <OverrideFields
              idPrefix={ID_PREFIX}
              labels={overrideLabels}
              most={OVERRIDE_POINTS_MOST}
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
              {overridden && (
                <button type="button" onClick={remove} disabled={change.busy} className="secondary-action">
                  {removeOverrideWords}
                </button>
              )}
              <button type="button" onClick={shut} className="secondary-action">
                {cancelOverrideWords}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
