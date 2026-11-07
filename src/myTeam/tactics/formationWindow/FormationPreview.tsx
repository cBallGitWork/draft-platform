import type { Classic } from "../../../../convex/lineup/classics";
import { positionOfSlot, sameCell } from "../../../../convex/lineup/pitch";
import { onClassic } from "../classicLineup";
import { roleIn } from "../../../../convex/lineup/roles";
import { Placeholder } from "../../../ui/Placeholder";
import { PositionChip } from "../../../ui/PositionChip";
import { reshaped, standingIn, type DraftLineup, type MoveRules, type RatingsOf } from "../lineupDraft";
import { cellGridOf, rowLayoutOf } from "../pitch/rowLayout";
import type { Shape } from "./formationGroups";
import { cellsDrawn } from "./FormationTile";
import {
  appliesHead,
  appliesWords,
  classicAppliesWords,
  classicTitleWords,
  costsHead,
  costsPlaceholder,
  gainsHead,
  gainsPlaceholder,
  losesHead,
  losesPlaceholder,
  previewLabel,
  unlocksHead,
  unlocksPlaceholder,
} from "./words";

// The formation window's preview (the approved formation window): the picked formation on a pitch,
// each slot's chip over the role it would play once used, and its lines in the picture's order:
// Applies, Gains, Loses, Unlocks, Costs. Gains and Loses wait on Craig's words (to-grill: Formation
// descriptions), Unlocks and Costs on team tactics (to-grill: Team tactic per formation), so each
// shows as its placeholder (plate.md, Marks). A classic's preview adds its subtitle, formation and
// what it did, its text sample until Craig rewrites it (#991).

/** The lineup reshaped to `shape`, as Use this would leave it (spec/05, The pitch): for a classic,
 *  `classic`, on every role it sets, under its subtitle, the formation it stands in (`tag`) and
 *  what it did. */
export function FormationPreview({
  shape,
  classic,
  draft,
  rules,
  ratingsOf,
}: {
  shape: Shape;
  classic?: { classic: Classic; tag: string };
  draft: DraftLineup;
  rules: Pick<MoveRules, "positionsOf">;
  ratingsOf: RatingsOf;
}) {
  const after = classic === undefined ? reshaped(draft, shape.cells, rules, ratingsOf) : onClassic(draft, classic.classic, rules, ratingsOf);
  const lines: [string, string, string][] = [
    [gainsHead, gainsPlaceholder, "h-10"],
    [losesHead, losesPlaceholder, "h-10"],
    [unlocksHead, unlocksPlaceholder, "h-10"],
    [costsHead, costsPlaceholder, "h-5"],
  ];
  return (
    <div className="flex flex-col">
      <h3 className="flex items-baseline gap-3 bg-plate px-3 py-1 shadow-bevel-plate">
        <span className="text-heading font-bold">{shape.name}</span>
        {classic !== undefined && <span>{classicTitleWords(classic.classic.subtitle, classic.tag)}</span>}
      </h3>
      <div className="flex flex-wrap gap-3 p-3">
        <div role="img" aria-label={previewLabel(shape.name)} style={cellGridOf(rowLayoutOf(shape.cells))} className="grid h-96 w-64 shrink-0 border-2 border-pitch-line bg-pitch-stripe">
          {cellsDrawn((cell) => {
            const inShape = shape.cells.some((each) => sameCell(each, cell));
            const standing = standingIn(after, cell);
            return (
              <span key={`${cell.area}-${cell.lane}`} className="flex min-w-0 flex-col items-center justify-center">
                {inShape && (
                  <>
                    <PositionChip label={positionOfSlot(cell)} />
                    <span className="line-clamp-2 w-full bg-name-plate text-center">{roleIn(cell, standing?.role).name}</span>
                  </>
                )}
              </span>
            );
          })}
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-facts content-start gap-x-3 gap-y-2">
          {classic !== undefined && <p className="col-span-full text-lead">{classic.classic.description}</p>}
          <dt className="text-muted">{appliesHead}</dt>
          <dd>{classic === undefined ? appliesWords(shape.name) : classicAppliesWords(classic.tag)}</dd>
          {lines.map(([head, label, height]) => (
            <div key={head} className="contents">
              <dt className="text-muted">{head}</dt>
              <dd>
                <Placeholder label={label} className={`${height} w-full`} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
