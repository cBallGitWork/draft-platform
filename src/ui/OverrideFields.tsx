import { OVERRIDE_POINTS_STEP, OVERRIDE_REASON_MAX } from "../../convex/table/overrideLimits";

/** An override form's points box and its reason (spec/14), on the player card's override and the
 *  matchup's team override: points to a tenth between `-most` and `most`, and why, up to the
 *  reason's length. The boxes are `<idPrefix>-points` and `<idPrefix>-reason`; `describedBy` names
 *  the form's hint, which describes the points box. */
export function OverrideFields({
  idPrefix,
  labels,
  most,
  points,
  onPoints,
  reason,
  onReason,
  describedBy,
}: {
  idPrefix: string;
  labels: { points: string; reason: string };
  most: number;
  points: string;
  onPoints: (points: string) => void;
  reason: string;
  onReason: (reason: string) => void;
  describedBy: string;
}) {
  const pointsId = `${idPrefix}-points`;
  const reasonId = `${idPrefix}-reason`;
  return (
    <>
      <label htmlFor={pointsId} className="font-semibold">
        {labels.points}
      </label>
      <input
        id={pointsId}
        type="number"
        required
        step={OVERRIDE_POINTS_STEP}
        min={-most}
        max={most}
        value={points}
        onChange={(event) => onPoints(event.target.value)}
        aria-describedby={describedBy}
        className="text-box"
      />
      <label htmlFor={reasonId} className="font-semibold">
        {labels.reason}
      </label>
      <input id={reasonId} required maxLength={OVERRIDE_REASON_MAX} value={reason} onChange={(event) => onReason(event.target.value)} className="text-box" />
    </>
  );
}
