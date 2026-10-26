import { useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { OVERRIDE_REASON_MAX } from "../../convex/table/overrideLimits";
import { PANEL_BODY, Problem } from "../frame/Panel";
import { useChange } from "../useChange";
import type { PlayerCard, PlayerCardSeam } from "./seam";
import { OVERRIDE_TITLE, overriddenDoneWords, overrideHint, overrideLabels, overrideMatchWords, overrideWords } from "./words";

const MATCH_ID = "override-match";
const POINTS_ID = "override-points";
const REASON_ID = "override-reason";
/** Points are kept to a tenth (spec/14). */
const POINTS_STEP = 0.1;

/** The card's override (spec/14, Changes and corrections; #32), for whoever runs the league: one of
 *  his matches this season, his points there and why. Shut until asked for; nothing while he has
 *  played no match. The server refuses a match not yet final, and says why. */
export function OverridePoints({ leagueId, card, seam }: { leagueId: Id<"leagues">; card: PlayerCard; seam: PlayerCardSeam }) {
  const override = seam.useOverride();
  const change = useChange();
  const [open, setOpen] = useState(false);
  const [fixtureCode, setFixtureCode] = useState(card.matches[0]?.fixtureCode);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  if (fixtureCode === undefined) return null;
  const picked = fixtureCode;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(false);
    const made = await change.run(() => override(leagueId, { fixtureCode: picked, playerCode: card.code, points: Number(points), reason }));
    if (!made) return;
    setDone(true);
    setPoints("");
    setReason("");
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
          {done && (
            <p role="status" className="px-3 pt-2 text-derived">
              {overriddenDoneWords}
            </p>
          )}
          <form onSubmit={save} aria-label={OVERRIDE_TITLE} className={PANEL_BODY}>
            <p className="text-muted">{overrideHint}</p>
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
            <label htmlFor={POINTS_ID} className="font-semibold">
              {overrideLabels.points}
            </label>
            <input
              id={POINTS_ID}
              type="number"
              required
              step={POINTS_STEP}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              className="text-box"
            />
            <label htmlFor={REASON_ID} className="font-semibold">
              {overrideLabels.reason}
            </label>
            <input
              id={REASON_ID}
              required
              maxLength={OVERRIDE_REASON_MAX}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="text-box"
            />
            <button type="submit" disabled={change.busy} className="action self-start">
              {overrideWords}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
